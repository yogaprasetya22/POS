import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@shared/components/ui/chart'
import { rupiah } from '@shared/lib/utils'
import { dayLabel, longDay } from './kit'

/*
 * Semua grafik (recharts) ada di file ini dan dimuat terpisah lewat lazy.tsx,
 * supaya angka utama tampil dulu tanpa menunggu pustaka grafik.
 */

const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : Math.abs(n) >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(n))

type Metric = 'net' | 'orders' | 'aov'
type Row = { net: number; orders: number; prevNet: number; prevOrders: number; hour?: number; date?: string; prevDate?: string; future?: boolean }
// jam yang belum terjadi (hari ini) tidak ikut dijumlah, supaya pembanding adil: kemarin sampai jam yang sama
const sum = (rows: Row[], k: 'net' | 'orders' | 'prevNet' | 'prevOrders') => rows.reduce((a, r) => a + (r.future ? 0 : r[k]), 0)
const avg = (net: number, orders: number) => (orders ? Math.round(net / orders) : 0)
const METRIC: Record<Metric, { label: string; color: string; fmt: (n: number) => string; cur: (r: Row[]) => number; prev: (r: Row[]) => number }> = {
  net: { label: 'Uang masuk', color: 'var(--chart-1)', fmt: rupiah, cur: (r) => sum(r, 'net'), prev: (r) => sum(r, 'prevNet') },
  orders: { label: 'Jumlah penjualan', color: 'var(--chart-2)', fmt: (n) => `${n.toLocaleString('id-ID')} penjualan`, cur: (r) => sum(r, 'orders'), prev: (r) => sum(r, 'prevOrders') },
  aov: { label: 'Rata-rata per penjualan', color: 'var(--chart-4)', fmt: rupiah, cur: (r) => avg(sum(r, 'net'), sum(r, 'orders')), prev: (r) => avg(sum(r, 'prevNet'), sum(r, 'prevOrders')) },
}
const hh = (h: number) => `${String(h).padStart(2, '0')}.00`

/**
 * Grafik area interaktif (shadcn "Area Chart - Interactive") dengan garis putus-putus periode pembanding.
 * `mode="hour"`: per jam (Hari ini vs kemarin). `mode="day"`: per hari (vs periode sebelumnya).
 */
export function SalesTrendChart({ rows, mode = 'day', prevLabel = 'Periode lalu' }: { rows: Row[]; mode?: 'hour' | 'day'; prevLabel?: string }) {
  const [metric, setMetric] = useState<Metric>('net')
  // jam yang belum terjadi: garis hari ini berhenti di jam sekarang (null = tidak digambar)
  const data = rows.map((r) => ({ ...r, aov: avg(r.net, r.orders), prevAov: avg(r.prevNet, r.prevOrders), ...(r.future ? { net: null, orders: null, aov: null } : {}) }))
  const partial = rows.some((r) => r.future)
  const prevKey = metric === 'net' ? 'prevNet' : metric === 'orders' ? 'prevOrders' : 'prevAov'
  const config = {
    [metric]: { label: mode === 'hour' ? 'Hari ini' : 'Periode ini', color: METRIC[metric].color },
    [prevKey]: { label: prevLabel, color: 'var(--muted-foreground)' },
  } satisfies ChartConfig
  const empty = rows.every((r) => r.orders === 0 && r.prevOrders === 0)
  const hasPrev = rows.some((r) => r.prevOrders > 0)
  const fmtVal = (k: Metric, n: number) => (k === 'orders' ? n.toLocaleString('id-ID') : rupiah(n))
  return (
    <div>
      <div className="grid grid-cols-3 border-b" role="tablist" aria-label="Angka yang digambar">
        {(Object.keys(METRIC) as Metric[]).map((k) => {
          const cur = METRIC[k].cur(rows)
          const prev = METRIC[k].prev(rows)
          const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
          return (
            <button key={k} type="button" role="tab" aria-selected={metric === k} onClick={() => setMetric(k)} className="relative flex flex-col gap-1 border-r px-3 py-3 text-left last:border-r-0 hover:bg-muted/40 aria-selected:bg-muted/60 sm:px-6 sm:py-4">
              <span className="flex items-center gap-2 text-sm text-muted-foreground sm:text-base">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: METRIC[k].color }} aria-hidden />
                {METRIC[k].label}
              </span>
              <span className="text-base font-bold tabular-nums sm:text-2xl">{fmtVal(k, cur)}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {prevLabel}{partial ? ' s/d jam ini' : ''}: {fmtVal(k, prev)}
                {pct !== null && <span className={pct >= 0 ? ' font-semibold text-emerald-700 dark:text-emerald-400' : ' font-semibold text-destructive'}> ({pct >= 0 ? '+' : ''}{pct}%)</span>}
              </span>
              {metric === k && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: METRIC[k].color }} aria-hidden />}
            </button>
          )
        })}
      </div>
      <div className="px-2 pt-4 sm:px-6">
        {empty ? (
          <p className="grid h-[240px] place-items-center text-center text-base text-muted-foreground">Belum ada penjualan di rentang ini. Grafik muncul setelah ada penjualan yang dibayar.</p>
        ) : (
          <>
            <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
              <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${metric})`} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={`var(--color-${metric})`} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey={mode === 'hour' ? 'hour' : 'date'} tickLine={false} axisLine={false} tickMargin={8} minTickGap={mode === 'hour' ? 12 : 32} tickFormatter={(v) => (mode === 'hour' ? hh(Number(v)) : dayLabel(String(v)))} />
                <YAxis width={60} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => (metric === 'orders' ? String(v) : short(Number(v)))} />
                <ChartTooltip
                  cursor={{ stroke: 'var(--border)' }}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(_, p) => {
                        const r = p?.[0]?.payload as Row | undefined
                        if (!r) return ''
                        return mode === 'hour' ? `Pukul ${hh(r.hour ?? 0)}–${hh(((r.hour ?? 0) + 1) % 24)}` : `${longDay(r.date ?? '')}`
                      }}
                      formatter={(v, name, item) => {
                        const r = item.payload as Row
                        const isPrev = String(name).startsWith('prev')
                        const when = isPrev ? (mode === 'hour' ? 'Kemarin' : `${prevLabel} (${dayLabel(r.prevDate ?? '')})`) : mode === 'hour' ? 'Hari ini' : 'Periode ini'
                        return (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">{when}</span>
                            <span className="font-mono font-semibold tabular-nums">{METRIC[metric].fmt(Number(v))}</span>
                          </div>
                        )
                      }}
                    />
                  }
                />
                {hasPrev && <Area dataKey={prevKey} type="monotone" fill="none" stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />}
                <Area dataKey={metric} type="monotone" connectNulls={false} fill={`url(#fill-${metric})`} stroke={`var(--color-${metric})`} strokeWidth={2.5} dot={mode === 'hour' ? { r: 3 } : false} />
              </AreaChart>
            </ChartContainer>
            <p className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-3 pt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-1 w-5 rounded" style={{ background: METRIC[metric].color }} aria-hidden /> {mode === 'hour' ? 'Hari ini' : 'Periode ini'}</span>
              <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-muted-foreground" aria-hidden /> {hasPrev ? prevLabel : `${prevLabel}: belum ada penjualan`}</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/** Jam ramai: batang hari ini (berwarna) di samping batang kemarin (abu-abu) untuk setiap jam. */
export function HourlyChart({ data }: { data: { hour: number; net: number; orders: number; prevNet: number; prevOrders: number }[] }) {
  const config = { orders: { label: 'Hari ini', color: 'var(--chart-1)' }, prevOrders: { label: 'Kemarin', color: 'var(--muted-foreground)' } } satisfies ChartConfig
  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }} barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(h) => hh(Number(h))} interval="preserveStartEnd" minTickGap={8} />
          <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (m: number) => Math.max(2, m)]} />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)' }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) => { const h = Number(p?.[0]?.payload?.hour ?? 0); return `Pukul ${hh(h)}–${hh((h + 1) % 24)}` }}
                formatter={(v, name, item) => {
                  const r = item.payload as { net: number; prevNet: number }
                  const today = name === 'orders'
                  return (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">{today ? 'Hari ini' : 'Kemarin'}</span>
                      <span className="font-mono font-semibold tabular-nums">{Number(v)} penjualan · {rupiah(today ? r.net : r.prevNet)}</span>
                    </div>
                  )
                }}
              />
            }
          />
          <Bar dataKey="prevOrders" fill="var(--color-prevOrders)" fillOpacity={0.35} radius={4} maxBarSize={18} />
          <Bar dataKey="orders" fill="var(--color-orders)" radius={4} maxBarSize={18} />
        </BarChart>
      </ChartContainer>
      <p className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: 'var(--chart-1)' }} aria-hidden /> Hari ini</span>
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-muted-foreground/35" aria-hidden /> Kemarin</span>
        <span>Tinggi batang = jumlah penjualan</span>
      </p>
    </div>
  )
}

const METHOD_COLOR: Record<string, string> = { CASH: 'var(--chart-2)', QRIS_STATIC: 'var(--chart-1)', EDC_CARD: 'var(--chart-3)' }

/** Cara bayar dalam diagram donat + daftar dengan persen. */
export function MethodsChart({ rows }: { rows: { key: string; label: string; orders: number; net: number }[] }) {
  const total = rows.reduce((a, r) => a + r.net, 0)
  const config = Object.fromEntries(rows.map((r) => [r.key, { label: r.label, color: METHOD_COLOR[r.key] ?? 'var(--chart-5)' }])) satisfies ChartConfig
  return (
    <div className="flex flex-col items-center gap-4">
      <ChartContainer config={config} className="aspect-square h-[180px] shrink-0">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" formatter={(v, _n, item) => <span className="font-mono font-semibold tabular-nums">{(item.payload as { label: string }).label}: {rupiah(Number(v))}</span>} />} />
          <Pie data={rows} dataKey="net" nameKey="key" innerRadius={50} strokeWidth={4}>
            {rows.map((r) => <Cell key={r.key} fill={`var(--color-${r.key})`} />)}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="w-full space-y-2.5 text-base">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: METHOD_COLOR[r.key] ?? 'var(--chart-5)' }} aria-hidden />
              {r.label} <span className="text-muted-foreground">{r.orders}×</span>
            </span>
            <span className="tabular-nums"><span className="font-semibold">{rupiah(r.net)}</span> <span className="text-muted-foreground">{total ? Math.round((r.net / total) * 100) : 0}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Peringkat (menu terlaris, per kasir): nama, nilai, dan batang perbandingan. HTML biasa supaya label selalu terbaca. */
export function RankBars({ rows, color = 'var(--chart-1)' }: { rows: { name: string; value: number; sub?: string }[]; valueLabel?: string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span><span className="font-semibold">{r.name}</span>{r.sub && <span className="text-muted-foreground"> · {r.sub}</span>}</span>
            <span className="shrink-0 font-bold tabular-nums">{rupiah(r.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Selisih kas per hari: batang merah = uang kurang, hijau = uang lebih. */
export function CashDiffChart({ data }: { data: { date: string; short: number; over: number }[] }) {
  const config = { short: { label: 'Uang kurang', color: 'var(--destructive)' }, over: { label: 'Uang lebih', color: 'var(--chart-2)' } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} stackOffset="sign" margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(v) => dayLabel(String(v))} />
        <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={(v) => short(Number(v))} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => longDay(String(v))} formatter={(v, name) => <span className="font-mono font-semibold tabular-nums">{name === 'short' ? 'Kurang' : 'Lebih'} {rupiah(Math.abs(Number(v)))}</span>} />} />
        <Bar dataKey="short" stackId="d" fill="var(--color-short)" radius={4} maxBarSize={32} />
        <Bar dataKey="over" stackId="d" fill="var(--color-over)" radius={4} maxBarSize={32} />
      </BarChart>
    </ChartContainer>
  )
}
