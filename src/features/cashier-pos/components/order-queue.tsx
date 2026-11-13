import { ChevronRight, ListFilter, Search, Store, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ToneBadge } from '@shared/components/tone-badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@shared/components/ui/drawer'
import { Input } from '@shared/components/ui/input'
import { rupiah } from '@shared/lib/utils'
import type { Order } from '@shared/types/contracts'

export const STATUS = {
  UNPAID: { tone: 'amber', label: 'Menunggu bayar' },
  IN_KITCHEN: { tone: 'blue', label: 'Dimasak' },
  READY: { tone: 'green', label: 'Siap diambil' },
} as const

/** Pesanan pelanggan (QR/link) tidak punya pembuat; pesanan kasir menyimpan id staf. */
export const fromCustomer = (o: Order) => o.created_by === null

// Saat ramai yang paling perlu ditangani kasir: yang menunggu bayar (paling lama dulu), lalu yang siap diambil.
const RANK: Record<string, number> = { UNPAID: 0, READY: 1, IN_KITCHEN: 2 }
export function sortQueue(orders: Order[]) {
  return [...orders].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || a.created_at.localeCompare(b.created_at))
}

export const matches = (o: Order, q: string) => !q || o.queue_code.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q)

const place = (o: Order) => (o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang')
const itemCount = (o: Order) => o.items.reduce((n, i) => n + i.qty, 0)

function QueueCard({ o, selected, onPick }: { o: Order; selected: boolean; onPick: (id: string) => void }) {
  const s = STATUS[o.status as keyof typeof STATUS]
  const clickable = o.status === 'UNPAID'
  return (
    <Button
      variant="ghost"
      disabled={!clickable}
      onClick={() => onPick(o.id)}
      className="h-auto w-44 shrink-0 justify-start whitespace-normal rounded-xl bg-transparent p-0 text-left font-normal hover:bg-transparent disabled:opacity-100"
    >
      <Card size="sm" className={`w-full ${selected ? 'ring-2 ring-primary' : clickable ? 'transition hover:ring-primary/40' : ''}`}>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-base font-bold">{o.queue_code}</span>
            <span className="text-sm text-muted-foreground">{itemCount(o)} barang</span>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {o.customer_name} · {place(o)}
          </p>
          {s && <ToneBadge tone={s.tone} className="mt-1.5 h-7 w-full justify-center text-sm">{s.label}</ToneBadge>}
        </CardContent>
      </Card>
    </Button>
  )
}

/** Satu baris antrean (pelanggan atau kasir): maksimal `limit` kartu, sisanya lewat "Lihat semua". */
export function QueueSection({
  source,
  orders,
  selectedId,
  onPick,
  onShowAll,
  limit = 10,
}: {
  source: 'customer' | 'cashier'
  orders: Order[]
  selectedId: string | null
  onPick: (id: string) => void
  onShowAll: () => void
  limit?: number
}) {
  const Icon = source === 'customer' ? UserRound : Store
  const title = source === 'customer' ? 'Dari pelanggan' : 'Dibuat kasir'
  const unpaid = orders.filter((o) => o.status === 'UNPAID').length
  const shown = orders.slice(0, limit)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
        <h3 className="text-base font-bold">{title}</h3>
        <span className="text-sm text-muted-foreground">
          {orders.length} pesanan{unpaid > 0 && <> · <span className="font-semibold text-amber-700 dark:text-amber-400">{unpaid} menunggu bayar</span></>}
        </span>
        {orders.length > limit && (
          <Button variant="ghost" className="ml-auto h-10 px-3 text-sm font-semibold text-primary" onClick={onShowAll}>
            Lihat semua ({orders.length}) <ChevronRight />
          </Button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-4 text-base text-muted-foreground">
          {source === 'customer' ? 'Belum ada pesanan dari pelanggan. Pesanan lewat QR meja akan muncul di sini.' : 'Belum ada pesanan dari kasir. Pesanan yang kamu simpan akan muncul di sini.'}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {shown.map((o) => (
            <QueueCard key={o.id} o={o} selected={o.id === selectedId} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  )
}

type SourceFilter = 'all' | 'customer' | 'cashier'
type StatusFilter = 'all' | keyof typeof STATUS

const waited = (iso: string, now: number) => {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : `${Math.floor(m / 60)} jam ${m % 60} mnt lalu`
}
const itemsText = (o: Order) => o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')

const TILE: Record<keyof typeof STATUS, { ring: string; num: string }> = {
  UNPAID: { ring: 'border-amber-400 bg-amber-50 dark:bg-amber-500/10', num: 'text-amber-700 dark:text-amber-400' },
  READY: { ring: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', num: 'text-emerald-700 dark:text-emerald-400' },
  IN_KITCHEN: { ring: 'border-sky-500 bg-sky-50 dark:bg-sky-500/10', num: 'text-sky-700 dark:text-sky-400' },
}

function OrderRow({ o, now, onPay }: { o: Order; now: number; onPay: (id: string) => void }) {
  const s = STATUS[o.status as keyof typeof STATUS]
  const unpaid = o.status === 'UNPAID'
  return (
    <li className={`flex items-center gap-4 rounded-2xl border-2 bg-card p-4 ${unpaid ? 'border-amber-300 dark:border-amber-500/40' : ''}`}>
      <span className="grid h-14 min-w-20 shrink-0 place-items-center rounded-xl bg-muted px-2 font-mono text-lg font-bold">{o.queue_code}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-x-2 text-lg font-bold">
          <span className="truncate">{o.customer_name}</span>
          <span className="text-base font-medium text-muted-foreground">· {place(o)}</span>
        </p>
        <p className="truncate text-base text-muted-foreground" title={itemsText(o)}>{itemsText(o) || `${itemCount(o)} barang`}</p>
        <p className="text-sm text-muted-foreground">Masuk {waited(o.created_at, now)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-lg font-bold tabular-nums">{rupiah(o.total)}</span>
        {unpaid ? (
          <Button className="h-11 px-5 text-base font-bold" onClick={() => onPay(o.id)}>Terima bayar</Button>
        ) : (
          s && <ToneBadge tone={s.tone} className="h-8 px-3 text-sm">{s.label}</ToneBadge>
        )}
      </div>
    </li>
  )
}

function Group({ title, icon: Icon, rows, now, onPay }: { title: string; icon: typeof Store; rows: Order[]; now: number; onPay: (id: string) => void }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5 text-muted-foreground" aria-hidden /> {title}
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold tabular-nums">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed px-4 py-5 text-base text-muted-foreground">Tidak ada pesanan di sini.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => <OrderRow key={o.id} o={o} now={now} onPay={onPay} />)}
        </ul>
      )}
    </section>
  )
}

/** Semua pesanan aktif: ringkasan per status, dipisah pelanggan & kasir, cari kode/nama, terima bayar langsung. */
export function AllOrdersDrawer({
  open,
  onOpenChange,
  orders,
  initialSource = 'all',
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orders: Order[]
  initialSource?: SourceFilter
  onPick: (id: string) => void
}) {
  const [source, setSource] = useState<SourceFilter>(initialSource)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [lastInitial, setLastInitial] = useState(initialSource)
  if (lastInitial !== initialSource) {
    setLastInitial(initialSource)
    setSource(initialSource)
  }
  const now = useMemo(() => Date.now(), [orders, open])

  const q = query.trim().toLowerCase()
  const bySource = (o: Order) => source === 'all' || (source === 'customer') === fromCustomer(o)
  const rows = useMemo(
    () => sortQueue(orders).filter((o) => (source === 'all' || (source === 'customer') === fromCustomer(o)) && (status === 'all' || o.status === status) && matches(o, q)),
    [orders, source, status, q],
  )
  const countStatus = (st: keyof typeof STATUS) => orders.filter((o) => bySource(o) && o.status === st).length
  const countSource = (src: SourceFilter) => orders.filter((o) => src === 'all' || (src === 'customer') === fromCustomer(o)).length
  const pay = (id: string) => {
    onPick(id)
    onOpenChange(false)
  }

  const SOURCES = [
    { v: 'all', label: 'Semua', icon: ListFilter },
    { v: 'customer', label: 'Dari pelanggan', icon: UserRound },
    { v: 'cashier', label: 'Dibuat kasir', icon: Store },
  ] as const

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent size="md">
        <DrawerHeader className="flex-row items-start gap-3 border-b px-6 py-5 text-left">
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-2xl font-extrabold">Semua pesanan</DrawerTitle>
            <DrawerDescription className="text-base">Pesanan yang belum selesai. Tekan “Terima bayar” untuk membayar.</DrawerDescription>
          </div>
          <DrawerClose render={<Button variant="outline" className="h-11 shrink-0 px-4 text-base" />}>
            <X /> Tutup
          </DrawerClose>
        </DrawerHeader>

        <div className="space-y-4 border-b px-6 py-4">
          <div className="grid grid-cols-3 gap-3" role="group" aria-label="Saring menurut status">
            {(['UNPAID', 'READY', 'IN_KITCHEN'] as const).map((st) => {
              const on = status === st
              return (
                <button
                  key={st}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStatus(on ? 'all' : st)}
                  className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${on ? TILE[st].ring : 'bg-card hover:bg-muted'}`}
                >
                  <span className="block text-base font-semibold text-muted-foreground">{STATUS[st].label}</span>
                  <span className={`block text-3xl font-extrabold tabular-nums ${TILE[st].num}`}>{countStatus(st)}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border-2 bg-muted/50 p-1" role="group" aria-label="Sumber pesanan">
              {SOURCES.map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={source === v}
                  onClick={() => setSource(v)}
                  className={`inline-flex h-11 items-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors ${source === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="size-4" aria-hidden /> {label} <span className="tabular-nums opacity-70">{countSource(v)}</span>
                </button>
              ))}
            </div>
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode (042) atau nama…" aria-label="Cari di semua pesanan" className="h-12 pl-11 text-base" />
            </div>
          </div>
          {status !== 'all' && (
            <p className="text-base">
              Hanya menampilkan <strong>{STATUS[status].label.toLowerCase()}</strong>.{' '}
              <button type="button" className="font-semibold text-primary underline" onClick={() => setStatus('all')}>Tampilkan semua status</button>
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/30 px-6 py-5">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-lg text-muted-foreground">Tidak ada pesanan yang cocok. Coba ganti pilihan di atas atau hapus kata pencarian.</p>
          ) : (
            <>
              {source !== 'cashier' && <Group title="Dari pelanggan" icon={UserRound} rows={rows.filter(fromCustomer)} now={now} onPay={pay} />}
              {source !== 'customer' && <Group title="Dibuat kasir" icon={Store} rows={rows.filter((o) => !fromCustomer(o))} now={now} onPay={pay} />}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
