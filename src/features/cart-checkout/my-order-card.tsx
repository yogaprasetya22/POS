import { Check, ChefHat, ChevronDown, Clock, Loader2, QrCode, X } from 'lucide-react'
import { supabase } from '@shared/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Button } from '@shared/components/ui/button'
import { Panel } from '@shared/components/panel'
import { rpc } from '@shared/lib/api'
import { ding } from '@shared/lib/new-order-toast'
import { rupiah } from '@shared/lib/utils'
import { createMidtransQris } from '@shared/lib/midtrans'
import { InlineQris } from './inline-qris'
import { cancelMyOrder, forgetMyOrder, loadMyOrders, updateMyOrder, type SavedOrder } from './my-orders'

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
const COOLDOWN_SECONDS = 300 // 5 menit

type View = { tone: 'wait' | 'paid' | 'ready' | 'done' | 'off'; title: string; text: string }
function viewOf(status: string | undefined, payMethod?: 'QRIS' | 'CASHIER', secondsLeft?: number): View {
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
      if (typeof secondsLeft === 'number' && secondsLeft <= 0) {
        return { tone: 'off', title: 'Batas Waktu Habis', text: 'Melebihi batas 5 menit. Silakan pesan ulang' }
      }
      if (payMethod === 'QRIS') {
        return { tone: 'wait', title: 'Menunggu Pembayaran QRIS', text: 'Ketuk untuk membuka kode QRIS atau bayar di kasir' }
      }
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

function OrderStatusCard({
  storeId,
  saved,
  currentTable,
}: {
  storeId: string
  saved: SavedOrder
  currentTable?: string | null
}) {
  const [info, setInfo] = useState<Status | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [qrisOpen, setQrisOpen] = useState(false)
  const [loadingQris, setLoadingQris] = useState(false)
  const [qrisData, setQrisData] = useState<{
    qrString?: string
    qrUrl?: string
    snapToken?: string
    clientKey?: string
    isProduction?: boolean
    isFallback?: boolean
    notice?: string
  } | null>(null)
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
        const orderData = parsed.data
        const isUnpaidStatus = orderData.status === 'UNPAID'
        // Sinkronkan info meja dan status pembayaran ke localStorage jika belum terisi
        if (
          saved.table_no !== (orderData.table_no ?? null) ||
          saved.order_type !== orderData.order_type ||
          saved.is_unpaid !== isUnpaidStatus
        ) {
          updateMyOrder(storeId, saved.id, {
            table_no: orderData.table_no ?? null,
            order_type: orderData.order_type as any,
            is_unpaid: isUnpaidStatus,
          })
        }

        // Baru berubah jadi siap: getar + bunyi supaya pembeli tahu walau HP-nya di meja
        if (orderData.status === 'READY' && lastStatus.current && lastStatus.current !== 'READY') {
          ding()
          navigator.vibrate?.([200, 100, 200])
        }
        // Selesai diambil: kartu tidak perlu lagi. Baru saja selesai -> tampilkan "Selamat menikmati" 5 detik dulu.
        if (orderData.status === 'COMPLETED') {
          const justFinished = lastStatus.current !== null && lastStatus.current !== 'COMPLETED'
          timer = setTimeout(() => forgetMyOrder(storeId, saved.id), justFinished ? 5000 : 0)
        }
        // Dibatalkan / Kedaluwarsa / Void / Refunded: langsung hilangkan seketika dari antrean
        if (['CANCELLED', 'EXPIRED', 'VOID', 'REFUNDED'].includes(orderData.status)) {
          forgetMyOrder(storeId, saved.id)
        }
        lastStatus.current = orderData.status
        setInfo(orderData)
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
  }, [saved.id, saved.is_unpaid, saved.order_type, saved.table_no, storeId])

  const handleOpenQris = async () => {
    setLoadingQris(true)
    try {
      const res = await createMidtransQris(saved.id, storeId)
      if (res.success && (res.qr_string || res.qr_url || res.snap_token)) {
        setQrisData({
          qrString: res.qr_string,
          qrUrl: res.qr_url,
          snapToken: res.snap_token,
          clientKey: res.client_key,
          isProduction: res.is_production,
          isFallback: res.is_fallback,
          notice: res.notice,
        })
        setQrisOpen(true)
      }
    } finally {
      setLoadingQris(false)
    }
  }

  // Filter ketat berdasarkan meja yang bersangkutan
  const normCurrent = currentTable?.trim().toUpperCase()
  const orderTable = (info?.table_no ?? saved.table_no)?.trim().toUpperCase()
  const orderType = info?.order_type ?? saved.order_type

  if (normCurrent) {
    // Sedang membuka link meja spesifik: sembunyikan jika pesanan bawa pulang atau untuk nomor meja lain
    if (orderType === 'TAKEAWAY' || (orderTable && orderTable !== normCurrent)) {
      return null
    }
  } else {
    // Sedang membuka link bawa pulang: sembunyikan jika pesanan makan di meja
    if (orderType === 'DINE_IN' && orderTable) {
      return null
    }
  }

  // Sembunyikan dan hilangkan seketika jika pesanan dibatalkan atau kedaluwarsa di server
  if (info && ['CANCELLED', 'EXPIRED', 'VOID', 'REFUNDED'].includes(info.status)) {
    return null
  }

  const isUnpaid = !info || info.status === 'UNPAID'

  // Hitung mundur cooldown 5 menit sejak pesanan dibuat
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const elapsed = Math.floor((Date.now() - saved.at) / 1000)
    return Math.max(0, COOLDOWN_SECONDS - elapsed)
  })

  // Jika cooldown 5 menit telah habis untuk pesanan yang belum dibayar, langsung hilangkan dari antrean
  if (isUnpaid && secondsLeft <= 0) {
    return null
  }

  useEffect(() => {
    if (!isUnpaid || secondsLeft <= 0) return
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - saved.at) / 1000)
      const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed)
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        forgetMyOrder(storeId, saved.id)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isUnpaid, saved.at, secondsLeft, storeId, saved.id])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const v = viewOf(info?.status, saved.pay_method, isUnpaid ? secondsLeft : undefined)
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
          <span className={`block truncate text-[15px] ${t.sub}`}>
            {failed && !info
              ? 'Mengecek status…'
              : isUnpaid && secondsLeft > 0
                ? `Sisa waktu bayar: ${timeFormatted} · Ketuk untuk bayar QRIS`
                : v.text}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-base font-extrabold tabular-nums">{rupiah(info?.total ?? saved.total)}</span>
          <span className={`flex items-center text-sm font-semibold ${t.sub}`}>
            {open ? 'Tutup' : 'Rincian'} <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 rounded-b-2xl border-2 border-t-0 bg-card px-4 py-3">
          {items.length > 0 ? (
            <ul className="space-y-1 text-base">
              {items.map((i, n) => (
                <li key={n}><span className="font-semibold tabular-nums">{i.qty}×</span> {i.name}</li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-muted-foreground">Rincian sedang dimuat…</p>
          )}

          {isUnpaid && (
            <div className={`rounded-xl border p-3 space-y-2.5 ${
              secondsLeft > 0
                ? 'border-amber-300 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
                : 'border-destructive/30 bg-destructive/10 dark:border-destructive/40 dark:bg-destructive/20'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-bold flex items-center gap-1.5 ${
                  secondsLeft > 0 ? 'text-amber-900 dark:text-amber-200' : 'text-destructive font-bold'
                }`}>
                  <Clock className={`size-3.5 ${secondsLeft > 0 ? 'text-amber-600 animate-pulse' : 'text-destructive'}`} />
                  {secondsLeft > 0 ? 'Belum Dibayar' : 'Batas Waktu Pembayaran Habis'}
                </span>
                {secondsLeft > 0 ? (
                  <span className="font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                    Sisa waktu {timeFormatted}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-destructive">Kedaluwarsa (5 menit)</span>
                )}
              </div>

              {secondsLeft > 0 ? (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={loadingQris}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleOpenQris()
                    }}
                    className="h-9 px-3.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {loadingQris ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <QrCode className="size-3.5" />
                    )}
                    Buka Kode QRIS ({timeFormatted})
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Batas waktu pembayaran 5 menit telah berakhir. Silakan batalkan pesanan ini dan buat pesanan baru.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <span className="text-sm text-muted-foreground">{place ?? 'Pesanan kamu'}</span>
            <Button
              variant="ghost"
              className={`h-11 px-3 text-sm font-semibold ${isUnpaid ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground'}`}
              onClick={() => {
                if (isUnpaid) {
                  cancelMyOrder(storeId, saved.id)
                } else {
                  forgetMyOrder(storeId, saved.id)
                }
              }}
            >
              {isUnpaid ? 'Hapus / Batalkan' : 'Sembunyikan kartu'}
            </Button>
          </div>
        </div>
      )}

      {qrisOpen && qrisData && (
        <Panel
          onClose={() => setQrisOpen(false)}
          title="Pembayaran QRIS"
          footer={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQrisOpen(false)}
              className="w-full text-xs font-semibold"
            >
              Tutup
            </Button>
          }
        >
          <InlineQris
            orderId={saved.id}
            queueCode={saved.queue_code}
            total={info?.total ?? saved.total}
            qrString={qrisData.qrString}
            qrUrl={qrisData.qrUrl}
            snapToken={qrisData.snapToken}
            clientKey={qrisData.clientKey}
            isProduction={qrisData.isProduction}
            isFallback={qrisData.isFallback}
            notice={qrisData.notice}
            storeId={storeId}
            initialSeconds={secondsLeft}
            onSuccess={() => {
              setQrisOpen(false)
              void rpc('public_order_status', { p_id: saved.id }, { asPublic: true }).then(({ data }) => {
                const parsed = StatusSchema.safeParse(data)
                if (parsed.success) setInfo(parsed.data)
              })
            }}
            onBack={() => setQrisOpen(false)}
          />
        </Panel>
      )}
    </section>
  )
}

/** Kartu status pesanan pembeli di halaman menu: disesuaikan dengan meja yang sedang dibuka. */
export function MyOrders({ storeId, currentTable }: { storeId: string; currentTable?: string | null }) {
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

  const normCurrent = currentTable?.trim().toUpperCase()

  // 1. Filter hanya pesanan yang sesuai dengan meja yang sedang dibuka pembeli
  const matchingOrders = list.filter((o) => {
    const orderTable = o.table_no?.trim().toUpperCase()
    if (normCurrent) {
      // Sedang di meja tertentu (Dine-in): hanya tampilkan jika cocok dengan meja ini
      // atau belum memiliki data meja di storage (akan disaring setelah dicek ke server)
      return !orderTable || orderTable === normCurrent
    } else {
      // Sedang mode Bawa Pulang (Takeaway): hanya tampilkan pesanan takeaway / tanpa meja
      return o.order_type === 'TAKEAWAY' || !orderTable
    }
  })

  // 2. Untuk pesanan yang berstatus belum dibayar / menunggu pembayaran:
  // Hanya tampilkan 1 pesanan UNPAID paling baru untuk meja ini agar kartu tidak menumpuk.
  let seenUnpaid = false
  const dedupedOrders = matchingOrders.filter((o) => {
    const isUnpaid = o.is_unpaid ?? true
    if (isUnpaid) {
      if (seenUnpaid) return false
      seenUnpaid = true
      return true
    }
    return true
  })

  if (dedupedOrders.length === 0) return null
  return (
    <div className="mb-3 space-y-2">
      {dedupedOrders.slice(0, 3).map((o) => (
        <OrderStatusCard key={o.id} storeId={storeId} saved={o} currentTable={currentTable} />
      ))}
    </div>
  )
}
