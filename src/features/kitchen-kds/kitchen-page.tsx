import { liquid } from '@shared/lib/motion'
import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { useCatalog } from '@features/menu-catalog'
import { ErrorAlert } from '@shared/components/error-alert'
import { KitchenSkeleton } from '@shared/components/page-skeleton'
import { StockDialog } from '@shared/components/stock-dialog'
import { Button } from '@shared/components/ui/button'
import { useStaff } from '@shared/lib/auth'
import { useLiveOrders } from '@shared/lib/orders'
import { useAutoPrint } from '@shared/lib/use-auto-print'
import { Printer } from 'lucide-react'
import { rpc } from '@shared/lib/api'
import { timeJakarta } from '@shared/lib/utils'
import type { Order, OrderStatus } from '@shared/types/contracts'

const ACTIVE: OrderStatus[] = ['IN_KITCHEN', 'READY']
const STEP = {
  IN_KITCHEN: { to: 'READY', action: 'Siap diambil', badge: 'Dimasak', tone: 'amber' },
  READY: { to: 'COMPLETED', action: 'Sudah diambil', badge: 'Siap diambil', tone: 'green' },
} as const

/**
 * Layar Dapur (KDS)
 * Dilengkapi tombol aksi cepat untuk mematikan/menyalakan menu yang kehabisan bahan di dapur.
 */
export function KitchenPage() {
  const { orders, loading } = useLiveOrders(ACTIVE)
  const { storeId } = useStaff()
  const auto = useAutoPrint(orders, !loading)
  const { data: catalog, reload } = useCatalog('id', storeId)
  const [error, setError] = useState('')
  const [stockOpen, setStockOpen] = useState(false)

  if (loading) {
    return <KitchenSkeleton />
  }

  const products = catalog?.products ?? []
  const soldOutCount = products.filter((p) => !p.is_available).length

  const advance = async (o: Order) => {
    const { error } = await rpc('advance_order', {
      p_order_id: o.id,
      p_to: STEP[o.status as keyof typeof STEP].to,
    })
    setError(error?.message ?? '')
  }

  const handleToggleAvailability = async (productId: string, isAvailable: boolean) => {
    const { error: err } = await rpc('set_product_availability', { p_product: productId, p_available: isAvailable })
    if (err) {
      setError(`Gagal mengubah status menu: ${err.message}`)
    } else {
      reload()
    }
  }

  return (
    <div className="space-y-4 p-3 lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          Dapur <span className="font-normal text-muted-foreground">· {orders.length} aktif</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {!auto.paired && (
            <Button variant="outline" onClick={auto.pair} className="h-11 gap-2 px-4">
              <Printer /> Pasangkan printer
            </Button>
          )}
          <Button variant={auto.enabled ? 'default' : 'outline'} aria-pressed={auto.enabled} onClick={() => auto.setEnabled(!auto.enabled)} className="h-11 gap-2 px-4">
            <Printer /> Cetak otomatis {auto.enabled ? 'aktif' : 'mati'}
          </Button>
          <Button variant="outline" onClick={() => setStockOpen(true)} className="h-11 gap-2 px-4">
            Stok menu
            {soldOutCount > 0 && <span className="rounded bg-destructive/10 px-1.5 text-xs font-semibold text-destructive">{soldOutCount} habis</span>}
          </Button>
        </div>
      </div>

      <ErrorAlert message={error || auto.error} />

      {orders.length === 0 && (
        <p className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">Belum ada pesanan yang perlu dimasak.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
        <AnimatePresence initial={false}>
        {orders.map((o) => {
          const step = STEP[o.status as keyof typeof STEP]
          const ready = o.status === 'READY'
          return (
            <m.article
              key={o.id}
              layout="position"
              transition={liquid}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className={`flex flex-col rounded-lg border border-t-4 bg-card ${ready ? 'border-t-emerald-500' : 'border-t-amber-500'}`}>
              <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-2xl font-bold leading-none">{o.queue_code}</p>
                  <p className="mt-1.5 truncate text-sm text-muted-foreground">{o.customer_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold">{o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang'}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{o.paid_at && timeJakarta(o.paid_at)}</p>
                </div>
              </header>

              <ul className="flex-1 divide-y px-4">
                {o.items.map((i, n) => (
                  <li key={n} className="flex gap-3 py-2.5">
                    <span className="w-7 shrink-0 text-lg font-bold tabular-nums">{i.qty}×</span>
                    <div className="min-w-0">
                      <p className="text-base font-medium leading-6">{i.name}</p>
                      {i.choices.length > 0 && <p className="text-sm text-muted-foreground">{i.choices.map((c) => c.option).join(', ')}</p>}
                      {i.note && <p className="mt-1 rounded bg-amber-100 px-2 py-1 text-sm font-medium text-amber-950 dark:bg-amber-500/20 dark:text-amber-100">{i.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{step.badge}</p>
                  <Button variant="ghost" size="sm" onClick={() => auto.print(o)} aria-label={`Cetak ulang tiket ${o.queue_code}`}>
                    <Printer /> Cetak ulang
                  </Button>
                </div>
                <Button size="lg" variant={ready ? 'outline' : 'default'} onClick={() => advance(o)} className="h-14 w-full text-base font-semibold">
                  {step.action}
                </Button>
              </div>
            </m.article>
          )
        })}
        </AnimatePresence>
      </div>

      <StockDialog open={stockOpen} onOpenChange={setStockOpen} products={products} onToggleAvailability={handleToggleAvailability} />
    </div>
  )
}
