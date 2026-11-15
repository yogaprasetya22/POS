import { Check, ChefHat, ChevronDown, Clock, X } from 'lucide-react'
import { supabase } from '@shared/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Button } from '@shared/components/ui/button'
import { rpc } from '@shared/lib/api'
import { ding } from '@shared/lib/new-order-toast'
import { rupiah } from '@shared/lib/utils'
import { forgetMyOrder, loadMyOrders, type SavedOrder } from './my-orders'

const StatusSchema = z.object({
  id: z.string(),
  queue_code: z.string(),
  status: z.string(),
  total: z.number(),
  order_type: z.string().optional(),
  table_no: z.string().nullable().optional(),
  items: z.array(z.object({ name: z.string(), qty: z.number() })),
})
type Status = z.infer<typeof StatusSchema>

const POLL_MS = 10_000

type View = { tone: 'wait' | 'paid' | 'ready' | 'done' | 'off'; title: string; text: string }
function viewOf(status: string | undefined): View {
  switch (status) {
    case 'IN_KITCHEN':
      return { tone: 'paid', title: 'Sedang disiapkan', text: 'Sudah dibayar. Tunggu sebentar ya' }
    case 'READY':
      return { tone: 'ready', title: 'Siap diambil!', text: 'Ambil di kasir, sebut kodenya' }
    case 'COMPLETED':
      return { tone: 'done', title: 'Selesai', text: 'Selamat menikmati!' }
    case 'CANCELLED':
    case 'EXPIRED':
    case 'VOID':
    case 'REFUNDED':
      return { tone: 'off', title: 'Dibatalkan', text: 'Pesan lagi, atau tanya kasir' }
    default:
      return { tone: 'wait', title: 'Bayar di kasir', text: 'Tunjukkan kode ini ke kasir' }
  }
}

// Satu baris yang tenang; hanya "Siap diambil" yang mencolok (hijau penuh)
const TONE: Record<View['tone'], { card: string; sub: string; icon: string }> = {
  wait: { card: 'border-amber-400 bg-card', sub: 'text-muted-foreground', icon: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' },
  paid: { card: 'border-border bg-card', sub: 'text-muted-foreground', icon: 'bg-primary/10 text-primary' },
  ready: { card: 'border-emerald-700 bg-emerald-700 text-white', sub: 'text-emerald-50', icon: 'bg-white/20 text-white' },
  done: { card: 'border-border bg-card', sub: 'text-muted-foreground', icon: 'bg-muted text-foreground' },
  off: { card: 'border-destructive/50 bg-card', sub: 'text-muted-foreground', icon: 'bg-destructive/10 text-destructive' },
}
const ICON = { wait: Clock, paid: ChefHat, ready: Check, done: Check, off: X } as const

function OrderStatusCard({ storeId, saved }: { storeId: string; saved: SavedOrder }) {
  const [info, setInfo] = useState<Status | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const lastStatus = useRef<string | null>(null)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const check = async () => {
      // Hemat: HP di saku / tab tidak dibuka -> tunda; dicek ulang begitu dibuka lagi (lihat visibilitychange)
      if (document.visibilityState === 'hidden') return
      clearTimeout(timer)
      const { data, error } = await rpc('public_order_status', { p_id: saved.id }, { asPublic: true })
      if (!alive) return
      const parsed = StatusSchema.safeParse(data)
      setFailed(!!error || !parsed.success)
      if (parsed.success) {
        // Baru berubah jadi siap: getar + bunyi supaya pembeli tahu walau HP-nya di meja
        if (parsed.data.status === 'READY' && lastStatus.current && lastStatus.current !== 'READY') {
          ding()
          navigator.vibrate?.([200, 100, 200])
        }
        // Selesai diambil: kartu tidak perlu lagi. Baru saja selesai -> tampilkan "Selamat menikmati" 5 detik dulu.
        if (parsed.data.status === 'COMPLETED') {
          const justFinished = lastStatus.current !== null && lastStatus.current !== 'COMPLETED'
          timer = setTimeout(() => forgetMyOrder(storeId, saved.id), justFinished ? 5000 : 0)
        }
        lastStatus.current = parsed.data.status
        setInfo(parsed.data)
      }
      const finished = parsed.success && ['COMPLETED', 'CANCELLED', 'EXPIRED', 'VOID', 'REFUNDED'].includes(parsed.data.status)
      done = finished
      if (!finished) timer = setTimeout(check, POLL_MS)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !done) void check()
    }
    let done = false
    void check()
    document.addEventListener('visibilitychange', onVisible)
    // Kabar langsung dari server saat status berubah; pengecekan berkala di atas tetap jadi cadangan
    const channel = supabase
      .channel(`order:${saved.id}`)
      .on('broadcast', { event: 'status' }, () => void check())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
      alive = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [saved.id, storeId])

  const v = viewOf(info?.status)
  const t = TONE[v.tone]
  const Icon = ICON[v.tone]
  const place = info?.order_type === 'TAKEAWAY' ? 'Bawa pulang' : info?.table_no ? `Meja ${info.table_no}` : null
  const items = info?.items ?? []

  return (
    <section aria-live="polite">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex min-h-18 w-full items-center gap-3 border-2 px-3.5 py-3 text-left transition-colors ${open ? 'rounded-t-2xl' : 'rounded-2xl'} ${t.card}`}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${t.icon}`}>
          <Icon className="size-5" strokeWidth={2.5} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-extrabold leading-snug">
            <span className="font-mono">{saved.queue_code}</span> · {v.title}
          </span>
          <span className={`block truncate text-[15px] ${t.sub}`}>{failed && !info ? 'Mengecek status…' : v.text}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-base font-extrabold tabular-nums">{rupiah(info?.total ?? saved.total)}</span>
          <span className={`flex items-center text-sm font-semibold ${t.sub}`}>
            {open ? 'Tutup' : 'Rincian'} <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </span>
        </span>
      </button>
      {open && (
        <div className="space-y-2 rounded-b-2xl border-2 border-t-0 bg-card px-4 py-3">
          {items.length > 0 ? (
            <ul className="space-y-1 text-base">
              {items.map((i, n) => (
                <li key={n}><span className="font-semibold tabular-nums">{i.qty}×</span> {i.name}</li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted-foreground">Rincian sedang dimuat…</p>
          )}
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <span className="text-sm text-muted-foreground">{place ?? 'Pesanan kamu'}</span>
            <Button variant="ghost" className="h-11 px-3 text-sm font-semibold text-muted-foreground" onClick={() => forgetMyOrder(storeId, saved.id)}>
              Sembunyikan kartu
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Kartu status pesanan pembeli di halaman menu: tetap ada walau halaman di-refresh. */
export function MyOrders({ storeId }: { storeId: string }) {
  const [list, setList] = useState(() => loadMyOrders(storeId))
  useEffect(() => {
    const refresh = () => setList(loadMyOrders(storeId))
    refresh()
    window.addEventListener('pos:pesanan-saya', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('pos:pesanan-saya', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [storeId])
  if (list.length === 0) return null
  return (
    <div className="mb-3 space-y-2">
      {list.slice(0, 3).map((o) => (
        <OrderStatusCard key={o.id} storeId={storeId} saved={o} />
      ))}
    </div>
  )
}
