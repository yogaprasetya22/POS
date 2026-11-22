import { CheckCircle2, Printer, Receipt as ReceiptIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog'
import { Separator } from '@shared/components/ui/separator'
import type { ReceiptStore } from '@shared/lib/print'
import { rupiah, timeJakarta } from '@shared/lib/utils'
import { PAYMENT_LABEL, type Order } from '@shared/types/contracts'
import { PrintPanel } from './print-panel'

const Row = ({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) => (
  <div className={`flex justify-between gap-4 ${strong ? 'font-bold' : ''}`}>
    <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
    <span className="text-right">{children}</span>
  </div>
)

const Dash = () => <Separator className="h-0 border-t border-dashed bg-transparent" />

/** Layar "Pembayaran Berhasil" yang sekaligus jadi struk saat dicetak (CSS print di index.css). */
export function Receipt({ order, store, onClose }: { order: Order; store: ReceiptStore; onClose: () => void }) {
  const paid = order.cash_received ?? order.total
  const count = order.items.reduce((n, i) => n + i.qty, 0)

  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent id="receipt" showCloseButton={false} className="max-h-[92%] gap-5 overflow-y-auto bg-card p-6 sm:max-w-sm print:bg-white print:font-mono">
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/10 print:hidden"><CheckCircle2 className="size-10 text-emerald-600" aria-hidden /></span>
          <p className="hidden font-bold print:block">{store.name}</p>
          {store.address && <p className="hidden text-xs print:block">{store.address}</p>}
          <DialogTitle className="mt-3 text-xl font-bold print:hidden">Pembayaran Berhasil</DialogTitle>
          <DialogDescription className="sr-only">Struk pesanan {order.queue_code}</DialogDescription>
          <p className="mt-2 text-sm text-muted-foreground print:hidden">Nomor antrean</p>
          <p className="font-mono text-4xl font-black tracking-wider text-primary print:text-black">{order.queue_code}</p>
        </div>

        <div className="space-y-2 text-sm">
          <Row label="Nama">{order.customer_name}</Row>
          <Row label="Pesanan">{order.order_type === 'DINE_IN' ? `Makan di sini · Meja ${order.table_no}` : 'Bawa pulang'}</Row>
          <Row label="Waktu">
            {new Date(`${order.business_day}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}{order.paid_at && `, ${timeJakarta(order.paid_at)}`}
          </Row>
          {order.payment_method && <Row label="Pembayaran">{PAYMENT_LABEL[order.payment_method]}</Row>}

          <Dash />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{count} item</p>
          {order.items.map((i, n) => (
            <div key={n} className="flex justify-between gap-4">
              <span>
                <span className="font-semibold">{i.qty}×</span> {i.name}
                {i.choices.length > 0 && <span className="block text-xs">{i.choices.map((c) => c.option).join(', ')}</span>}
              </span>
              <span>{rupiah(i.subtotal)}</span>
            </div>
          ))}

          <Dash />
          {(order.discount_amount > 0 || order.voucher_discount > 0 || order.points_discount > 0 || order.service_amount > 0 || order.tax_amount > 0 || order.rounding_amount !== 0) && (
            <Row label="Subtotal">{rupiah(order.subtotal || order.total + order.discount_amount)}</Row>
          )}
          {order.discount_amount > 0 && <Row label={`Diskon (${order.promo_name ?? 'Promo'})`}>-{rupiah(order.discount_amount)}</Row>}
          {order.voucher_discount > 0 && <Row label="Voucher">-{rupiah(order.voucher_discount)}</Row>}
          {order.points_discount > 0 && <Row label={`Poin (${order.points_redeemed})`}>-{rupiah(order.points_discount)}</Row>}
          {order.service_amount > 0 && <Row label="Service">{rupiah(order.service_amount)}</Row>}
          {order.tax_amount > 0 && <Row label="Pajak">{rupiah(order.tax_amount)}</Row>}
          {order.rounding_amount !== 0 && <Row label="Pembulatan">{order.rounding_amount < 0 ? '-' : ''}{rupiah(Math.abs(order.rounding_amount))}</Row>}
          <div className="flex justify-between text-lg font-bold tabular-nums">
            <span>Total</span>
            <span>{rupiah(order.total)}</span>
          </div>
          {order.payment_method === 'CASH' && (
            <>
              <Row label="Uang diterima">{rupiah(paid)}</Row>
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-emerald-500/10 px-4 py-3 text-emerald-800 dark:text-emerald-200 print:bg-transparent print:p-0 print:text-black">
                <span className="font-semibold">Kembalian</span>
                <span className="text-2xl font-black tabular-nums">{rupiah(paid - order.total)}</span>
              </div>
            </>
          )}
          {order.points_earned > 0 && <Row label="Poin didapat">+{order.points_earned}</Row>}
          <p className="hidden pt-2 text-center print:block">{store.footer || 'Terima kasih!'}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 print:hidden">
          <Button variant="outline" size="lg" className="h-12 px-2 text-sm" onClick={() => setPreviewOpen(true)}>
            <Printer /> Cetak struk
          </Button>
          <Button variant="outline" size="lg" className="h-12 px-2 text-sm" onClick={() => window.print()} title="Cetak lewat printer biasa / simpan PDF">
            <ReceiptIcon /> Cetak via browser
          </Button>
          <Button size="lg" className="col-span-2 h-12 text-base font-bold" onClick={onClose}>Selesai · Pesanan baru</Button>
        </div>
        {previewOpen && <PrintPanel order={order} store={store} onClose={() => setPreviewOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}
