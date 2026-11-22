import {
  ArrowDownWideNarrow,
  Check,
  ChefHat,
  Clock,
  HandPlatter,
  LayoutGrid,
  List,
  ListFilter,
  Search,
  ShoppingBag,
  Store,
  TriangleAlert,
  UserRound,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ToneBadge } from '@shared/components/tone-badge'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { isOverdue } from '@shared/lib/kitchen-alerts'
import { rupiah, timeJakarta } from '@shared/lib/utils'
import type { Order } from '@shared/types/contracts'

export const STATUS = {
  UNPAID: { tone: 'amber', label: 'Menunggu bayar' },
  IN_KITCHEN: { tone: 'blue', label: 'Sedang disiapkan' },
  READY: { tone: 'green', label: 'Siap diambil' },
} as const
type St = keyof typeof STATUS
const FLOW: St[] = ['UNPAID', 'IN_KITCHEN', 'READY']

/** Pesanan pelanggan (QR/link) tidak punya pembuat; pesanan kasir menyimpan id staf. */
export const fromCustomer = (o: Order) => o.created_by === null

/** Cek apakah pesanan berasal dari pembeli yang memilih pembayaran QRIS dan masih menunggu scan */
export const isCustomerQrisPending = (o: Order) => {
  if (o.status !== 'UNPAID') return false
  if (!fromCustomer(o)) return false
  return (
    o.midtrans_payment_type === 'qris' ||
    (Boolean(o.midtrans_snap_token) && o.midtrans_payment_type !== 'cashier') ||
    o.midtrans_status === 'pending'
  )
}

// Saat ramai yang paling perlu ditangani kasir: yang menunggu bayar (paling lama dulu), lalu yang siap diambil.
const RANK: Record<string, number> = { UNPAID: 0, READY: 1, IN_KITCHEN: 2 }
/** `late`: pesanan lewat waktu selalu paling atas (paling lama dulu), supaya tidak terlewat. */
export function sortQueue(orders: Order[], late: (o: Order) => boolean = () => false) {
  return [...orders].sort((a, b) => Number(late(b)) - Number(late(a)) || (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || (a.paid_at ?? a.created_at).localeCompare(b.paid_at ?? b.created_at))
}
const dur = (m: number) => (m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} j ${m % 60} mnt`)

/** Cari berdasarkan kode, nama pelanggan, nomor meja, atau nama menu. */
export const matches = (o: Order, q: string) =>
  !q ||
  o.queue_code.toLowerCase().includes(q) ||
  o.customer_name.toLowerCase().includes(q) ||
  (o.table_no ?? '').toLowerCase() === q.replace(/^meja\s*/, '') ||
  o.items.some((i) => i.name.toLowerCase().includes(q))

export const place = (o: Order) => (o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang')
export const itemCount = (o: Order) => o.items.reduce((n, i) => n + i.qty, 0)

const minsSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
const itemsText = (o: Order) => o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')

const COL: Record<St, { icon: typeof Store; head: string; dot: string; tile: string; num: string }> = {
  UNPAID: { icon: Wallet, head: 'border-amber-400', dot: 'bg-amber-500', tile: 'border-amber-400 bg-amber-50 dark:bg-amber-500/10', num: 'text-amber-700 dark:text-amber-400' },
  IN_KITCHEN: { icon: ChefHat, head: 'border-sky-500', dot: 'bg-sky-500', tile: 'border-sky-500 bg-sky-50 dark:bg-sky-500/10', num: 'text-sky-700 dark:text-sky-400' },
  READY: { icon: HandPlatter, head: 'border-emerald-500', dot: 'bg-emerald-500', tile: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', num: 'text-emerald-700 dark:text-emerald-400' },
}

/** Aksi di tiap pesanan. `useKitchen` false: kasir/pelayan yang menandai "Sudah siap". */
async function cancelOrder(o: Order, act: QueueActions) {
  if (!window.confirm(`Batalkan pesanan ${o.queue_code}${o.customer_name ? ` (${o.customer_name})` : ''}? Pesanan ini belum dibayar.`)) return
  await act.onCancel?.(o)
}

export type QueueActions = {
  onPay: (id: string) => void
  onAdvance: (o: Order) => Promise<void>
  /** batalkan pesanan yang belum dibayar */
  onCancel?: (o: Order) => Promise<void>
  /** majukan banyak pesanan sekaligus (aksi massal); fallback: onAdvance satu per satu */
  onAdvanceMany?: (orders: Order[]) => Promise<void>
  /** centang satu menu sudah jadi (dipakai kasir bila layar dapur dimatikan) */
  onItem: (o: Order, index: number, done: boolean) => Promise<void>
  useKitchen: boolean
  cookMinutes: number
}

/* ───────────────────────── Kartu pesanan ───────────────────────── */

function OrderCard({
  o,
  now,
  act,
  selected,
  onSelect,
}: {
  o: Order
  now: number
  act: QueueActions
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const unpaid = o.status === 'UNPAID'
  const cooking = o.status === 'IN_KITCHEN'
  const mins = minsSince(o.paid_at ?? o.created_at, now)
  const late = isOverdue(o, now, act.cookMinutes)
  const selectable = !unpaid
  const multi = o.items.length > 1

  const advance = async () => {
    setBusy(true)
    await act.onAdvance(o)
    setBusy(false)
  }

  const frame = selected
    ? 'border-primary ring-2 ring-primary/30'
    : late
      ? 'border-red-400 bg-red-50/70 dark:bg-red-500/10'
      : 'border-border'

  return (
    <li className={`rounded-2xl border-2 bg-card p-3 shadow-xs transition-colors ${frame}`}>
      <div className="flex items-start gap-3">
        {selectable ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`Pilih ${o.queue_code}`}
            onClick={() => onSelect(o.id)}
            className="grid h-12 min-w-16 shrink-0 place-items-center rounded-xl bg-muted px-2 font-mono text-lg font-bold hover:bg-muted/70"
          >
            {selected ? <Check className="size-6 text-primary" /> : o.queue_code}
          </button>
        ) : (
          <span className="grid h-12 min-w-16 shrink-0 place-items-center rounded-xl bg-muted px-2 font-mono text-lg font-bold">{o.queue_code}</span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold">
            <span className="truncate">{o.customer_name}</span>
            {fromCustomer(o) && <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-label="Dari pelanggan" />}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {o.order_type === 'DINE_IN' ? <UtensilsCrossed className="size-3.5" /> : <ShoppingBag className="size-3.5" />}
            {place(o)} · {itemCount(o)} item
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-bold tabular-nums">{rupiah(o.total)}</p>
          <p className={`flex items-center justify-end gap-1 text-xs font-semibold ${late ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>
            {late ? <TriangleAlert className="size-3.5" /> : <Clock className="size-3.5" />}
            {mins < 1 ? 'baru' : dur(mins)}
          </p>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground" title={itemsText(o)}>
        {itemsText(o)}
      </p>
      {late && (
        <p className="mt-1 text-xs font-bold text-red-700 dark:text-red-300">
          Lewat {act.cookMinutes} mnt · dibayar {timeJakarta(o.paid_at ?? o.created_at)}
        </p>
      )}

      {cooking && multi && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 flex w-full items-center gap-2 text-left text-xs font-semibold text-sky-800 dark:text-sky-300"
            aria-expanded={open}
          >
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-500/20">
              <span className="block h-full bg-sky-500" style={{ width: `${(o.items_done.length / o.items.length) * 100}%` }} />
            </span>
            {o.items_done.length}/{o.items.length} menu jadi {open ? '▴' : '▾'}
          </button>
          {open && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Menu ${o.queue_code}`}>
              {o.items.map((i, n) => {
                const done = o.items_done.includes(n)
                return (
                  <li key={n}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      onClick={() => void act.onItem(o, n, !done)}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 px-2.5 text-sm font-semibold ${done ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-card hover:bg-muted'}`}
                    >
                      <span className={`grid size-5 place-items-center rounded border-2 ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-foreground/40'}`}>
                        {done && <Check className="size-3.5" aria-hidden />}
                      </span>
                      {i.qty}× {i.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <div className="mt-3">
        {unpaid ? (
          <>
          {isCustomerQrisPending(o) ? (
            <div className="flex items-center justify-between gap-2">
              <ToneBadge tone="amber" className="flex h-10 items-center gap-1.5 px-3 text-sm font-bold">
                <Clock className="size-3.5 animate-pulse" /> Menunggu QRIS
              </ToneBadge>
              <button type="button" onClick={() => act.onPay(o.id)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                Bayar di kasir
              </button>
            </div>
          ) : (
            <Button className="h-11 w-full text-base font-bold" aria-label={`Terima bayar ${o.queue_code}`} onClick={() => act.onPay(o.id)}>
              Terima bayar
            </Button>
          )}
          {act.onCancel && (
            <button
              type="button"
              onClick={() => void cancelOrder(o, act)}
              className="mt-2 w-full rounded-lg py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Batalkan pesanan
            </button>
          )}
          </>
        ) : cooking ? (
          <Button
            disabled={busy}
            className="h-11 w-full bg-sky-600 text-base font-bold text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
            aria-label={`Makanan siap ${o.queue_code}`}
            onClick={advance}
          >
            {busy ? 'Menyimpan…' : 'Makanan siap'}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            className="h-11 w-full border-2 border-emerald-500 bg-emerald-50/50 text-base font-bold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            aria-label={`Sudah diambil ${o.queue_code}`}
            onClick={advance}
          >
            {busy ? 'Menyimpan…' : 'Sudah diambil'}
          </Button>
        )}
      </div>
    </li>
  )
}

/* ───────────────────────── Kolom status ───────────────────────── */

const PAGE = 30

function Column({
  st,
  rows,
  now,
  act,
  selected,
  onSelect,
  onSelectAll,
  tall,
}: {
  st: St
  rows: Order[]
  now: number
  act: QueueActions
  selected: Set<string>
  onSelect: (id: string) => void
  onSelectAll: (ids: string[], on: boolean) => void
  tall: boolean
}) {
  const [limit, setLimit] = useState(PAGE)
  const c = COL[st]
  const Icon = c.icon
  const shown = rows.slice(0, limit)
  const ids = rows.map((o) => o.id)
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
  const lateCount = rows.filter((o) => isOverdue(o, now, act.cookMinutes)).length

  return (
    <section className="flex min-w-0 flex-col rounded-3xl border-2 bg-muted/30" aria-label={STATUS[st].label}>
      <header className={`flex items-center justify-between gap-2 rounded-t-3xl border-b-4 bg-card px-4 py-3 ${c.head}`}>
        <h3 className="flex items-center gap-2 text-base font-extrabold">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
          {STATUS[st].label}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm tabular-nums">{rows.length}</span>
          {lateCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">{lateCount} telat</span>}
        </h3>
        {st !== 'UNPAID' && rows.length > 0 && (
          <button type="button" onClick={() => onSelectAll(ids, !allOn)} className="text-xs font-semibold text-primary hover:underline">
            {allOn ? 'Batal pilih' : 'Pilih semua'}
          </button>
        )}
      </header>

      <div className={`flex-1 p-3 ${tall ? 'max-h-[calc(100vh-20rem)] min-h-64 overflow-y-auto' : ''}`}>
        {rows.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Kosong</p>
        ) : (
          <>
            <ul className="space-y-2.5">
              {shown.map((o) => (
                <OrderCard key={o.id} o={o} now={now} act={act} selected={selected.has(o.id)} onSelect={onSelect} />
              ))}
            </ul>
            {rows.length > limit && (
              <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={() => setLimit((l) => l + PAGE)}>
                Tampilkan {Math.min(PAGE, rows.length - limit)} lagi ({rows.length - limit} tersisa)
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/* ───────────────────────── Papan utama ───────────────────────── */

type SourceFilter = 'all' | 'customer' | 'cashier'
type TypeFilter = 'all' | 'DINE_IN' | 'TAKEAWAY'
type View = 'board' | 'list'
type Sort = 'priority' | 'oldest' | 'newest'

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; icon?: typeof Store; count?: number }[]; label: string }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border-2 bg-muted/50 p-1" role="group" aria-label={label}>
      {options.map(({ v, label: l, icon: Icon, count }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${value === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {Icon && <Icon className="size-4" aria-hidden />} {l}
          {count !== undefined && <span className="tabular-nums opacity-70">{count}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * Papan antrean: alur kerja per status (bayar → disiapkan → siap diambil), dibuat untuk jam ramai:
 * filter sumber & jenis pesanan, cari kode/nama/meja/menu, pilih banyak + aksi massal,
 * kolom bergulir sendiri, dan render bertahap supaya ratusan pesanan tetap ringan.
 */
export function OrdersBoard({ orders, loading, act }: { orders: Order[]; loading: boolean; act: QueueActions }) {
  const [source, setSource] = useState<SourceFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [view, setView] = useState<View>('board')
  const [sort, setSort] = useState<Sort>('priority')
  const [onlyLate, setOnlyLate] = useState(false)
  const [mobileSt, setMobileSt] = useState<St>('UNPAID')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // detik berjalan supaya tanda "lewat waktu masak" muncul tanpa menunggu perubahan pesanan
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // "/" untuk langsung mengetik di kolom cari, Esc untuk mengosongkan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input,textarea,select')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // buang pilihan untuk pesanan yang sudah pindah status / hilang
  useEffect(() => {
    setSelected((prev) => {
      const alive = new Set(orders.filter((o) => o.status !== 'UNPAID').map((o) => o.id))
      const next = new Set([...prev].filter((id) => alive.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [orders])

  const q = query.trim().toLowerCase()
  const late = (o: Order) => isOverdue(o, now, act.cookMinutes)

  const base = useMemo(
    () =>
      orders.filter(
        (o) =>
          (source === 'all' || (source === 'customer') === fromCustomer(o)) &&
          (type === 'all' || o.order_type === type) &&
          matches(o, q),
      ),
    [orders, source, type, q],
  )

  const sorted = useMemo(() => {
    const t = (o: Order) => o.paid_at ?? o.created_at
    if (sort === 'oldest') return [...base].sort((a, b) => t(a).localeCompare(t(b)))
    if (sort === 'newest') return [...base].sort((a, b) => t(b).localeCompare(t(a)))
    return sortQueue(base, late)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, sort, now])

  const visible = onlyLate ? sorted.filter(late) : sorted
  const byStatus = (st: St) => visible.filter((o) => o.status === st)
  const count = (st: St) => base.filter((o) => o.status === st).length
  const lateAll = orders.filter(late)
  const filtersOn = source !== 'all' || type !== 'all' || q !== '' || onlyLate

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev)
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)))
      return n
    })

  const picked = orders.filter((o) => selected.has(o.id))
  const pickedCooking = picked.filter((o) => o.status === 'IN_KITCHEN')
  const pickedReady = picked.filter((o) => o.status === 'READY')

  const bulk = async (list: Order[]) => {
    if (list.length === 0) return
    setBulkBusy(true)
    try {
      if (act.onAdvanceMany) await act.onAdvanceMany(list)
      else for (const o of list) await act.onAdvance(o)
      setMany(
        list.map((o) => o.id),
        false,
      )
    } finally {
      setBulkBusy(false)
    }
  }

  const resetFilters = () => {
    setSource('all')
    setType('all')
    setQuery('')
    setOnlyLate(false)
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Judul */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Antrean pesanan
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Langsung
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            <strong className="text-foreground">{orders.length}</strong> pesanan sedang berjalan. Ketuk kode pesanan untuk memilih banyak sekaligus.
          </p>
        </div>
        <Segmented<View>
          label="Tampilan"
          value={view}
          onChange={setView}
          options={[
            { v: 'board', label: 'Papan', icon: LayoutGrid },
            { v: 'list', label: 'Daftar', icon: List },
          ]}
        />
      </div>

      {/* Ringkasan status (klik = saring) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FLOW.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setMobileSt(st)
              document.getElementById(`col-${st}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors hover:brightness-95 ${COL[st].tile}`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <span className={`size-2 rounded-full ${COL[st].dot}`} /> {STATUS[st].label}
            </span>
            <span className={`block text-3xl font-extrabold tabular-nums ${COL[st].num}`}>{count(st)}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={onlyLate}
          onClick={() => setOnlyLate((v) => !v)}
          disabled={lateAll.length === 0 && !onlyLate}
          className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-50 ${onlyLate ? 'border-red-500 bg-red-100 dark:bg-red-500/20' : 'border-red-300 bg-red-50 hover:brightness-95 dark:bg-red-500/10'}`}
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold text-red-800 dark:text-red-200">
            <TriangleAlert className="size-4" /> Lewat {act.cookMinutes} mnt
          </span>
          <span className="block text-3xl font-extrabold tabular-nums text-red-700 dark:text-red-300">{lateAll.length}</span>
          <span className="text-xs font-semibold text-red-700/80 dark:text-red-300/80">{onlyLate ? 'Ketuk untuk semua' : 'Ketuk untuk saring'}</span>
        </button>
      </div>

      {/* Alat saring */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border-2 bg-card p-2.5">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode, nama, meja, atau menu…  ( / )"
            aria-label="Cari di antrean"
            className="h-11 pl-11 pr-10 text-base"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
              <X className="size-4" />
            </button>
          )}
        </div>
        <Segmented<SourceFilter>
          label="Sumber pesanan"
          value={source}
          onChange={setSource}
          options={[
            { v: 'all', label: 'Semua', icon: ListFilter },
            { v: 'customer', label: 'Pelanggan', icon: UserRound, count: orders.filter(fromCustomer).length },
            { v: 'cashier', label: 'Kasir', icon: Store, count: orders.filter((o) => !fromCustomer(o)).length },
          ]}
        />
        <Segmented<TypeFilter>
          label="Jenis pesanan"
          value={type}
          onChange={setType}
          options={[
            { v: 'all', label: 'Semua' },
            { v: 'DINE_IN', label: 'Makan di sini', icon: UtensilsCrossed },
            { v: 'TAKEAWAY', label: 'Bawa pulang', icon: ShoppingBag },
          ]}
        />
        <label className="inline-flex h-11 items-center gap-1.5 rounded-xl border-2 bg-muted/50 px-3 text-sm font-semibold">
          <ArrowDownWideNarrow className="size-4 text-muted-foreground" />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent outline-none" aria-label="Urutkan">
            <option value="priority">Prioritas</option>
            <option value="oldest">Terlama dulu</option>
            <option value="newest">Terbaru dulu</option>
          </select>
        </label>
      </div>
      {filtersOn && (
        <p className="text-sm">
          Menampilkan <strong>{visible.length}</strong> dari {orders.length} pesanan.{' '}
          <button type="button" className="font-semibold text-primary underline" onClick={resetFilters}>
            Hapus semua saringan
          </button>
        </p>
      )}

      {/* Isi */}
      {loading && orders.length === 0 ? (
        <p className="py-12 text-center text-lg text-muted-foreground">Memuat antrean…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed px-6 py-12 text-center">
          <p className="text-xl font-bold">Belum ada pesanan berjalan</p>
          <p className="mt-1 text-muted-foreground">Pesanan dari QR meja dan yang dibuat kasir akan muncul di sini.</p>
        </div>
      ) : view === 'board' ? (
        <>
          {/* HP / tablet portrait: pilih satu kolom */}
          <div className="lg:hidden">
            <Segmented<St> label="Kolom status" value={mobileSt} onChange={setMobileSt} options={FLOW.map((st) => ({ v: st, label: STATUS[st].label, count: byStatus(st).length }))} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {FLOW.map((st) => (
              <div key={st} id={`col-${st}`} className={st === mobileSt ? '' : 'hidden lg:block'}>
                <Column st={st} rows={byStatus(st)} now={now} act={act} selected={selected} onSelect={toggle} onSelectAll={setMany} tall />
              </div>
            ))}
          </div>
        </>
      ) : (
        <ListView rows={visible} now={now} act={act} selected={selected} onSelect={toggle} />
      )}

      {/* Bilah aksi massal */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(96%,52rem)] flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-primary/40 bg-card p-3 shadow-xl">
          <span className="font-bold">
            {selected.size} pesanan dipilih
            <span className="ml-2 text-sm font-normal text-muted-foreground">{picked.map((o) => o.queue_code).slice(0, 8).join(', ')}{picked.length > 8 ? '…' : ''}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {pickedCooking.length > 0 && (
              <Button disabled={bulkBusy} onClick={() => void bulk(pickedCooking)} className="bg-sky-600 font-bold text-white hover:bg-sky-700">
                <ChefHat className="size-4" /> Siap ({pickedCooking.length})
              </Button>
            )}
            {pickedReady.length > 0 && (
              <Button disabled={bulkBusy} onClick={() => void bulk(pickedReady)} className="bg-emerald-600 font-bold text-white hover:bg-emerald-700">
                <HandPlatter className="size-4" /> Sudah diambil ({pickedReady.length})
              </Button>
            )}
            <Button variant="outline" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Tampilan daftar (padat) ───────────────────────── */

function ListView({ rows, now, act, selected, onSelect }: { rows: Order[]; now: number; act: QueueActions; selected: Set<string>; onSelect: (id: string) => void }) {
  const [limit, setLimit] = useState(50)
  const [busyId, setBusyId] = useState<string | null>(null)
  const shown = rows.slice(0, limit)
  const run = async (o: Order) => {
    setBusyId(o.id)
    await act.onAdvance(o)
    setBusyId(null)
  }
  if (rows.length === 0) return <p className="rounded-2xl border-2 border-dashed px-4 py-8 text-center text-muted-foreground">Tidak ada pesanan yang cocok.</p>
  return (
    <div className="overflow-hidden rounded-2xl border-2 bg-card">
      <ul className="divide-y">
        {shown.map((o) => {
          const st = o.status as St
          const isLate = isOverdue(o, now, act.cookMinutes)
          const mins = minsSince(o.paid_at ?? o.created_at, now)
          return (
            <li key={o.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${isLate ? 'bg-red-50/70 dark:bg-red-500/10' : ''} ${selected.has(o.id) ? 'bg-primary/5' : ''}`}>
              <button
                type="button"
                disabled={st === 'UNPAID'}
                role="checkbox"
                aria-checked={selected.has(o.id)}
                aria-label={`Pilih ${o.queue_code}`}
                onClick={() => onSelect(o.id)}
                className="grid h-10 min-w-14 place-items-center rounded-lg bg-muted font-mono font-bold disabled:cursor-default"
              >
                {selected.has(o.id) ? <Check className="size-5 text-primary" /> : o.queue_code}
              </button>
              <span className={`size-2.5 shrink-0 rounded-full ${COL[st]?.dot}`} title={STATUS[st]?.label} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {o.customer_name} <span className="font-normal text-muted-foreground">· {place(o)}</span>
                </p>
                <p className="truncate text-sm text-muted-foreground">{itemsText(o)}</p>
              </div>
              <span className={`w-20 text-right text-sm font-semibold tabular-nums ${isLate ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>{mins < 1 ? 'baru' : dur(mins)}</span>
              <span className="w-24 text-right font-bold tabular-nums">{rupiah(o.total)}</span>
              <div className="w-36">
                {st === 'UNPAID' ? (
                  <div className="flex gap-1">
                    <Button size="sm" className="flex-1 font-bold" onClick={() => act.onPay(o.id)}>
                      {isCustomerQrisPending(o) ? 'QRIS' : 'Bayar'}
                    </Button>
                    {act.onCancel && (
                      <Button size="sm" variant="ghost" aria-label={`Batalkan ${o.queue_code}`} onClick={() => void cancelOrder(o, act)}>
                        Batal
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    disabled={busyId === o.id}
                    onClick={() => void run(o)}
                    className={`w-full font-bold text-white ${st === 'IN_KITCHEN' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  >
                    {busyId === o.id ? '…' : st === 'IN_KITCHEN' ? 'Makanan siap' : 'Sudah diambil'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {rows.length > limit && (
        <div className="border-t p-3">
          <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + 50)}>
            Tampilkan 50 lagi ({rows.length - limit} tersisa)
          </Button>
        </div>
      )}
    </div>
  )
}
