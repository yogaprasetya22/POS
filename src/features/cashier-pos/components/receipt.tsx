import { CheckCircle2, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog'
import { Separator } from '@shared/components/ui/separator'
import { rupiah, timeJakarta } from '@shared/lib/utils'
import { PAYMENT_LABEL, type Order } from '@shared/types/contracts'

const Row = ({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) => (
  <div className={`flex justify-between gap-4 ${strong ? 'font-bold' : ''}`}>
    <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
    <span className="text-right">{children}</span>
  </div>
)

const Dash = () => <Separator className="h-0 border-t border-dashed bg-transparent" />

/** Layar "Pembayaran Berhasil" yang sekaligus jadi struk thermal saat dicetak (CSS print di index.css). */
export function Receipt({ order, storeName, onClose }: { order: Order; storeName: string; onClose: () => void }) {
  const paid = order.cash_received ?? order.total
  const count = order.items.reduce((n, i) => n + i.qty, 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent id="receipt" showCloseButton={false} className="gap-5 bg-muted p-7 font-mono sm:max-w-sm">
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-16 text-green-500 print:hidden" aria-hidden />
          <p className="hidden font-bold print:block">{storeName}</p>
          <DialogTitle className="mt-3 text-xl font-bold print:hidden">Pembayaran Berhasil</DialogTitle>
          <DialogDescription className="sr-only">Struk pesanan {order.queue_code}</DialogDescription>
          <p className="mt-1 text-3xl font-extrabold text-primary print:text-black">{order.queue_code}</p>
        </div>

        <div className="space-y-2 text-sm">
          <Row label="Nama">{order.customer_name}</Row>
          <Row label="Meja">{order.order_type === 'DINE_IN' ? order.table_no : 'Bawa pulang'}</Row>
          <Row label="Waktu">
            {order.business_day} {order.paid_at && timeJakarta(order.paid_at)}
          </Row>
          {order.payment_method && <Row label="Pembayaran">{PAYMENT_LABEL[order.payment_method]}</Row>}

          <Dash />
          <Row label="Total item" strong>{count} item</Row>
          {order.items.map((i, n) => (
            <div key={n} className="flex justify-between gap-4 text-muted-foreground">
              <span>
                +{i.qty} {i.name}
                {i.choices.length > 0 && <span className="block text-xs">{i.choices.map((c) => c.option).join(', ')}</span>}
              </span>
              <span>{rupiah(i.subtotal)}</span>
            </div>
          ))}

          <Dash />
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 print:text-black font-medium">
              <span>Diskon ({order.promo_name ?? 'Promo'})</span>
              <span>-{rupiah(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{rupiah(order.total)}</span>
          </div>
          {order.payment_method === 'CASH' && (
            <>
              <Row label="Tunai">{rupiah(paid)}</Row>
              <Row label="Kembalian" strong>{rupiah(paid - order.total)}</Row>
            </>
          )}
          <p className="hidden pt-2 text-center print:block">Terima kasih!</p>
        </div>

        <div className="grid grid-cols-2 gap-3 print:hidden">
          <Button variant="outline" size="lg" onClick={() => window.print()}>
            <Printer /> Cetak Struk
          </Button>
          <Button size="lg" onClick={onClose}>Selesai</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
