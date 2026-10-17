import { CheckCircle2, CirclePlus, ClipboardList, PackageX, ReceiptText, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { addItem, cartTotal, itemKey, setItemQty, toLines, type CartItem } from '@features/cart-checkout'
import { ProductPicker, categoryIcon, useCatalog } from '@features/menu-catalog'
import { ConfirmButton } from '@shared/components/confirm-button'
import { ErrorAlert } from '@shared/components/error-alert'
import { Stepper } from '@shared/components/stepper'
import { StockDialog } from '@shared/components/stock-dialog'
import { ToneBadge } from '@shared/components/tone-badge'
import { CashierSkeleton } from '@shared/components/page-skeleton'
import { MenuImage } from '@shared/components/menu-image'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { useStaff } from '@shared/lib/auth'
import { useLiveOrders } from '@shared/lib/orders'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import { calculatePromo } from '@shared/lib/promo'
import {
  CreatedOrderSchema,
  OrderSchema,
  PAYMENT_LABEL,
  PaymentMethodSchema,
  type Order,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type Product,
} from '@shared/types/contracts'
import { Receipt } from './components/receipt'

const ACTIVE: OrderStatus[] = ['UNPAID', 'IN_KITCHEN', 'READY']
const STATUS = {
  UNPAID: { tone: 'amber', label: 'Menunggu bayar' },
  IN_KITCHEN: { tone: 'blue', label: 'Dimasak' },
  READY: { tone: 'green', label: 'Siap diambil' },
} as const

const PILL = 'rounded-full bg-card px-4 shadow-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground'
const CHOICE = 'h-10 aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground'

const toCartItem = (i: Order['items'][number]): CartItem => {
  const choices = i.choices.map(({ group, option }) => ({ group, option }))
  return { key: itemKey(i.product_id, choices, i.note), product_id: i.product_id, qty: i.qty, choices, note: i.note, name: i.name, unit_price: i.unit_price }
}

export function CashierPage() {
  const orders = useLiveOrders(ACTIVE)
  const { storeId } = useStaff()
  const { data: catalog, error: catalogError, reload } = useCatalog('id', storeId)

  // Panel kanan: pesanan WA yang dipilih (UNPAID) atau pesanan baru walk-in.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [dirty, setDirty] = useState(false)
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN')
  const [customer, setCustomer] = useState('')
  const [table, setTable] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [cash, setCash] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState<Product | null>(null)
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [orderQuery, setOrderQuery] = useState('')
  const [menuQuery, setMenuQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [stockOpen, setStockOpen] = useState(false)

  const soldOutCount = catalog?.products.filter((p) => !p.is_available).length ?? 0

  const handleToggleAvailability = async (productId: string, isAvailable: boolean) => {
    const { error: err } = await supabase.from('products').update({ is_available: isAvailable }).eq('id', productId)
    if (err) {
      setError(`Gagal mengubah status menu: ${err.message}`)
    } else {
      reload()
    }
  }

  useEffect(() => {
    const run = () => supabase.rpc('expire_stale_orders').then(({ error }) => error && console.error(error))
    run()
    const t = setInterval(run, 60_000)
    return () => clearInterval(t)
  }, [])

  const selected = orders.find((o) => o.id === selectedId && o.status === 'UNPAID')
  const reset = () => {
    setSelectedId(null)
    setItems([])
    setDirty(false)
    setCash('')
    setCustomer('')
    setTable('')
    setError('')
  }

  // Sinkron dengan server: isi ulang draft saat order berubah via realtime; tutup jika sudah dibayar/batal di tempat lain.
  const syncKey = selected ? `${selected.id}:${selected.total}:${selected.items.length}` : ''
  useEffect(() => {
    if (selected) {
      setItems(selected.items.map(toCartItem))
      setDirty(false)
    } else if (selectedId) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey])

  if (catalogError) return <div className="p-6 text-destructive font-semibold">{catalogError}</div>
  if (!catalog) return <CashierSkeleton />

  const edit = (next: CartItem[]) => {
    setItems(next)
    setDirty(true)
  }
  const addProduct = (p: Product) =>
    p.modifiers.length
      ? setPicking(p)
      : edit(addItem(items, { key: itemKey(p.id, [], ''), product_id: p.id, qty: 1, choices: [], note: '', name: p.name, unit_price: p.price, image: p.image_url }))
  const qtyOf = (productId: string) => items.filter((i) => i.product_id === productId).reduce((n, i) => n + i.qty, 0)

  const subtotal = cartTotal(items)
  const promoCalc = calculatePromo(items, catalog?.promotions ?? [], catalog?.products ?? [])
  const discountAmount = selected && !dirty ? selected.discount_amount : promoCalc.discount
  const promoName = selected && !dirty ? selected.promo_name : promoCalc.appliedPromo?.name
  const total = selected && !dirty ? selected.total : Math.max(0, subtotal - discountAmount)
  const cashN = Number(cash) || 0
  const needsSave = !!selected && dirty
  const canSubmit = items.length > 0 && (needsSave || method !== 'CASH' || cashN >= total)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      if (needsSave && selected) {
        const { error } = await supabase.rpc('update_order_lines', { p_order_id: selected.id, p_lines: toLines(items) })
        if (error) throw error
        return setDirty(false)
      }
      let orderId = selected?.id
      if (!orderId) {
        if (orderType === 'DINE_IN' && !table.trim()) throw new Error('Nomor meja wajib untuk makan di tempat')
        const { data, error } = await supabase.rpc('create_order', {
          p_store_id: storeId,
          p_customer_name: customer.trim() || 'Pelanggan',
          p_order_type: orderType,
          p_table_no: orderType === 'DINE_IN' ? table.trim() : null,
          p_lines: toLines(items),
        })
        if (error) throw error
        orderId = CreatedOrderSchema.parse(data).id
        setSelectedId(orderId) // jika bayar gagal, pesanan tetap terbuka sebagai UNPAID
      }
      const { data, error } = await supabase.rpc('pay_order', {
        p_order_id: orderId,
        p_method: method,
        p_cash_received: method === 'CASH' ? cashN : null,
      })
      if (error) throw error
      setReceipt(OrderSchema.parse(data))
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!selected) return
    const { error } = await supabase.rpc('advance_order', { p_order_id: selected.id, p_to: 'CANCELLED' })
    if (error) return setError(error.message)
    reset()
  }

  const oq = orderQuery.trim().toLowerCase()
  const queue = orders.filter((o) => o.queue_code.toLowerCase().includes(oq) || o.customer_name.toLowerCase().includes(oq))
  const mq = menuQuery.trim().toLowerCase()
  const products = (catalog?.products ?? []).filter((p) => (!category || p.category_id === category) && p.name.toLowerCase().includes(mq))
  const imageOf = (productId: string) => catalog?.products.find((p) => p.id === productId)?.image_url

  return (
    <div className="grid gap-6 p-4 pb-24 md:p-6 lg:grid-cols-[1fr_22rem] lg:pb-6 xl:grid-cols-[1fr_25rem]">
      <div className="min-w-0 space-y-6">
        {/* Antrean pesanan */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              Antrean Pesanan
              <Badge className="size-6 rounded-full p-0">{orders.length}</Badge>
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                onKeyDown={(e) => {
                  const first = queue.find((o) => o.status === 'UNPAID')
                  if (e.key === 'Enter' && first) setSelectedId(first.id)
                }}
                placeholder="Cari kode (042) / nama…"
                aria-label="Cari pesanan"
                className="pl-10"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {queue.map((o) => {
              const s = STATUS[o.status as keyof typeof STATUS]
              const clickable = o.status === 'UNPAID'
              return (
                <Button key={o.id} variant="ghost" disabled={!clickable} onClick={() => setSelectedId(o.id)} className="w-60 shrink-0 h-auto justify-start whitespace-normal rounded-xl bg-transparent p-0 text-left font-normal hover:bg-transparent disabled:opacity-100">
                  <Card className={`w-full ${o.id === selectedId ? 'ring-2 ring-primary' : clickable ? 'transition hover:ring-primary/40' : ''}`}>
                    <CardContent className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-bold">
                          <ReceiptText className="size-4 text-primary" aria-hidden /> #{o.queue_code}
                        </span>
                        <span className="text-xs text-muted-foreground">{o.items.reduce((n, i) => n + i.qty, 0)} Item</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.customer_name} · {o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang'}
                      </p>
                      <ToneBadge tone={s.tone} className="mt-2 h-6 w-full justify-between">
                        {s.label} <CheckCircle2 aria-hidden />
                      </ToneBadge>
                    </CardContent>
                  </Card>
                </Button>
              )
            })}
            {queue.length === 0 && <p className="py-6 text-sm text-muted-foreground">Belum ada pesanan aktif.</p>}
          </div>
        </section>

        {/* Menu */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">
                Menu <span className="text-muted-foreground">({catalog?.products.length ?? 0})</span>
              </h2>
              {soldOutCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStockOpen(true)}
                  className="h-6 px-2 text-[11px] font-bold text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <PackageX className="size-3 mr-1" /> {soldOutCount} Habis
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={menuQuery} onChange={(e) => setMenuQuery(e.target.value)} placeholder="Cari menu…" aria-label="Cari menu" className="pl-10" />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStockOpen(true)}
                className="h-9 px-3 text-xs font-semibold shrink-0 gap-1.5 rounded-lg"
                title="Kelola Ketersediaan Menu"
              >
                <PackageX className="size-4" />
                <span className="hidden md:inline">Stok Menu</span>
              </Button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto pb-1 scrollbar-none">
            <ToggleGroup
              aria-label="Kategori"
              className="w-max"
              value={[category ?? 'all']}
              onValueChange={(v) => v[0] !== undefined && setCategory(v[0] === 'all' ? null : v[0])}
            >
              {[{ id: null, name: 'Semua Menu' }, ...(catalog?.categories ?? [])].map((c) => {
                const Icon = categoryIcon(c.id === null ? null : c.name)
                return (
                  <ToggleGroupItem key={c.id ?? 'all'} value={c.id ?? 'all'} className={PILL}>
                    <Icon /> {c.name}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((p) => {
              const qty = qtyOf(p.id)
              const simple = p.modifiers.length === 0
              return (
                <Card key={p.id} className={`gap-3 p-3 ${qty ? 'ring-2 ring-primary/60' : ''} ${p.is_available ? '' : 'opacity-50 grayscale'}`}>
                  <MenuImage src={p.image_url} alt={p.name} className="rounded-xl" />
                  <div>
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-sm font-semibold text-primary">{rupiah(p.price)}</p>
                  </div>
                  {!p.is_available ? (
                    <Badge variant="secondary" className="w-full justify-center">Habis</Badge>
                  ) : qty && simple ? (
                    <div className="flex items-center justify-between gap-2">
                      <Button size="sm">
                        Dipilih <CheckCircle2 />
                      </Button>
                      <Stepper value={qty} min={0} onChange={(v) => edit(setItemQty(items, itemKey(p.id, [], ''), v))} />
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full border-primary text-primary" onClick={() => addProduct(p)}>
                      {qty ? `Tambah lagi (${qty})` : 'Tambah Item'} <CirclePlus />
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      </div>

      {/* Ringkasan pesanan */}
      <aside id="ringkasan" className="lg:sticky lg:top-20 lg:self-start">
        <Card className="gap-0 py-0 lg:max-h-[calc(100dvh-6rem)]">
          <CardHeader className="border-b py-4">
            <CardTitle>Ringkasan Pesanan</CardTitle>
            <CardDescription>
              {selected
                ? `#${selected.queue_code} · ${selected.customer_name} · ${selected.order_type === 'DINE_IN' ? `Meja ${selected.table_no}` : 'Bawa pulang'}`
                : 'Pesanan baru (walk-in)'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 py-4 scrollbar-none lg:flex-1 lg:overflow-y-auto">
            {!selected && (
              <>
                <ToggleGroup
                  aria-label="Tipe pesanan"
                  className="grid w-full grid-cols-2"
                  variant="outline"
                  value={[orderType]}
                  onValueChange={(v) => v[0] !== undefined && setOrderType(v[0] as OrderType)}
                >
                  <ToggleGroupItem value="DINE_IN" className={CHOICE}>Dine In</ToggleGroupItem>
                  <ToggleGroupItem value="TAKEAWAY" className={CHOICE}>Take Away</ToggleGroupItem>
                </ToggleGroup>
                <div className="flex gap-2">
                  <Input value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={40} placeholder="Nama pelanggan" aria-label="Nama pelanggan" />
                  {orderType === 'DINE_IN' && (
                    <Input value={table} onChange={(e) => setTable(e.target.value)} maxLength={10} placeholder="Meja" aria-label="Nomor meja" className="w-24" />
                  )}
                </div>
              </>
            )}

            <p className="font-semibold">
              Total Item <span className="text-muted-foreground">({items.reduce((n, i) => n + i.qty, 0)})</span>
            </p>
            {items.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                <ClipboardList className="size-8 text-muted-foreground/40" aria-hidden />
                Pilih pesanan di antrean atau tambah menu.
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((i) => {
                  const img = imageOf(i.product_id)
                  return (
                    <li key={i.key} className="flex items-start gap-3 rounded-2xl border p-2.5">
                      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-accent">{img && <img src={img} alt="" className="size-full object-cover" />}</div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{i.name}</div>
                            {(i.choices.length > 0 || i.note) && (
                              <div className="truncate text-xs text-muted-foreground">{[...i.choices.map((c) => c.option), i.note].filter(Boolean).join(' · ')}</div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0 text-destructive hover:text-destructive" aria-label={`Hapus ${i.name}`} onClick={() => edit(setItemQty(items, i.key, 0))}>
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-primary">{rupiah(i.unit_price * i.qty)}</span>
                          <Stepper value={i.qty} min={0} onChange={(v) => edit(setItemQty(items, i.key, v))} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="space-y-3 rounded-2xl border p-4">
              <p className="font-semibold">Pembayaran</p>
              <ToggleGroup
                aria-label="Metode pembayaran"
                className="grid w-full grid-cols-3"
                variant="outline"
                value={[method]}
                onValueChange={(v) => v[0] !== undefined && setMethod(v[0] as PaymentMethod)}
              >
                {PaymentMethodSchema.options.map((m) => (
                  <ToggleGroupItem key={m} value={m} className={`${CHOICE} text-xs`}>
                    {PAYMENT_LABEL[m]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {method === 'CASH' && (
                <div className="space-y-2">
                  <Input inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))} placeholder="Uang diterima" aria-label="Uang diterima" />
                  <div className="flex flex-wrap gap-2">
                    {[total, 50_000, 100_000].map((v, n) => (
                      <Button key={n} variant="secondary" size="sm" onClick={() => setCash(String(v))}>
                        {n === 0 ? 'Uang pas' : rupiah(v)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>

          <div className="space-y-3 border-t bg-card p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{rupiah(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Promo ({promoName ?? 'Diskon'})</span>
                  <span>-{rupiah(discountAmount)}</span>
                </div>
              )}
              {method === 'CASH' && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Kembalian</span>
                  <span>{cashN >= total ? rupiah(cashN - total) : '—'}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>Total</span>
                <span className="text-primary">{rupiah(total)}</span>
              </div>
            </div>

            <ErrorAlert message={error} />

            <Button size="lg" disabled={busy || !canSubmit} onClick={submit} className="w-full">
              {busy ? 'Memproses…' : needsSave ? 'Simpan Perubahan' : selected ? 'Terima Pembayaran' : 'Buat & Bayar'}
            </Button>
            {selected ? (
              <ConfirmButton
                variant="ghost"
                disabled={busy}
                className="w-full text-destructive hover:text-destructive"
                title={`Batalkan pesanan ${selected.queue_code}?`}
                description="Pesanan ini ditandai batal dan hilang dari antrean."
                confirmLabel="Batalkan pesanan"
                onConfirm={cancel}
              >
                Batalkan pesanan
              </ConfirmButton>
            ) : (
              items.length > 0 && (
                <Button variant="ghost" disabled={busy} onClick={reset} className="w-full">
                  Kosongkan
                </Button>
              )
            )}
          </div>
        </Card>
      </aside>

      {/* Layar kecil: ringkasan ada di bawah menu, jadi total & pintasan selalu terlihat */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t bg-card p-3 lg:hidden">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{items.length ? `${items.reduce((n, i) => n + i.qty, 0)} item` : 'Belum ada item'}</p>
          <p className="font-bold">{rupiah(total)}</p>
        </div>
        <Button onClick={() => document.getElementById('ringkasan')?.scrollIntoView({ behavior: 'smooth' })}>Lihat pesanan</Button>
      </div>

      {picking && <ProductPicker product={picking} onAdd={(i) => edit(addItem(items, i))} onClose={() => setPicking(null)} />}
      {receipt && catalog && <Receipt order={receipt} storeName={catalog.store.name} onClose={() => setReceipt(null)} />}
      <StockDialog
        open={stockOpen}
        onOpenChange={setStockOpen}
        products={catalog?.products ?? []}
        onToggleAvailability={handleToggleAvailability}
      />
    </div>
  )
}
