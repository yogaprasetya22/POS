import { ArrowUpRight, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { Chip, type Tone } from '@shared/components/page'
import { EmptyState } from '@shared/components/pagination'
import { ChartSkeleton, RowsSkeleton, StatTilesSkeleton } from '@shared/components/skeletons'
import { Button, buttonVariants } from '@shared/components/ui/button'
import { Switch } from '@shared/components/ui/switch'
import { supabase } from '@shared/lib/supabase'
import { rupiah, todayJakarta } from '@shared/lib/utils'
import { OrderSchema, PAYMENT_LABEL, isSellable, type Order, type Product } from '@shared/types/contracts'
import { KpiCard, KpiGrid, Panel, RangePicker, Trend, addDays, eachDay, longDay, previousRange, rangeOf, type Preset } from './analytics/kit'
import { HourlyChart, SalesTrendChart } from './analytics/lazy'
import { clock, dayLabel, fetchReport, type Report } from './report-page'

const IngredientSchema = z.object({ id: z.uuid(), name: z.string(), unit: z.string(), stock: z.coerce.number(), min_stock: z.coerce.number(), is_active: z.boolean() })
const PaidSchema = z.object({ paid_at: z.string(), total: z.number() })

const STATUS: Record<string, { label: string; tone: Tone }> = {
  IN_KITCHEN: { label: 'Sudah dibayar', tone: 'info' },
  READY: { label: 'Siap diambil', tone: 'info' },
  COMPLETED: { label: 'Selesai', tone: 'good' },
}
const PAID = ['IN_KITCHEN', 'READY', 'COMPLETED']
const jakartaHour = (iso: string) => Number(new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false })) % 24

/**
 * Hari Ini: angka utama hari ini (dibanding kemarin), tren penjualan, jam ramai, penjualan terakhir,
 * dan hal yang perlu dicek. Angka hari ini & kemarin diambil dari laporan rentang grafik (tanpa panggilan tambahan).
 */
export function Dashboard({ products, run }: { products: Product[]; run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void> }) {
  const today = todayJakarta()
  const [preset, setPreset] = useState<Preset>('30d')
  const [[from, to], setRange] = useState<[string, string]>(rangeOf('30d'))
  const [report, setReport] = useState<Report | null>(null)
  const [prev, setPrev] = useState<Report | null>(null)
  const [hourly, setHourly] = useState<z.infer<typeof PaidSchema>[] | null>(null)
  const [recent, setRecent] = useState<Order[] | null>(null)
  const [low, setLow] = useState<z.infer<typeof IngredientSchema>[] | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [showAll, setShowAll] = useState(false)

  // laporan rentang grafik + periode pembanding (2 panggilan untuk seluruh angka penjualan di halaman)
  useEffect(() => {
    let alive = true
    setError('')
    const [pf, pt] = previousRange(from, to)
    Promise.all([fetchReport(from, to), fetchReport(pf, pt).catch(() => null)])
      .then(([cur, old]) => {
        if (!alive) return
        setReport(cur)
        setPrev(old)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [from, to, tick])

  // data pelengkap: penjualan hari ini per jam, 8 penjualan terakhir, bahan hampir habis
  useEffect(() => {
    void supabase.from('orders').select('paid_at,total').eq('business_day', today).not('paid_at', 'is', null).in('status', PAID).limit(2000).then(({ data }) => {
      setHourly(z.array(PaidSchema).safeParse(data ?? []).data ?? [])
    })
    void supabase.from('orders').select('*').not('paid_at', 'is', null).in('status', PAID).order('paid_at', { ascending: false }).limit(5).then(({ data }) => {
      setRecent(z.array(OrderSchema).safeParse(data ?? []).data ?? [])
    })
    void supabase.from('ingredients').select('id,name,unit,stock,min_stock,is_active').then(({ data }) => {
      setLow((z.array(IngredientSchema).safeParse(data ?? []).data ?? []).filter((i) => i.is_active && i.min_stock > 0 && i.stock <= i.min_stock))
    })
  }, [today, tick])

  const byDay = useMemo(() => new Map((report?.daily ?? []).map((d) => [d.day, d])), [report])
  const series = useMemo(() => eachDay(from, to).map((date) => ({ date, net: byDay.get(date)?.net ?? 0, orders: byDay.get(date)?.orders ?? 0 })), [byDay, from, to])
  const hours = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({ hour, net: 0, orders: 0 }))
    for (const o of hourly ?? []) {
      const r = rows[jakartaHour(o.paid_at)]
      r.net += o.total
      r.orders += 1
    }
    // tampilkan jam buka saja: dari jam pertama sampai jam terakhir yang ada penjualan
    const used = rows.filter((r) => r.orders > 0)
    return used.length ? rows.slice(used[0].hour, used[used.length - 1].hour + 1) : []
  }, [hourly])

  const t = byDay.get(today)
  const y = byDay.get(addDays(today, -1))
  const net = t?.net ?? 0
  const orders = t?.orders ?? 0
  const aov = orders ? Math.round(net / orders) : 0
  const yAov = y?.orders ? Math.round(y.net / y.orders) : 0
  const busiest = hours.reduce<{ hour: number; orders: number } | null>((b, h) => (!b || h.orders > b.orders ? h : b), null)
  const soldOut = products.filter((p) => !isSellable(p))
  const attention = soldOut.length + (low?.length ?? 0)
  const retry = useCallback(() => setTick((n) => n + 1), [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Hari Ini</h1>
          <p className="mt-1 text-lg text-muted-foreground">{longDay(today)}</p>
        </div>
        <Link to="/admin/laporan" className={buttonVariants({ variant: 'outline', className: 'h-11 border-2 px-4 text-base' })}>
          Laporan lengkap <ArrowUpRight />
        </Link>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-4 py-3 text-base">
          <span>Angka penjualan belum bisa dimuat. Periksa internet, lalu coba lagi.</span>
          <Button variant="outline" className="h-11 border-2 text-base" onClick={retry}><RotateCw /> Coba lagi</Button>
        </div>
      )}

      {!report ? (
        <StatTilesSkeleton count={4} className="grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" />
      ) : (
        <KpiGrid>
          <KpiCard index={0} label="Uang masuk hari ini" value={rupiah(net)} badge={<Trend cur={net} prev={y?.net ?? 0} />} title={`dari ${orders} penjualan`} hint={`Kemarin ${rupiah(y?.net ?? 0)}`} />
          <KpiCard index={1} label="Jumlah penjualan" value={String(orders)} badge={<Trend cur={orders} prev={y?.orders ?? 0} />} title={busiest ? `Paling ramai pukul ${String(busiest.hour).padStart(2, '0')}.00` : 'Belum ada penjualan hari ini'} hint={`Kemarin ${y?.orders ?? 0} penjualan`} />
          <KpiCard index={2} label="Rata-rata per penjualan" value={rupiah(aov)} badge={<Trend cur={aov} prev={yAov} />} title="Rata-rata belanja tiap pembeli" hint={yAov ? `Kemarin ${rupiah(yAov)}` : 'Kemarin belum ada penjualan'} />
          <KpiCard
            index={3}
            label="Perlu dicek"
            value={low === null ? '…' : String(attention)}
            tone={attention > 0 ? 'bad' : 'good'}
            title={attention ? `${soldOut.length} menu habis · ${low?.length ?? 0} bahan hampir habis` : 'Semua aman'}
            hint={attention ? 'Lihat daftar di bawah' : 'Tidak ada menu habis atau bahan menipis'}
            onClick={attention ? () => document.getElementById('perlu-dicek')?.scrollIntoView({ behavior: 'smooth' }) : undefined}
          />
        </KpiGrid>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Tren penjualan"
          description={prev && report && prev.totals.net > 0 ? <span className="inline-flex flex-wrap items-center gap-2">Dibanding periode sebelumnya <Trend cur={report.totals.net} prev={prev.totals.net} /></span> : 'Uang masuk per hari'}
          action={<RangePicker value={preset} presets={['7d', '30d', '90d']} from={from} to={to} label="Rentang grafik" onChange={(p, r) => { setPreset(p); setRange(r) }} />}
          className="lg:col-span-2"
          flush
        >
          {report ? <SalesTrendChart series={series} /> : <div className="p-4"><ChartSkeleton /></div>}
        </Panel>

        <Panel title="Jam ramai hari ini" description="Uang masuk per jam">
          {hourly === null ? (
            <ChartSkeleton />
          ) : hours.length === 0 ? (
            <EmptyState title="Belum ada penjualan hari ini" hint="Grafik muncul setelah penjualan pertama dibayar." />
          ) : (
            <HourlyChart data={hours} />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Penjualan terakhir"
          description="5 penjualan terakhir yang sudah dibayar"
          action={<Link to="/admin/laporan" className={buttonVariants({ variant: 'ghost', className: 'h-11 text-base' })}>Semua <ArrowUpRight /></Link>}
          className="lg:col-span-2"
          flush
        >
          {recent === null ? (
            <RowsSkeleton rows={5} />
          ) : recent.length === 0 ? (
            <div className="p-4"><EmptyState title="Belum ada penjualan" hint="Penjualan yang sudah dibayar muncul di sini. Mulai dari tombol Jualan." /></div>
          ) : (
            <ul className="divide-y">
              {recent.map((o) => {
                const s = STATUS[o.status] ?? { label: o.status, tone: 'neutral' as Tone }
                return (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-11 min-w-16 place-items-center rounded-lg bg-muted px-2 font-mono font-bold">{o.queue_code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{o.customer_name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {dayLabel(o.business_day)} {o.paid_at && clock(o.paid_at)} · {o.payment_method ? PAYMENT_LABEL[o.payment_method] : '—'}
                      </span>
                    </span>
                    <span className="hidden sm:block"><Chip tone={s.tone}>{s.label}</Chip></span>
                    <span className="text-base font-bold tabular-nums">{rupiah(o.total)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div id="perlu-dicek" className="scroll-mt-20">
          <Panel title="Perlu dicek" description={attention ? `${attention} hal` : 'Menu habis & bahan menipis'}>
            {low === null ? (
              <RowsSkeleton rows={3} />
            ) : attention === 0 ? (
              <EmptyState title="Semua aman" hint="Tidak ada menu habis atau bahan yang hampir habis." />
            ) : (
              <div className="space-y-3">
                {/* satu daftar ringkas: paling banyak 5 baris, sisanya lewat tombol */}
                <ul className="divide-y">
                  {[
                    ...soldOut.map((p) => ({ key: `p-${p.id}`, name: p.name, tag: 'Menu habis', right: p.is_available ? <span className="text-sm font-semibold text-destructive">Bahan habis</span> : <Switch checked={false} aria-label={`Jual lagi ${p.name}`} onCheckedChange={(v) => run(supabase.from('products').update({ is_available: v }).eq('id', p.id))} /> })),
                    ...low.map((i) => ({ key: `i-${i.id}`, name: i.name, tag: 'Bahan menipis', right: <span className="text-sm font-semibold tabular-nums text-destructive">{Math.max(i.stock, 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {i.unit}</span> })),
                  ]
                    .slice(0, showAll ? undefined : 5)
                    .map((r) => (
                      <li key={r.key} className="flex min-h-12 items-center justify-between gap-3 py-1.5">
                        <span className="min-w-0">
                          <span className="block truncate text-base">{r.name}</span>
                          <span className="block text-sm text-muted-foreground">{r.tag}</span>
                        </span>
                        <span className="shrink-0">{r.right}</span>
                      </li>
                    ))}
                </ul>
                {attention > 5 && (
                  <Button variant="ghost" className="h-11 w-full text-base" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Ringkas lagi' : `Tampilkan ${attention - 5} lainnya`}
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/admin/stok" className={buttonVariants({ variant: 'outline', className: 'h-11 border-2 text-base' })}>Lihat stok</Link>
                  <Link to="/admin/pembelian" className={buttonVariants({ variant: 'outline', className: 'h-11 border-2 text-base' })}>Belanja</Link>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
