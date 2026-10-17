import { ChefHat, CheckCircle2, PackageX, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { useCatalog } from '@features/menu-catalog'
import { ErrorAlert } from '@shared/components/error-alert'
import { KitchenSkeleton } from '@shared/components/page-skeleton'
import { StockDialog } from '@shared/components/stock-dialog'
import { ToneBadge } from '@shared/components/tone-badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@shared/components/ui/card'
import { useStaff } from '@shared/lib/auth'
import { useLiveOrders } from '@shared/lib/orders'
import { supabase } from '@shared/lib/supabase'
import { timeJakarta } from '@shared/lib/utils'
import type { Order, OrderStatus } from '@shared/types/contracts'

const ACTIVE: OrderStatus[] = ['IN_KITCHEN', 'READY']
const STEP = {
  IN_KITCHEN: { to: 'READY', action: 'Siap diambil', badge: 'Dimasak', tone: 'amber' },
  READY: { to: 'COMPLETED', action: 'Sudah diambil', badge: 'Siap diambil', tone: 'green' },
} as const

/**
 * Layar Dapur (KDS)
 * Kontainer diseragamkan dengan Admin dan Super Admin (`space-y-6 p-4 md:p-6`).
 * Dilengkapi tombol aksi cepat untuk mematikan/menyalakan menu yang kehabisan bahan di dapur.
 */
export function KitchenPage() {
  const { orders, loading } = useLiveOrders(ACTIVE)
  const { storeId } = useStaff()
  const { data: catalog, reload } = useCatalog('id', storeId)
  const [error, setError] = useState('')
  const [stockOpen, setStockOpen] = useState(false)

  if (loading) {
    return <KitchenSkeleton />
  }

  const products = catalog?.products ?? []
  const soldOutCount = products.filter((p) => !p.is_available).length

  const advance = async (o: Order) => {
    const { error } = await supabase.rpc('advance_order', {
      p_order_id: o.id,
      p_to: STEP[o.status as keyof typeof STEP].to,
    })
    setError(error?.message ?? '')
  }

  const handleToggleAvailability = async (productId: string, isAvailable: boolean) => {
    const { error: err } = await supabase.from('products').update({ is_available: isAvailable }).eq('id', productId)
    if (err) {
      setError(`Gagal mengubah status menu: ${err.message}`)
    } else {
      reload()
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1920px] mx-auto">
      {/* Header Banner - Tablet Friendly Touch Targets */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            Layar Dapur (KDS)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Pesanan aktif yang siap dimasak dan disajikan kepada pelanggan.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setStockOpen(true)}
            className="h-11 sm:h-12 px-4 rounded-xl text-xs sm:text-sm font-bold gap-2 border-border shadow-2xs hover:bg-muted/80 active:scale-95 transition-all"
          >
            <PackageX className="size-5 text-muted-foreground" />
            <span>Kelola Stok Cepat</span>
            {soldOutCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-black rounded-md bg-amber-500/15 text-amber-700 border border-amber-500/30">
                {soldOutCount} Habis
              </span>
            )}
          </Button>
          <div className="h-11 sm:h-12 px-4 rounded-xl text-xs sm:text-sm font-bold bg-muted/60 border flex items-center shadow-2xs">
            {orders.length} pesanan aktif
          </div>
        </div>
      </div>

      <ErrorAlert message={error} />

      {orders.length === 0 && (
        <Card className="rounded-3xl border-2 border-dashed p-14 text-center text-muted-foreground">
          <ChefHat className="mx-auto size-12 text-muted-foreground/40 mb-3" />
          <p className="text-lg font-bold text-foreground">Dapur Bersih & Siap</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Belum ada antrean pesanan baru yang masuk ke dapur.
          </p>
        </Card>
      )}

      {/* Grid Kartu Pesanan Tablet KDS */}
      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders.map((o) => {
          const step = STEP[o.status as keyof typeof STEP]
          return (
            <Card
              key={o.id}
              className="rounded-3xl border-2 bg-card shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden"
            >
              {/* Header Kartu: Kode Antrean & Meja */}
              <CardHeader className="p-4 sm:p-5 pb-3 border-b bg-muted/20">
                <CardTitle className="flex items-center justify-between text-xl sm:text-2xl font-black tracking-tight">
                  <span className="flex items-center gap-2 text-foreground">
                    <ReceiptText className="size-6 text-primary shrink-0" aria-hidden /> #{o.queue_code}
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-medium text-muted-foreground">
                    {o.paid_at && timeJakarta(o.paid_at)}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm font-bold text-foreground/80 mt-1">
                  {o.customer_name} ·{' '}
                  <span className="text-primary font-black">
                    {o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang (Takeaway)'}
                  </span>
                </CardDescription>
              </CardHeader>

              {/* Konten Kartu: Status Pill & Daftar Item */}
              <CardContent className="p-4 sm:p-5 flex-1 space-y-3.5">
                <ToneBadge tone={step.tone} className="h-8 w-full justify-between text-xs sm:text-sm font-bold rounded-xl px-3">
                  <span>{step.badge}</span>
                  <CheckCircle2 aria-hidden className="size-4 shrink-0" />
                </ToneBadge>

                <ul className="space-y-2.5">
                  {o.items.map((i, n) => (
                    <li key={n} className="rounded-2xl bg-muted/40 border p-3 text-xs sm:text-sm space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-lg bg-primary/10 text-primary font-black text-sm shrink-0">
                          {i.qty}×
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm sm:text-base text-foreground leading-snug">
                            {i.name}
                          </p>
                          {i.choices.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                              {i.choices.map((c) => c.option).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {i.note && (
                        <div className="text-xs font-bold text-amber-900 bg-amber-500/15 border border-amber-500/30 rounded-xl p-2 px-3 mt-1.5 flex items-center gap-1.5">
                          <span>📝 Catatan: {i.note}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>

              {/* Tombol Aksi Sentuh Jumbo Tablet */}
              <CardFooter className="p-4 sm:p-5 pt-0 border-0 bg-transparent">
                <Button
                  size="lg"
                  variant={o.status === 'READY' ? 'outline' : 'default'}
                  onClick={() => advance(o)}
                  className="w-full h-13 sm:h-14 rounded-2xl text-sm sm:text-base font-black tracking-wide active:scale-98 transition-all shadow-sm"
                >
                  {step.action}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <StockDialog
        open={stockOpen}
        onOpenChange={setStockOpen}
        products={products}
        onToggleAvailability={handleToggleAvailability}
      />
    </div>
  )
}

