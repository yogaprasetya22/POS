import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { rpc } from '@shared/lib/api'
import { useStaff } from '@shared/lib/auth'
import { useLiveOrders } from '@shared/lib/orders'
import { useStoreConfig } from '@shared/lib/store-config'
import type { Order, OrderStatus } from '@shared/types/contracts'
import { OrdersBoard } from './components/order-queue'

const ACTIVE: OrderStatus[] = ['UNPAID', 'IN_KITCHEN', 'READY']
const NEXT = { IN_KITCHEN: 'READY', READY: 'COMPLETED' } as const

/** Halaman Antrean: semua pesanan aktif, terpisah dari layar Jualan supaya layar kasir tetap ringkas. */
export function QueuePage() {
  const { orders, loading } = useLiveOrders(ACTIVE)
  const { storeId } = useStaff()
  const { config } = useStoreConfig(storeId)
  const navigate = useNavigate()

  const onAdvance = async (o: Order) => {
    const to = NEXT[o.status as keyof typeof NEXT]
    if (!to) return
    const { error } = await rpc('advance_order', { p_order_id: o.id, p_to: to })
    if (error) toast.error(`${o.queue_code} belum berubah`, { description: `${error.message} Muat ulang halaman lalu coba lagi.` })
    else toast.success(to === 'READY' ? `${o.queue_code} ditandai siap diambil` : `${o.queue_code} selesai, sudah diambil`)
  }

  // Aksi massal: satu notifikasi ringkas, bukan puluhan toast
  const onAdvanceMany = async (list: Order[]) => {
    const results = await Promise.all(
      list.map(async (o) => {
        const to = NEXT[o.status as keyof typeof NEXT]
        if (!to) return false
        const { error } = await rpc('advance_order', { p_order_id: o.id, p_to: to })
        return !error
      }),
    )
    const ok = results.filter(Boolean).length
    const fail = list.length - ok
    if (ok) toast.success(`${ok} pesanan diperbarui`)
    if (fail) toast.error(`${fail} pesanan belum berubah`, { description: 'Mungkin sudah diubah di layar lain. Muat ulang lalu coba lagi.' })
  }

  return (
    <div className="mx-auto max-w-[96rem] p-4 md:p-6">
      <OrdersBoard
        orders={orders}
        loading={loading}
        act={{
          onPay: (id) => navigate(`/cashier?pesanan=${id}`),
          onAdvance,
          onAdvanceMany,
          onItem: async (o, index, done) => {
            const { error } = await rpc('set_item_done', { p_order_id: o.id, p_index: index, p_done: done })
            if (error) toast.error('Centang belum tersimpan', { description: `${error.message} Coba lagi.` })
          },
          useKitchen: config?.use_kitchen_screen ?? true,
          cookMinutes: config?.cook_minutes ?? 15,
        }}
      />
    </div>
  )
}
