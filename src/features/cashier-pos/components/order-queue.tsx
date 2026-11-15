import { Check, ListFilter, Search, Store, TriangleAlert, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ToneBadge } from '@shared/components/tone-badge'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { isOverdue } from '@shared/lib/kitchen-alerts'
import { rupiah, timeJakarta } from '@shared/lib/utils'
import type { Order } from '@shared/types/contracts'

export const STATUS = {
  UNPAID: { tone: 'amber', label: 'Menunggu bayar' },
  IN_KITCHEN: { tone: 'blue', label: 'Sudah dibayar' },
  READY: { tone: 'green', label: 'Siap diambil' },
} as const

/** Pesanan pelanggan (QR/link) tidak punya pembuat; pesanan kasir menyimpan id staf. */
export const fromCustomer = (o: Order) => o.created_by === null

// Saat ramai yang paling perlu ditangani kasir: yang menunggu bayar (paling lama dulu), lalu yang siap diambil.
const RANK: Record<string, number> = { UNPAID: 0, READY: 1, IN_KITCHEN: 2 }
/** `late`: pesanan lewat waktu selalu paling atas (paling lama dulu), supaya tidak terlewat. */
export function sortQueue(orders: Order[], late: (o: Order) => boolean = () => false) {
  return [...orders].sort((a, b) => Number(late(b)) - Number(late(a)) || (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || (a.paid_at ?? a.created_at).localeCompare(b.paid_at ?? b.created_at))
}
const dur = (m: number) => (m < 60 ? `${m} menit` : `${Math.floor(m / 60)} jam ${m % 60} menit`)

export const matches = (o: Order, q: string) => !q || o.queue_code.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q)

export const place = (o: Order) => (o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang')
export const itemCount = (o: Order) => o.items.reduce((n, i) => n + i.qty, 0)

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

/** Aksi di tiap pesanan. `useKitchen` false: kasir/pelayan yang menandai "Sudah siap". */
export type QueueActions = {
  onPay: (id: string) => void
  onAdvance: (o: Order) => Promise<void>
  /** centang satu menu sudah jadi (dipakai kasir bila layar dapur dimatikan) */
  onItem: (o: Order, index: number, done: boolean) => Promise<void>
  useKitchen: boolean
  cookMinutes: number
}

function OrderRow({ o, now, act }: { o: Order; now: number; act: QueueActions }) {
  const s = STATUS[o.status as keyof typeof STATUS]
  const [busy, setBusy] = useState(false)
  const unpaid = o.status === 'UNPAID'
  const cooking = o.status === 'IN_KITCHEN'
  const mins = Math.floor((now - new Date(o.paid_at ?? o.created_at).getTime()) / 60_000)
  const late = isOverdue(o, now, act.cookMinutes)
  const advance = async () => {
    setBusy(true)
    await act.onAdvance(o)
    setBusy(false)
  }
  const border = unpaid ? 'border-amber-300 dark:border-amber-500/40' : late ? 'border-red-400 bg-red-50/60 dark:bg-red-500/10' : ''
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border-2 bg-card p-4 ${border}`}>
      <span className="grid h-14 min-w-20 shrink-0 place-items-center rounded-xl bg-muted px-2 font-mono text-lg font-bold">{o.queue_code}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-x-2 text-lg font-bold">
          <span className="truncate">{o.customer_name}</span>
          <span className="text-base font-medium text-muted-foreground">· {place(o)}</span>
        </p>
        <p className="truncate text-base text-muted-foreground" title={itemsText(o)}>{itemsText(o) || `${itemCount(o)} barang`}</p>
        {late ? (
          <p className="flex items-center gap-1.5 text-base font-bold text-red-700 dark:text-red-300">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> Belum diantar · dibayar pukul {timeJakarta(o.paid_at ?? o.created_at)} ({dur(mins)} lalu)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Masuk {waited(o.created_at, now)}</p>
        )}
        {cooking && o.items.length > 1 && (
          <p className="text-base font-semibold text-sky-800 dark:text-sky-300">{o.items_done.length} dari {o.items.length} menu sudah jadi</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-lg font-bold tabular-nums">{rupiah(o.total)}</span>
        {unpaid ? (
          <Button className="h-11 px-5 text-base font-bold" aria-label={`Terima bayar ${o.queue_code}`} onClick={() => act.onPay(o.id)}>Terima bayar</Button>
        ) : cooking && !act.useKitchen ? (
          <Button variant="outline" disabled={busy} className="h-11 border-2 px-5 text-base font-bold" aria-label={`Sudah siap ${o.queue_code}`} onClick={advance}>
            {busy ? 'Menyimpan…' : 'Sudah siap'}
          </Button>
        ) : o.status === 'READY' ? (
          <Button variant="outline" disabled={busy} className="h-11 border-2 border-emerald-500 px-5 text-base font-bold text-emerald-800 dark:text-emerald-300" aria-label={`Sudah diambil ${o.queue_code}`} onClick={advance}>
            {busy ? 'Menyimpan…' : 'Sudah diambil'}
          </Button>
        ) : (
          s && !cooking && <ToneBadge tone={s.tone} className="h-8 px-3 text-sm">{s.label}</ToneBadge>
        )}
      </div>
      {cooking && !act.useKitchen && o.items.length > 1 && (
        <ul className="flex w-full flex-wrap gap-2 border-t pt-3" aria-label={`Menu ${o.queue_code}`}>
          {o.items.map((i, n) => {
            const done = o.items_done.includes(n)
            return (
              <li key={n}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  onClick={() => void act.onItem(o, n, !done)}
                  className={`inline-flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 text-base font-semibold ${done ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-card hover:bg-muted'}`}
                >
                  <span className={`grid size-6 place-items-center rounded-md border-2 ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-foreground/40'}`}>{done && <Check className="size-4" aria-hidden />}</span>
                  {i.qty}× {i.name}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function Group({ title, icon: Icon, rows, now, act }: { title: string; icon: typeof Store; rows: Order[]; now: number; act: QueueActions }) {
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
          {rows.map((o) => <OrderRow key={o.id} o={o} now={now} act={act} />)}
        </ul>
      )}
    </section>
  )
}

type SourceFilter = 'all' | 'customer' | 'cashier'
type StatusFilter = 'all' | keyof typeof STATUS

/**
 * Papan antrean (halaman Antrean): ringkasan per status, pesanan pelanggan & kasir dipisah,
 * cari kode/nama, dan "Terima bayar" yang membuka layar Jualan dengan pesanan itu terpilih.
 * Layar lebar & tablet landscape: dua kolom berdampingan. Tablet portrait & HP: bertumpuk.
 */
export function OrdersBoard({ orders, loading, act }: { orders: Order[]; loading: boolean; act: QueueActions }) {
  const [source, setSource] = useState<SourceFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  // detik berjalan supaya tanda "lewat waktu masak" muncul tanpa menunggu perubahan pesanan
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const q = query.trim().toLowerCase()
  const bySource = (o: Order) => source === 'all' || (source === 'customer') === fromCustomer(o)
  const late = (o: Order) => isOverdue(o, now, act.cookMinutes)
  const overdue = sortQueue(orders.filter(late), late)
  const rows = sortQueue(orders, late).filter((o) => bySource(o) && (status === 'all' || o.status === status) && matches(o, q))
  const countStatus = (st: keyof typeof STATUS) => orders.filter((o) => bySource(o) && o.status === st).length
  const countSource = (src: SourceFilter) => orders.filter((o) => src === 'all' || (src === 'customer') === fromCustomer(o)).length

  const SOURCES = [
    { v: 'all', label: 'Semua', icon: ListFilter },
    { v: 'customer', label: 'Dari pelanggan', icon: UserRound },
    { v: 'cashier', label: 'Dibuat kasir', icon: Store },
  ] as const
  const both = source === 'all'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Antrean pesanan</h1>
        <p className="mt-1 text-lg text-muted-foreground">Pesanan yang belum selesai. Tekan “Terima bayar” untuk membayar di layar Jualan.{act.useKitchen ? '' : ' Tandai “Sudah siap” saat makanan selesai dimasak.'}</p>
      </div>

      {overdue.length > 0 && (
        <div role="status" className="rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-3 dark:bg-red-500/10">
          <p className="flex items-center gap-2 text-lg font-extrabold text-red-800 dark:text-red-200">
            <TriangleAlert className="size-5 shrink-0" aria-hidden /> {overdue.length} pesanan belum diantar, sudah lewat {act.cookMinutes} menit
          </p>
          <p className="mt-1 text-base text-red-900 dark:text-red-100">
            {overdue.map((o) => `${place(o)} (${o.queue_code})`).join(' · ')}. Cek ke dapur, antar pesanannya, lalu tekan tombol di pesanan itu.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Saring menurut status">
        {(['UNPAID', 'READY'] as const).map((st) => {
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
        <div className="inline-flex flex-wrap rounded-xl border-2 bg-muted/50 p-1" role="group" aria-label="Sumber pesanan">
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
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode (042) atau nama…" aria-label="Cari di antrean" className="h-12 pl-11 text-base" />
        </div>
      </div>
      {status !== 'all' && (
        <p className="text-base">
          Hanya menampilkan <strong>{STATUS[status].label.toLowerCase()}</strong>.{' '}
          <button type="button" className="font-semibold text-primary underline" onClick={() => setStatus('all')}>Tampilkan semua status</button>
        </p>
      )}

      {loading && orders.length === 0 ? (
        <p className="py-12 text-center text-lg text-muted-foreground">Memuat antrean…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed px-6 py-12 text-center">
          <p className="text-xl font-bold">Belum ada pesanan</p>
          <p className="mt-1 text-lg text-muted-foreground">Pesanan dari QR meja dan yang dibuat kasir akan muncul di sini.</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${both ? 'lg:grid-cols-2' : ''}`}>
          {source !== 'cashier' && <Group title="Dari pelanggan" icon={UserRound} rows={rows.filter(fromCustomer)} now={now} act={act} />}
          {source !== 'customer' && <Group title="Dibuat kasir" icon={Store} rows={rows.filter((o) => !fromCustomer(o))} now={now} act={act} />}
        </div>
      )}
    </div>
  )
}
