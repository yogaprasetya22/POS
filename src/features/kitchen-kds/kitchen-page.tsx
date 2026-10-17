import { ChefHat, CheckCircle2, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { ToneBadge } from '@shared/components/tone-badge'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@shared/components/ui/card'
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
 */
export function KitchenPage() {
  const orders = useLiveOrders(ACTIVE)
  const [error, setError] = useState('')

  const advance = async (o: Order) => {
    const { error } = await supabase.rpc('advance_order', {
      p_order_id: o.id,
      p_to: STEP[o.status as keyof typeof STEP].to,
    })
    setError(error?.message ?? '')
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            Layar Dapur (KDS)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Pesanan aktif yang siap dimasak dan disajikan kepada pelanggan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-semibold px-3 py-1">
            {orders.length} pesanan aktif
          </Badge>
        </div>
      </div>

      <ErrorAlert message={error} />

      {orders.length === 0 && (
        <Card className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          <ChefHat className="mx-auto size-10 text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-foreground">Dapur Bersih & Siap</p>
          <p className="text-xs text-muted-foreground mt-1">
            Belum ada antrean pesanan baru yang masuk ke dapur.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {orders.map((o) => {
          const step = STEP[o.status as keyof typeof STEP]
          return (
            <Card key={o.id} className="rounded-2xl border transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center justify-between text-lg font-bold">
                  <span className="flex items-center gap-2">
                    <ReceiptText className="size-5 text-primary" aria-hidden /> #{o.queue_code}
                  </span>
                  <span className="text-xs font-mono font-normal text-muted-foreground">
                    {o.paid_at && timeJakarta(o.paid_at)}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {o.customer_name} · {o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex-1 space-y-3">
                <ToneBadge tone={step.tone} className="h-6 w-full justify-between text-xs">
                  {step.badge} <CheckCircle2 aria-hidden className="size-3.5" />
                </ToneBadge>
                <ul className="space-y-2">
                  {o.items.map((i, n) => (
                    <li key={n} className="rounded-xl bg-muted/50 border p-2.5 text-xs">
                      <div className="font-medium text-foreground">
                        <b className="text-primary font-bold mr-1">{i.qty}×</b> {i.name}
                      </div>
                      {i.choices.length > 0 && (
                        <div className="text-[11px] text-muted-foreground pl-4 mt-0.5">
                          {i.choices.map((c) => c.option).join(', ')}
                        </div>
                      )}
                      {i.note && (
                        <div className="text-[11px] font-semibold text-destructive pl-4 mt-0.5">
                          ! Catatan: {i.note}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="p-4 pt-0 border-0 bg-transparent">
                <Button
                  size="lg"
                  variant={o.status === 'READY' ? 'outline' : 'default'}
                  onClick={() => advance(o)}
                  className="w-full rounded-xl text-xs font-bold"
                >
                  {step.action}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
