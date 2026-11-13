import { useNavigate } from 'react-router'
import { useLiveOrders } from '@shared/lib/orders'
import type { OrderStatus } from '@shared/types/contracts'
import { OrdersBoard } from './components/order-queue'

const ACTIVE: OrderStatus[] = ['UNPAID', 'IN_KITCHEN', 'READY']

/** Halaman Antrean: semua pesanan aktif, terpisah dari layar Jualan supaya layar kasir tetap ringkas. */
export function QueuePage() {
  const { orders, loading } = useLiveOrders(ACTIVE)
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <OrdersBoard orders={orders} loading={loading} onPay={(id) => navigate(`/cashier?pesanan=${id}`)} />
    </div>
  )
}
