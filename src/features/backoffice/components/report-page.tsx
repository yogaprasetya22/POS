import { Download, Printer, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { KpiCard, KpiGrid, Panel, RangePicker, StatusLegend, TONE, Trend, downloadCsv, addDays, previousRange, rangeOf, rangeText, dayLabel, type Preset } from './analytics/kit'
import { MethodsChart, RankBars, SalesTrendChart } from './analytics/lazy'
import { busiestHour, dailySeries, hourRange, hourlySeries, jakartaHour, type Paid } from './analytics/series'
import { ProfitTab } from './profit-tab'
import { ChartSkeleton, RowsSkeleton, StatTilesSkeleton } from '@shared/components/skeletons'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Receipt } from '@features/cashier-pos/components/receipt'
import { Chip, FilterChips, ListCard, type Tone } from '@shared/components/page'
import { EmptyState, Pagination, SearchBox } from '@shared/components/pagination'
import { Button } from '@shared/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@shared/components/ui/drawer'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'
import { usePaged } from '@shared/lib/use-paged'
import { rupiah, todayJakarta } from '@shared/lib/utils'
import { OrderSchema, PAYMENT_LABEL, type Order, type StoreConfig } from '@shared/types/contracts'

const ReportSchema = z.object({
  totals: z.object({ orders: z.number(), gross: z.number(), discount: z.number(), service: z.number(), tax: z.number(), rounding: z.number(), net: z.number() }),
  voids: z.object({ count: z.number(), amount: z.number() }),
  refunds: z.object({ count: z.number(), amount: z.number() }),
  daily: z.array(z.object({ day: z.string(), orders: z.number(), net: z.number() })),
  by_method: z.array(z.object({ method: z.string(), orders: z.number(), net: z.number() })),
  by_cashier: z.array(z.object({ cashier: z.string(), orders: z.number(), net: z.number() })),
  top_products: z.array(z.object({ name: z.string(), qty: z.number(), revenue: z.number() })),
})
export type Report = z.infer<typeof ReportSchema>

// ---------- tanggal (dari analytics/kit; diekspor ulang untuk file lain) ----------
export { addDays, daysBetween, dayLabel } from './analytics/kit'
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(n))

// ---------- data ----------
export async function fetchReport(from: string, to: string): Promise<Report> {
  const { data, error } = await rpc('sales_report', { p_from: from, p_to: to })
  if (error) throw error
  const parsed = ReportSchema.safeParse(data)
  if (!parsed.success) throw new Error('Format laporan tidak dikenali')
  return parsed.data
}

function exportCsv(r: Report, from: string, to: string) {
  const method = (m: string) => PAYMENT_LABEL[m as keyof typeof PAYMENT_LABEL] ?? m
  downloadCsv(`laporan-${from}_${to}.csv`, [
    ['Laporan penjualan', `${from} s/d ${to}`], [],
    ['Ringkasan'], ['Transaksi', r.totals.orders], ['Penjualan kotor', r.totals.gross], ['Diskon', r.totals.discount], ['Service', r.totals.service],
    ['Pajak', r.totals.tax], ['Pembulatan', r.totals.rounding], ['Penjualan bersih', r.totals.net],
    ['Dibatalkan (jumlah)', r.voids.count], ['Dibatalkan (nilai)', r.voids.amount], ['Uang kembali (jumlah)', r.refunds.count], ['Uang kembali (nilai)', r.refunds.amount], [],
    ['Per hari'], ['Tanggal', 'Transaksi', 'Penjualan bersih'], ...r.daily.map((d) => [d.day, d.orders, d.net]), [],
    ['Per metode bayar'], ['Metode', 'Transaksi', 'Penjualan bersih'], ...r.by_method.map((m) => [method(m.method), m.orders, m.net]), [],
    ['Per kasir'], ['Kasir', 'Transaksi', 'Penjualan bersih'], ...r.by_cashier.map((c) => [c.cashier, c.orders, c.net]), [],
    ['Menu terlaris'], ['Menu', 'Jumlah', 'Pendapatan'], ...r.top_products.map((p) => [p.name, p.qty, p.revenue]),
  ])
}

/** Unduh semua transaksi di rentang (maks. 5.000 baris) sebagai CSV. */
async function exportOrders(from: string, to: string) {
  const { data, error } = await supabase.from('orders').select('*').gte('business_day', from).lte('business_day', to).order('created_at').limit(5000)
  if (error) throw error
  const rows = z.array(OrderSchema).safeParse(data ?? []).data ?? []
  downloadCsv(`transaksi-${from}_${to}.csv`, [
    ['Tanggal', 'Jam', 'Antrean', 'Pelanggan', 'Tempat', 'Status', 'Metode', 'Subtotal', 'Diskon', 'Service', 'Pajak', 'Pembulatan', 'Total', 'Menu'],
    ...rows.map((o) => [
      o.business_day, clock(o.created_at), o.queue_code, o.customer_name, where(o), STATUS[o.status]?.label ?? o.status,
      o.payment_method ? PAYMENT_LABEL[o.payment_method] : '', o.subtotal, o.discount_amount + o.voucher_discount + o.points_discount,
      o.service_amount, o.tax_amount, o.rounding_amount, o.total, o.items.map((i) => `${i.qty}x ${i.name}`).join('; '),
    ]),
  ])
  return rows.length
}

// ---------- potongan tampilan ----------
const TH = 'h-11 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground'

// ---------- transaksi ----------
type StatusFilter = 'paid' | 'reversed' | 'other' | 'all'
const STATUS_IN: Record<StatusFilter, string[] | null> = {
  paid: ['IN_KITCHEN', 'READY', 'COMPLETED'],
  reversed: ['VOID', 'REFUNDED'],
  other: ['CANCELLED', 'EXPIRED', 'UNPAID'],
  all: null,
}
const STATUS: Record<string, { label: string; tone: Tone }> = {
  UNPAID: { label: 'Belum dibayar', tone: 'warn' },
  IN_KITCHEN: { label: 'Sudah dibayar', tone: 'info' },
  READY: { label: 'Siap', tone: 'info' },
  COMPLETED: { label: 'Selesai', tone: 'good' },
  VOID: { label: 'Dibatalkan', tone: 'bad' },
  REFUNDED: { label: 'Uang kembali', tone: 'bad' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'neutral' },
}
const where = (o: Order) => (o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang')

function Row({ k, v, strong, minus }: { k: string; v: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'pt-1 text-base font-semibold' : 'text-muted-foreground'}`}>
      <span>{k}</span>
      <span className="tabular-nums">{minus ? '−' : ''}{rupiah(Math.abs(v))}</span>
    </div>
  )
}

function OrderDrawer({ order, onClose, onReprint }: { order: Order | null; onClose: () => void; onReprint: (o: Order) => void }) {
  const o = order
  const s = o ? (STATUS[o.status] ?? { label: o.status, tone: 'neutral' as Tone }) : null
  return (
    <Drawer open={!!o} onOpenChange={(v) => !v && onClose()} swipeDirection="right">
      <DrawerContent size="sm">
        {o && s && (
          <>
            <DrawerHeader className="border-b text-left">
              <DrawerTitle className="flex items-center gap-3">
                <span className="font-mono text-xl">{o.queue_code}</span>
                <Chip tone={s.tone}>{s.label}</Chip>
              </DrawerTitle>
              <DrawerDescription>{o.customer_name} · {where(o)} · {dayLabel(o.business_day)} {clock(o.created_at)}</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {o.void_reason && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-500/15 dark:text-red-100">Alasan: {o.void_reason}</p>}
              <ul className="divide-y">
                {o.items.map((i, n) => (
                  <li key={n} className="flex gap-3 py-2.5">
                    <span className="w-8 shrink-0 font-semibold tabular-nums">{i.qty}×</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{i.name}</span>
                      {i.choices.length > 0 && <span className="block text-sm text-muted-foreground">{i.choices.map((c) => c.option).join(', ')}</span>}
                      {i.note && <span className="block text-sm text-muted-foreground">“{i.note}”</span>}
                    </span>
                    <span className="tabular-nums">{rupiah(i.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1.5 border-t pt-4 text-sm">
                <Row k="Subtotal" v={o.subtotal || o.total + o.discount_amount} />
                {o.discount_amount > 0 && <Row k={`Promo${o.promo_name ? ` (${o.promo_name})` : ''}`} v={o.discount_amount} minus />}
                {o.voucher_discount > 0 && <Row k="Voucher" v={o.voucher_discount} minus />}
                {o.points_discount > 0 && <Row k={`Poin (${o.points_redeemed})`} v={o.points_discount} minus />}
                {o.service_amount > 0 && <Row k="Service" v={o.service_amount} />}
                {o.tax_amount > 0 && <Row k="Pajak" v={o.tax_amount} />}
                {o.rounding_amount !== 0 && <Row k="Pembulatan" v={o.rounding_amount} />}
                <Row k="Total" v={o.total} strong />
              </div>
              {o.payment_method && (
                <div className="space-y-1.5 border-t pt-4 text-sm">
                  <Row k={`Dibayar ${PAYMENT_LABEL[o.payment_method]}`} v={o.cash_received ?? o.total} />
                  {o.payment_method === 'CASH' && o.cash_received != null && <Row k="Kembalian" v={o.cash_received - o.total} />}
                  {o.points_earned > 0 && <p className="text-muted-foreground">Member mendapat +{o.points_earned} poin.</p>}
                </div>
              )}
            </div>
            <DrawerFooter className="flex-row border-t pt-3">
              <DrawerClose render={<Button variant="outline" className="h-11 flex-1">Tutup</Button>} />
              {o.paid_at && (
                <Button className="h-11 flex-1" onClick={() => onReprint(o)}>
                  <Printer /> Struk
                </Button>
              )}
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function Transactions({ from, to, onOpen }: { from: string; to: string; onOpen: (o: Order) => void }) {
  const [status, setStatus] = useState<StatusFilter>('paid')
  const orders = usePaged<Order>(
    async ({ from: a, to: b }, term) => {
      let q = supabase.from('orders').select('*', { count: 'exact' }).gte('business_day', from).lte('business_day', to).order('created_at', { ascending: false }).range(a, b)
      const list = STATUS_IN[status]
      if (list) q = q.in('status', list)
      if (term) {
        const safe = term.replace(/[%,()]/g, '')
        q = q.or(`queue_code.ilike.%${safe}%,customer_name.ilike.%${safe}%,table_no.ilike.%${safe}%`)
      }
      const r = await q
      return { ...r, data: z.array(OrderSchema).safeParse(r.data ?? []).data ?? [] }
    },
    { pageSize: 20, deps: [from, to, status] },
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          id="order-status"
          label="Status transaksi"
          value={status}
          onChange={setStatus}
          options={[{ value: 'paid', label: 'Terbayar' }, { value: 'reversed', label: 'Dibatalkan & uang kembali' }, { value: 'other', label: 'Batal & belum bayar' }, { value: 'all', label: 'Semua' }]}
        />
        <SearchBox value={orders.search} onChange={orders.setSearch} placeholder="Cari kode, nama, atau meja" className="w-full sm:w-72" />
      </div>
      <StatusLegend
        items={[
          { label: 'Belum dibayar', tone: TONE.warn, text: 'Pesanan sudah dibuat tapi belum dibayar di kasir. Belum masuk laporan.' },
          { label: 'Sudah dibayar', tone: TONE.info, text: 'Sudah dibayar dan sedang dimasak. Sudah masuk laporan.' },
          { label: 'Siap', tone: TONE.info, text: 'Makanan sudah jadi, menunggu diambil pembeli.' },
          { label: 'Selesai', tone: TONE.good, text: 'Sudah diambil atau diantar ke pembeli.' },
          { label: 'Dibatalkan', tone: TONE.bad, text: 'Dibatalkan setelah dibayar, sebelum uang berpindah. Tidak dihitung di penjualan.' },
          { label: 'Uang kembali', tone: TONE.bad, text: 'Uang dikembalikan ke pembeli. Tidak dihitung di penjualan.' },
          { label: 'Dibatalkan', tone: TONE.neutral, text: 'Dibatalkan sebelum dibayar.' },
          { label: 'Kedaluwarsa', tone: TONE.neutral, text: 'Tidak dibayar lebih dari 45 menit, otomatis dibatalkan.' },
        ]}
      />

      <ListCard>
                <Table className="hidden md:table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH}>Antrean</TableHead>
              <TableHead className={TH}>Waktu</TableHead>
              <TableHead className={TH}>Pelanggan</TableHead>
              <TableHead className={`${TH} hidden lg:table-cell`}>Metode</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className={`${TH} text-right`}>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.rows.map((o) => {
              const s = STATUS[o.status] ?? { label: o.status, tone: 'neutral' as Tone }
              const dead = o.status === 'VOID' || o.status === 'REFUNDED' || o.status === 'CANCELLED' || o.status === 'EXPIRED'
              return (
                <TableRow key={o.id} className="h-14 cursor-pointer" onClick={() => onOpen(o)}>
                  <TableCell className="font-mono font-semibold">{o.queue_code}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium">{dayLabel(o.business_day)}</span> <span className="text-muted-foreground tabular-nums">{clock(o.created_at)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-56 truncate">{o.customer_name}</span>
                    <span className="block text-xs text-muted-foreground">{where(o)}</span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{o.payment_method ? PAYMENT_LABEL[o.payment_method] : '—'}</TableCell>
                  <TableCell><Chip tone={s.tone}>{s.label}</Chip></TableCell>
                  <TableCell className={`text-right tabular-nums ${dead ? 'text-muted-foreground line-through' : 'font-medium'}`}>{rupiah(o.total)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
{orders.loading && orders.rows.length === 0 && <RowsSkeleton rows={8} />}

        <ul className="divide-y md:hidden">
          {orders.rows.map((o) => {
            const s = STATUS[o.status] ?? { label: o.status, tone: 'neutral' as Tone }
            return (
              <li key={o.id}>
                <button type="button" onClick={() => onOpen(o)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{o.queue_code}</span>
                      <Chip tone={s.tone}>{s.label}</Chip>
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{o.customer_name} · {where(o)} · {clock(o.created_at)}</span>
                  </span>
                  <span className="font-medium tabular-nums">{rupiah(o.total)}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {orders.rows.length === 0 && !orders.loading && (
          <div className="p-6">
            <EmptyState title={orders.search ? 'Transaksi tidak ditemukan' : 'Tidak ada transaksi'} hint={orders.search ? 'Coba kode, nama, atau meja lain.' : 'Tidak ada transaksi dengan status ini di rentang tanggal terpilih.'} />
          </div>
        )}
      </ListCard>
      <Pagination page={orders.page} pageCount={orders.pageCount} total={orders.total} pageSize={orders.pageSize} onPage={orders.setPage} loading={orders.loading} />
    </div>
  )
}

// ---------- halaman ----------
/** Laporan penjualan: satu rentang tanggal untuk ringkasan (dibanding periode lalu), transaksi, dan untung per menu. */
export function ReportPageView({ storeName, config }: { storeName: string; config: StoreConfig | null }) {
  const [preset, setPreset] = useState<Preset>('7d')
  const [[from, to], setRange] = useState<[string, string]>(rangeOf('7d'))
  const [tab, setTab] = useState('summary')
  const [report, setReport] = useState<Report | null>(null)
  const [prev, setPrev] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Order | null>(null)
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [exporting, setExporting] = useState(false)
  const [tick, setTick] = useState(0)
  // satu hari dipilih: grafik per jam, dibanding hari sebelumnya
  const single = from === to
  const [hourly, setHourly] = useState<{ cur: Paid[]; prev: Paid[] } | null>(null)
  useEffect(() => {
    if (!single) return setHourly(null)
    let alive = true
    const before = addDays(from, -1)
    void supabase.from('orders').select('paid_at,total,business_day').in('business_day', [from, before]).not('paid_at', 'is', null).in('status', ['IN_KITCHEN', 'READY', 'COMPLETED']).limit(5000).then(({ data }) => {
      if (!alive) return
      const rows = z.array(z.object({ paid_at: z.string(), total: z.number(), business_day: z.string() })).safeParse(data ?? []).data ?? []
      setHourly({ cur: rows.filter((r) => r.business_day === from), prev: rows.filter((r) => r.business_day === before) })
    })
    return () => {
      alive = false
    }
  }, [single, from, tick])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const [pf, pt] = previousRange(from, to)
    Promise.all([fetchReport(from, to), fetchReport(pf, pt).catch(() => null)])
      .then(([cur, old]) => {
        if (!alive) return
        setReport(cur)
        setPrev(old)
        setError('')
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [from, to, tick])

  const t = report?.totals
  const aov = t && t.orders > 0 ? Math.round(t.net / t.orders) : 0
  const prevAov = prev && prev.totals.orders > 0 ? Math.round(prev.totals.net / prev.totals.orders) : 0
  const reversed = report ? report.voids.amount + report.refunds.amount : 0
  const prevReversed = prev ? prev.voids.amount + prev.refunds.amount : 0
  const series = useMemo(() => (report ? dailySeries(from, to, report.daily, prev?.daily ?? []) : []), [report, prev, from, to])
  const hours = useMemo(() => (hourly ? hourlySeries(hourly.cur, hourly.prev, from === todayJakarta() ? jakartaHour(new Date().toISOString()) : undefined) : []), [hourly, from])
  const peak = busiestHour(hours)
  const methods = useMemo(() => (report?.by_method ?? []).map((m) => ({ key: m.method ?? 'LAIN', label: PAYMENT_LABEL[m.method as keyof typeof PAYMENT_LABEL] ?? 'Lainnya', orders: m.orders, net: m.net })).sort((a, b) => b.net - a.net), [report])
  const best = report?.daily.reduce<{ day: string; net: number } | null>((b, d) => (!b || d.net > b.net ? d : b), null)

  const downloadOrders = async () => {
    setExporting(true)
    try {
      const n = await exportOrders(from, to)
      toast.success(`${n} transaksi diunduh`, { description: 'Buka file CSV-nya dengan Excel atau Google Sheets.' })
    } catch {
      toast.error('Transaksi gagal diunduh', { description: 'Periksa internet, lalu coba lagi.' })
    }
    setExporting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Laporan penjualan</h1>
          <p className="mt-1 text-lg text-muted-foreground">{rangeText(from, to)} · hanya penjualan yang sudah dibayar. Pesanan batal dan uang kembali dihitung terpisah.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 border-2 text-base" disabled={!report} onClick={() => report && exportCsv(report, from, to)}>
            <Download /> Unduh ringkasan
          </Button>
          <Button variant="outline" className="h-11 border-2 text-base" disabled={exporting} onClick={() => void downloadOrders()}>
            <Download /> {exporting ? 'Menyiapkan…' : 'Unduh transaksi'}
          </Button>
        </div>
      </div>

      <RangePicker value={preset} presets={['today', '7d', '30d', 'month', 'custom']} from={from} to={to} onChange={(p, r) => { setPreset(p); setRange(r) }} />
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-4 py-3 text-base">
          <span>{error.includes('366') ? 'Rentang tanggal paling panjang 1 tahun. Pilih rentang yang lebih pendek.' : 'Laporan belum bisa dimuat. Periksa internet, lalu coba lagi.'}</span>
          <Button variant="outline" className="h-11 border-2 text-base" onClick={() => setTick((n) => n + 1)}><RotateCw /> Coba lagi</Button>
        </div>
      )}

      {!report ? (
        <StatTilesSkeleton count={4} className="grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" />
      ) : (
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <KpiGrid>
            <KpiCard index={0} label="Penjualan bersih" value={rupiah(t?.net ?? 0)} badge={<Trend cur={t?.net ?? 0} prev={prev?.totals.net ?? 0} />} title={`Harga menu ${rupiah(t?.gross ?? 0)} · diskon ${rupiah(t?.discount ?? 0)}`} hint={prev ? `Periode lalu ${rupiah(prev.totals.net)}` : 'Belum ada pembanding'} />
            <KpiCard index={1} label="Jumlah penjualan" value={String(t?.orders ?? 0)} badge={<Trend cur={t?.orders ?? 0} prev={prev?.totals.orders ?? 0} />} title={single ? (peak ? `Paling ramai pukul ${hourRange(peak.hour)}` : 'Belum ada penjualan') : best ? `Hari terbaik: ${dayLabel(best.day)}` : 'Belum ada penjualan'} hint={single ? (peak ? `${peak.orders} penjualan · ${rupiah(peak.net)}` : 'Pilih tanggal lain') : best ? rupiah(best.net) : 'Pilih rentang lain'} />
            <KpiCard index={2} label="Rata-rata per penjualan" value={rupiah(aov)} badge={<Trend cur={aov} prev={prevAov} />} title="Rata-rata belanja tiap pembeli" hint={prevAov ? `Periode lalu ${rupiah(prevAov)}` : 'Belum ada pembanding'} />
            <KpiCard index={3} label="Dibatalkan & uang kembali" value={rupiah(reversed)} tone={reversed > 0 ? 'bad' : undefined} badge={<Trend cur={reversed} prev={prevReversed} goodWhenUp={false} />} title={`${report.voids.count} void · ${report.refunds.count} refund`} hint="Rincian di tab Transaksi" />
          </KpiGrid>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b scrollbar-none">
          <TabsTrigger value="summary" className="h-12 flex-none px-4 text-base">Ringkasan</TabsTrigger>
          <TabsTrigger value="orders" className="h-12 flex-none px-4 text-base">Transaksi</TabsTrigger>
          <TabsTrigger value="profit" className="h-12 flex-none px-4 text-base">Untung per menu</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid gap-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title={single ? 'Penjualan per jam' : 'Penjualan per hari'}
              description={single ? 'Garis putus-putus = hari sebelumnya. Ketuk angka di atas untuk mengganti yang digambar.' : 'Garis putus-putus = periode sebelumnya dengan panjang yang sama.'}
              className="lg:col-span-2"
              flush
            >
              {single ? (
                hourly ? <SalesTrendChart rows={hours} mode="hour" prevLabel="Hari sebelumnya" /> : <div className="p-4"><ChartSkeleton /></div>
              ) : report ? (
                <SalesTrendChart rows={series} prevLabel="Periode lalu" />
              ) : (
                <div className="p-4"><ChartSkeleton /></div>
              )}
            </Panel>
            <Panel title="Cara bayar" description="Bagian uang masuk per cara bayar">
              {!report ? <RowsSkeleton rows={3} /> : methods.length === 0 ? <EmptyState title="Belum ada pembayaran" hint="Pilih rentang tanggal lain." /> : <MethodsChart rows={methods} />}
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Menu terlaris" description="10 teratas menurut pendapatan" className="lg:col-span-2">
              {!report ? (
                <RowsSkeleton rows={5} />
              ) : report.top_products.length === 0 ? (
                <EmptyState title="Belum ada menu terjual" hint="Pilih rentang tanggal lain." />
              ) : (
                <RankBars rows={report.top_products.slice(0, 10).map((p) => ({ name: p.name, value: p.revenue, sub: `${p.qty} terjual` }))} />
              )}
            </Panel>
            <div className="grid content-start gap-5">
              <Panel title="Per kasir" description="Siapa yang menerima pembayaran">
                {!report ? (
                  <RowsSkeleton rows={3} />
                ) : report.by_cashier.length === 0 ? (
                  <EmptyState title="Belum ada data" hint="Pilih rentang tanggal lain." />
                ) : (
                  <RankBars color="var(--chart-2)" rows={report.by_cashier.map((c) => ({ name: c.cashier === '-' ? 'Tanpa kasir' : c.cashier.split('@')[0], value: c.net, sub: `${c.orders} penjualan` }))} />
                )}
              </Panel>
              {t && (t.tax > 0 || t.service > 0 || t.rounding !== 0) && (
                <Panel title="Pajak & service">
                  <dl className="space-y-2 text-base">
                    {[['Pajak', t.tax], ['Service', t.service], ['Pembulatan', t.rounding]].map(([k, v]) => (
                      <div key={k as string} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{rupiah(v as number)}</dd></div>
                    ))}
                  </dl>
                </Panel>
              )}
            </div>
          </div>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Transactions from={from} to={to} onOpen={setOpen} />
        </TabsContent>

        <TabsContent value="profit">
          <ProfitTab from={from} to={to} />
        </TabsContent>
      </Tabs>

      <OrderDrawer order={open} onClose={() => setOpen(null)} onReprint={(o) => { setOpen(null); setReceipt(o) }} />
      {receipt && <Receipt order={receipt} store={{ name: storeName, address: config?.address, footer: config?.receipt_footer, logo: config?.logo }} onClose={() => setReceipt(null)} />}
    </div>
  )
}
