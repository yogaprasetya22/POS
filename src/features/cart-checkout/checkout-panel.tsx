import {
  Check,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  UtensilsCrossed,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Stepper } from '@shared/components/stepper'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import { calculatePromo } from '@shared/lib/promo'
import { CheckoutSchema, CreatedOrderSchema, type OrderType, type Product, type Promotion } from '@shared/types/contracts'
import { cartTotal, toLines } from './cart'
import { useCartStore } from './store/cart-store'
import { buildWaText, waUrl } from './wa-message'

export function CheckoutPanel({
  storeId,
  waNumber,
  defaultTable,
  promotions = [],
  products = [],
  onClose,
}: {
  storeId: string
  waNumber: string
  defaultTable: string
  promotions?: Promotion[]
  products?: Product[]
  onClose: () => void
}) {
  const { items, setQty, clear } = useCartStore()
  const [name, setName] = useState('')
  const [orderType, setOrderType] = useState<OrderType>(defaultTable ? 'DINE_IN' : 'TAKEAWAY')
  const [table, setTable] = useState(defaultTable)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const count = items.reduce((n, i) => n + i.qty, 0)
  const subtotal = cartTotal(items)
  const promo = calculatePromo(items, promotions, products)
  const total = Math.max(0, subtotal - promo.discount)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const parsed = CheckoutSchema.safeParse({
      customer_name: name,
      order_type: orderType,
      table_no: orderType === 'DINE_IN' ? table : '',
      lines: toLines(items),
    })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    const v = parsed.data

    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('create_order', {
      p_store_id: storeId,
      p_customer_name: v.customer_name,
      p_order_type: v.order_type,
      p_table_no: v.table_no || null,
      p_lines: v.lines,
    })
    setBusy(false)
    if (rpcError) return setError(`Pesanan gagal: ${rpcError.message}`)

    const created = CreatedOrderSchema.parse(data)
    const text = buildWaText({
      ...created,
      customer_name: v.customer_name,
      order_type: v.order_type,
      table_no: v.table_no,
      total: created.total,
      subtotal,
      discount_amount: created.discount_amount ?? promo.discount,
      promo_name: created.promo_name ?? promo.appliedPromo?.name,
      items,
    })
    clear()
    window.location.href = waUrl(waNumber, text)
  }

  return (
    <Panel
      onClose={onClose}
      title={
        <div className="flex items-center gap-1.5">
          <span>Keranjang Pesanan</span>
          <Badge variant="secondary" className="text-[11px] font-bold px-2 py-0.5 rounded-full">
            {count}
          </Badge>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block leading-tight">
              Total Tagihan
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black text-primary leading-tight">
                {rupiah(total)}
              </span>
              {promo.discount > 0 && (
                <span className="text-xs text-muted-foreground line-through font-medium">
                  {rupiah(subtotal)}
                </span>
              )}
            </div>
          </div>

          <Button
            form="checkout-form"
            disabled={busy || items.length === 0}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {busy ? (
              <span>Memproses…</span>
            ) : (
              <>
                <MessageCircle className="size-4 shrink-0 fill-current" />
                <span>Kirim ke WhatsApp</span>
              </>
            )}
          </Button>
        </div>
      }
    >
      {/* Items Review List */}
      <div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            <ShoppingBag className="mx-auto size-6 text-muted-foreground/40 mb-1" />
            <p className="text-xs font-semibold text-foreground">Keranjang kosong</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li
                key={i.key}
                className="flex items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-2xs hover:border-primary/30 transition-colors"
              >
                <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted border">
                  {i.image ? (
                    <img src={i.image} alt={i.name} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground/40">
                      <UtensilsCrossed className="size-4" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="truncate font-bold text-xs sm:text-sm text-foreground">{i.name}</div>
                  {(i.choices.length > 0 || i.note) && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[...i.choices.map((c) => c.option), i.note].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="font-black text-xs sm:text-sm text-primary">
                    {rupiah(i.unit_price * i.qty)}
                    {i.qty > 1 && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">
                        ({rupiah(i.unit_price)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Stepper value={i.qty} onChange={(q) => setQty(i.key, q)} />
                  <button
                    type="button"
                    onClick={() => setQty(i.key, 0)}
                    className="text-[10px] font-semibold text-destructive hover:text-destructive/80 flex items-center gap-0.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="size-2.5" /> Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Customer & Dining Form */}
      <form id="checkout-form" onSubmit={submit} className="space-y-3 border-t border-border/80 pt-3">
        {/* Dining Type Selection Cards */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Pilihan Makan
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOrderType('DINE_IN')}
              className={`rounded-xl border p-2 text-left transition-all cursor-pointer relative ${
                orderType === 'DINE_IN'
                  ? 'border-primary bg-primary/5 text-foreground ring-1.5 ring-primary/20 shadow-2xs'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <UtensilsCrossed className="size-4 text-primary" />
                {orderType === 'DINE_IN' && (
                  <span className="size-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                    <Check className="size-2.5" />
                  </span>
                )}
              </div>
              <div className="font-bold text-xs text-foreground mt-1">Makan di Tempat</div>
            </button>

            <button
              type="button"
              onClick={() => setOrderType('TAKEAWAY')}
              className={`rounded-xl border p-2 text-left transition-all cursor-pointer relative ${
                orderType === 'TAKEAWAY'
                  ? 'border-primary bg-primary/5 text-foreground ring-1.5 ring-primary/20 shadow-2xs'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <ShoppingBag className="size-4 text-primary" />
                {orderType === 'TAKEAWAY' && (
                  <span className="size-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                    <Check className="size-2.5" />
                  </span>
                )}
              </div>
              <div className="font-bold text-xs text-foreground mt-1">Bawa Pulang</div>
            </button>
          </div>
        </div>

        {/* Customer Name */}
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <User className="size-3 text-primary" />
            <span>Nama Pemesan</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Masukkan nama Anda"
            className="h-9 rounded-lg bg-background font-medium text-xs sm:text-sm"
            required
          />
        </div>

        {/* Table Number (Only if Dine-In) */}
        {orderType === 'DINE_IN' && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <Label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Nomor Meja</span>
            </Label>
            <Input
              value={table}
              onChange={(e) => setTable(e.target.value)}
              maxLength={10}
              placeholder="Contoh: 05"
              inputMode="numeric"
              className="h-9 rounded-lg bg-background font-medium text-xs sm:text-sm"
              required
            />
          </div>
        )}

        {/* Hint promo jika ada */}
        {promo.hints.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Sparkles className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-[11px] sm:text-xs">{promo.hints[0]}</span>
          </div>
        )}

        {/* Rincian Pembayaran */}
        <div className="rounded-xl border bg-muted/40 p-2.5 sm:p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] sm:text-xs">
            <span>Subtotal ({count} item)</span>
            <span className="font-medium text-foreground">{rupiah(subtotal)}</span>
          </div>
          {promo.discount > 0 && (
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs font-medium">
              <span>Promo ({promo.appliedPromo?.name})</span>
              <span>-{rupiah(promo.discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-muted-foreground text-[11px] sm:text-xs">
            <span>Biaya Layanan</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Gratis (Rp0)</span>
          </div>
          <div className="border-t border-border/70 pt-1.5 flex items-center justify-between text-xs sm:text-sm">
            <span className="font-bold text-foreground">Total Tagihan</span>
            <span className="font-bold text-primary">{rupiah(total)}</span>
          </div>
        </div>

        <ErrorAlert message={error} />
      </form>
    </Panel>
  )
}
