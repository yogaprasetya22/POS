import { Download, Printer } from 'lucide-react'
import { ProfitTab } from './profit-tab'
import { ChartSkeleton, RowsSkeleton, StatTilesSkeleton } from '@shared/components/skeletons'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Receipt } from '@features/cashier-pos/components/receipt'
import { ErrorAlert } from '@shared/components/error-alert'
import { Chip, FilterChips, ListCard, PageHeader, SectionCard, StatTile, type Tone } from '@shared/components/page'
import { EmptyState, Pagination, SearchBox } from '@shared/components/pagination'
import { Button } from '@shared/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@shared/components/ui/drawer'
import { Input } from '@shared/components/ui/input'
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

// ---------- tanggal ----------
export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1
export const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' })
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(n))

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom'
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'custom', label: 'Pilih tanggal' },
]
function rangeOf(p: Exclude<Preset, 'custom'>): [string, string] {
  const t = todayJakarta()
  return p === 'today' ? [t, t] : p === '7d' ? [addDays(t, -6), t] : p === '30d' ? [addDays(t, -29), t] : [t.slice(0, 8) + '01', t]
}

// ---------- data ----------
export async function fetchReport(from: string, to: string): Promise<Report> {
  const { data, error } = await rpc('sales_report', { p_from: from, p_to: to })
  if (error) throw error
  const parsed = ReportSchema.safeParse(data)
  if (!parsed.success) throw new Error('Format laporan tidak dikenali')
  return parsed.data
}

const csvCell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
function exportCsv(r: Report, from: string, to: string) {
  const method = (m: string) => PAYMENT_LABEL[m as keyof typeof PAYMENT_LABEL] ?? m
  const rows: (string | number)[][] = [
    ['Laporan penjualan', `${from} s/d ${to}`], [],
    ['Ringkasan'], ['Transaksi', r.totals.orders], ['Penjualan kotor', r.totals.gross], ['Diskon', r.totals.discount], ['Service', r.totals.service],
    ['Pajak', r.totals.tax], ['Pembulatan', r.totals.rounding], ['Penjualan bersih', r.totals.net],
    ['Void (jumlah)', r.voids.count], ['Void (nilai)', r.voids.amount], ['Refund (jumlah)', r.refunds.count], ['Refund (nilai)', r.refunds.amount], [],
    ['Per hari'], ['Tanggal', 'Transaksi', 'Penjualan bersih'], ...r.daily.map((d) => [d.day, d.orders, d.net]), [],
    ['Per metode bayar'], ['Metode', 'Transaksi', 'Penjualan bersih'], ...r.by_method.map((m) => [method(m.method), m.orders, m.net]), [],
    ['Per kasir'], ['Kasir', 'Transaksi', 'Penjualan bersih'], ...r.by_cashier.map((c) => [c.cashier, c.orders, c.net]), [],
    ['Menu terlaris'], ['Menu', 'Jumlah', 'Pendapatan'], ...r.top_products.map((p) => [p.name, p.qty, p.revenue]),
  ]
  const blob = new Blob(['﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `laporan-${from}_${to}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ---------- potongan tampilan ----------
const METHOD_COLOR: Record<string, string> = { CASH: 'bg-emerald-500', QRIS_STATIC: 'bg-sky-500', EDC_CARD: 'bg-amber-500' }

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) return <span>belum ada pembanding</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  const up = pct >= 0
  return (
    <span className={up ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>
      {up ? '▲' : '▼'} {Math.abs(pct) > 999 ? '>999' : Math.abs(pct)}% <span className="text-muted-foreground">dari periode lalu</span>
    </span>
  )
}

function DailyChart({ report, from, to }: { report: Report; from: string; to: string }) {
  const n = daysBetween(from, to)
  const byDay = new Map(report.daily.map((d) => [d.day, d]))
  // rentang pendek: isi hari tanpa penjualan supaya grafik utuh; rentang panjang: hanya hari yang ada penjualan
  const days = n <= 62 ? Array.from({ length: n }, (_, i) => addDays(from, i)) : report.daily.map((d) => d.day)
  const points = days.map((d) => ({ day: d, net: byDay.get(d)?.net ?? 0, orders: byDay.get(d)?.orders ?? 0 }))
  const max = Math.max(1, ...points.map((p) => p.net))
  const step = Math.ceil(points.length / 10)
  if (report.daily.length === 0) return <EmptyState title="Belum ada penjualan" hint="Tidak ada transaksi terbayar di rentang tanggal ini." />
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{compact(max)}</span>
        <div className="flex h-44 flex-1 items-end gap-1 border-b border-l pl-1">
          {points.map((p) => (
            <div key={p.day} className="flex h-full min-w-0 flex-1 items-end" title={`${dayLabel(p.day)} · ${rupiah(p.net)} · ${p.orders} transaksi`}>
              <div className="w-full rounded-t bg-primary/80 transition-colors hover:bg-primary" style={{ height: p.net ? `${Math.max(3, (p.net / max) * 100)}%` : '2px', opacity: p.net ? 1 : 0.25 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1 pl-[3.75rem]">
        {points.map((p, i) => (
          <span key={p.day} className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground tabular-nums">
            {i % step === 0 ? (n <= 10 ? dayLabel(p.day) : p.day.slice(8)) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function Methods({ report }: { report: Report }) {
  const total = report.by_method.reduce((a, m) => a + m.net, 0)
  if (total === 0) return <EmptyState title="Belum ada pembayaran" />
  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {report.by_method.map((m) => <span key={m.method} className={METHOD_COLOR[m.method] ?? 'bg-muted-foreground'} style={{ width: `${(m.net / total) * 100}%` }} />)}
      </div>
      <ul className="space-y-2.5 text-sm">
        {report.by_method.map((m) => (
          <li key={m.method} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${METHOD_COLOR[m.method] ?? 'bg-muted-foreground'}`} />
              {PAYMENT_LABEL[m.method as keyof typeof PAYMENT_LABEL] ?? m.method}
              <span className="text-muted-foreground">{m.orders}×</span>
            </span>
            <span className="tabular-nums"><span className="font-medium">{rupiah(m.net)}</span> <span className="text-muted-foreground">· {Math.round((m.net / total) * 100)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const TH = 'h-11 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground'

function TopProducts({ report }: { report: Report }) {
  const max = Math.max(1, ...report.top_products.map((p) => p.revenue))
  if (report.top_products.length === 0) return <EmptyState title="Belum ada menu terjual" />
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${TH} w-10`}>#</TableHead>
          <TableHead className={TH}>Menu</TableHead>
          <TableHead className={`${TH} text-right`}>Terjual</TableHead>
          <TableHead className={`${TH} text-right`}>Pendapatan</TableHead>
          <TableHead className={`${TH} hidden w-32 md:table-cell`}><span className="sr-only">Porsi</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.top_products.slice(0, 10).map((p, i) => (
          <TableRow key={p.name} className="h-12">
            <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
            <TableCell className="max-w-0 truncate font-medium">{p.name}</TableCell>
            <TableCell className="text-right tabular-nums">{p.qty}×</TableCell>
            <TableCell className="text-right tabular-nums">{rupiah(p.revenue)}</TableCell>
            <TableCell className="hidden md:table-cell"><span className="block h-2 rounded-full bg-muted"><span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(p.revenue / max) * 100}%` }} /></span></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

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
  VOID: { label: 'Void', tone: 'bad' },
  REFUNDED: { label: 'Refund', tone: 'bad' },
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
          options={[{ value: 'paid', label: 'Terbayar' }, { value: 'reversed', label: 'Void & refund' }, { value: 'other', label: 'Batal & belum bayar' }, { value: 'all', label: 'Semua' }]}
        />
        <SearchBox value={orders.search} onChange={orders.setSearch} placeholder="Cari kode, nama, atau meja" className="w-full sm:w-72" />
      </div>

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
/** Laporan penjualan: satu rentang tanggal untuk ringkasan (dibanding periode lalu) dan daftar transaksi. */
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

  useEffect(() => {
    let alive = true
    setLoading(true)
    const len = daysBetween(from, to)
    const prevTo = addDays(from, -1)
    Promise.all([fetchReport(from, to), fetchReport(addDays(prevTo, -(len - 1)), prevTo).catch(() => null)])
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
  }, [from, to])

  const pick = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setRange(rangeOf(p))
  }
  const t = report?.totals
  const aov = t && t.orders > 0 ? Math.round(t.net / t.orders) : 0
  const prevAov = prev && prev.totals.orders > 0 ? Math.round(prev.totals.net / prev.totals.orders) : 0
  const reversed = useMemo(() => (report ? report.voids.amount + report.refunds.amount : 0), [report])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan penjualan"
        description={`${dayLabel(from)}${from !== to ? ` – ${dayLabel(to)}` : ''}${to.slice(0, 4) !== String(new Date().getFullYear()) ? ` ${to.slice(0, 4)}` : ''} · hanya transaksi terbayar; void dan refund dipisahkan.`}
        actions={
          <Button variant="outline" className="h-11" disabled={!report} onClick={() => report && exportCsv(report, from, to)}>
            <Download /> Ekspor CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FilterChips id="range" label="Rentang tanggal" value={preset} onChange={pick} options={PRESETS} />
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Dari tanggal" value={from} max={to} onChange={(e) => e.target.value && setRange([e.target.value, to])} className="h-10 w-40" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" aria-label="Sampai tanggal" value={to} min={from} max={todayJakarta()} onChange={(e) => e.target.value && setRange([from, e.target.value])} className="h-10 w-40" />
          </div>
        )}
      </div>
      <ErrorAlert message={error} />

      {!report ? (
        <StatTilesSkeleton />
      ) : (
      <div className={`grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
        <StatTile index={0} label="Penjualan bersih" value={rupiah(t?.net ?? 0)} hint={t && <Delta cur={t.net} prev={prev?.totals.net ?? 0} />} />
        <StatTile index={1} label="Transaksi" value={String(t?.orders ?? 0)} hint={t && <Delta cur={t.orders} prev={prev?.totals.orders ?? 0} />} />
        <StatTile index={2} label="Rata-rata per transaksi" value={rupiah(aov)} hint={t && <Delta cur={aov} prev={prevAov} />} />
        <StatTile index={3} label="Void & refund" value={rupiah(reversed)} tone={reversed > 0 ? 'bad' : undefined} hint={report && `${report.voids.count} void · ${report.refunds.count} refund`} />
      </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="summary" className="h-11 flex-none px-4">Ringkasan</TabsTrigger>
          <TabsTrigger value="orders" className="h-11 flex-none px-4">Transaksi</TabsTrigger>
          <TabsTrigger value="profit" className="h-11 flex-none px-4">Untung per menu</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {!report && (
            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard title="Penjualan per hari" className="xl:col-span-2"><ChartSkeleton /></SectionCard>
              <SectionCard title="Metode pembayaran"><RowsSkeleton rows={3} className="-mx-4" /></SectionCard>
            </div>
          )}
          {report && (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                <SectionCard title="Penjualan per hari" hint={t && `Kotor ${rupiah(t.gross)} · diskon ${rupiah(t.discount)}`} className="xl:col-span-2">
                  <DailyChart report={report} from={from} to={to} />
                </SectionCard>
                <SectionCard title="Metode pembayaran">
                  <Methods report={report} />
                </SectionCard>
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <SectionCard title="Menu terlaris" hint="10 teratas menurut pendapatan" className="xl:col-span-2 [&>div]:p-0">
                  <TopProducts report={report} />
                </SectionCard>
                <div className="space-y-4">
                  <SectionCard title="Per kasir">
                    {report.by_cashier.length === 0 ? (
                      <EmptyState title="Belum ada data" />
                    ) : (
                      <ul className="space-y-3 text-sm">
                        {report.by_cashier.map((c) => (
                          <li key={c.cashier}>
                            <div className="flex justify-between gap-3">
                              <span className="truncate">{c.cashier === '-' ? 'Tanpa kasir tercatat' : c.cashier} <span className="text-muted-foreground">· {c.orders}×</span></span>
                              <span className="font-medium tabular-nums">{rupiah(c.net)}</span>
                            </div>
                            <span className="mt-1 block h-1.5 rounded-full bg-muted"><span className="block h-1.5 rounded-full bg-primary/70" style={{ width: `${(c.net / Math.max(1, report.by_cashier[0].net)) * 100}%` }} /></span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </SectionCard>
                  {t && (t.tax > 0 || t.service > 0 || t.rounding !== 0) && (
                    <SectionCard title="Pajak & service">
                      <dl className="space-y-1.5 text-sm">
                        {[['Pajak', t.tax], ['Service', t.service], ['Pembulatan', t.rounding]].map(([k, v]) => (
                          <div key={k as string} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums">{rupiah(v as number)}</dd></div>
                        ))}
                      </dl>
                    </SectionCard>
                  )}
                </div>
              </div>
            </>
          )}
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
