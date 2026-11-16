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

export type DayPoint = { date: string; net: number; orders: number }
type Metric = 'net' | 'orders' | 'aov'
const METRIC: Record<Metric, { label: string; color: string; fmt: (n: number) => string; total: (s: DayPoint[]) => number }> = {
  net: { label: 'Uang masuk', color: 'var(--chart-1)', fmt: rupiah, total: (s) => s.reduce((a, p) => a + p.net, 0) },
  orders: { label: 'Jumlah penjualan', color: 'var(--chart-2)', fmt: (n) => `${n.toLocaleString('id-ID')} penjualan`, total: (s) => s.reduce((a, p) => a + p.orders, 0) },
  aov: {
    label: 'Rata-rata per penjualan',
    color: 'var(--chart-4)',
    fmt: rupiah,
    total: (s) => {
      const o = s.reduce((a, p) => a + p.orders, 0)
      return o ? Math.round(s.reduce((a, p) => a + p.net, 0) / o) : 0
    },
  },
}

/** Grafik area interaktif (shadcn "Area Chart - Interactive"): ketuk angka di atas untuk mengganti yang digambar. */
export function SalesTrendChart({ series }: { series: DayPoint[] }) {
  const [metric, setMetric] = useState<Metric>('net')
  const data = series.map((p) => ({ ...p, aov: p.orders ? Math.round(p.net / p.orders) : 0 }))
  const config = { [metric]: { label: METRIC[metric].label, color: METRIC[metric].color } } satisfies ChartConfig
  const empty = series.every((p) => p.orders === 0)
  return (
    <div>
      <div className="grid grid-cols-3 border-b" role="tablist" aria-label="Angka yang digambar">
        {(Object.keys(METRIC) as Metric[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={metric === k}
            onClick={() => setMetric(k)}
            className="relative flex flex-col gap-1 border-r px-3 py-3 text-left last:border-r-0 hover:bg-muted/40 aria-selected:bg-muted/60 sm:px-6 sm:py-4"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground sm:text-base">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: METRIC[k].color }} aria-hidden />
              {METRIC[k].label}
            </span>
            <span className="text-base font-bold tabular-nums sm:text-2xl">{k === 'orders' ? METRIC.orders.total(series).toLocaleString('id-ID') : rupiah(METRIC[k].total(series))}</span>
            {metric === k && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: METRIC[k].color }} aria-hidden />}
          </button>
        ))}
      </div>
      <div className="px-2 pt-4 sm:px-6">
        {empty ? (
          <p className="grid h-[240px] place-items-center text-center text-base text-muted-foreground">Belum ada penjualan di rentang ini. Grafik muncul setelah ada penjualan yang dibayar.</p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
            <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
              <defs>
                <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${metric})`} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={`var(--color-${metric})`} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => dayLabel(String(v))} />
              <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={(v) => (metric === 'orders' ? String(v) : short(Number(v)))} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => longDay(String(v))} formatter={(v) => <span className="font-mono font-semibold tabular-nums">{METRIC[metric].fmt(Number(v))}</span>} />}
              />
              <Area dataKey={metric} type="monotone" fill={`url(#fill-${metric})`} stroke={`var(--color-${metric})`} strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  )
}

/** Penjualan per jam (hari ini): kapan toko paling ramai. */
export function HourlyChart({ data }: { data: { hour: number; net: number; orders: number }[] }) {
  const config = { net: { label: 'Uang masuk', color: 'var(--chart-1)' } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(h) => `${String(h).padStart(2, '0')}.00`} minTickGap={16} />
        <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(v) => short(Number(v))} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => { const h = Number(p?.[0]?.payload?.hour ?? 0); return `Pukul ${String(h).padStart(2, '0')}.00–${String(h + 1).padStart(2, '0')}.00` }} formatter={(v, _n, item) => <span className="font-mono font-semibold tabular-nums">{rupiah(Number(v))} · {(item.payload as { orders: number }).orders} penjualan</span>} />}
        />
        <Bar dataKey="net" fill="var(--color-net)" radius={6} maxBarSize={48} />
      </BarChart>
    </ChartContainer>
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
