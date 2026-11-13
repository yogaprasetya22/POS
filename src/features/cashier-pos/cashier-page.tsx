import { liquid } from '@shared/lib/motion'
import { Progressive } from '@shared/components/progressive'
import { CurrencyInput } from '@shared/components/currency-input'
import { BarSkeleton } from '@shared/components/skeletons'
import { LiquidPill } from '@shared/components/liquid-pill'
import { AnimatedRupiah } from '@shared/components/animated-rupiah'
import { ChevronDown, History, ListOrdered, Merge, PackageX, Search, Split, Trash2 } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState } from 'react'
import { addItem, cartTotal, itemKey, setItemQty, toLines, type CartItem } from '@features/cart-checkout'
import { ProductPicker, categoryIcon, useCatalog } from '@features/menu-catalog'
import { ConfirmButton } from '@shared/components/confirm-button'
import { ErrorAlert } from '@shared/components/error-alert'
import { Stepper } from '@shared/components/stepper'
import { StockDialog } from '@shared/components/stock-dialog'
import { CashierSkeleton } from '@shared/components/page-skeleton'
import { MenuImage } from '@shared/components/menu-image'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { useStaff } from '@shared/lib/auth'
import { useI18n } from '@shared/i18n'
import { useShift } from '@shared/lib/use-shift'
import { useQuote } from '@shared/lib/use-quote'
import { useStoreConfig } from '@shared/lib/store-config'
import { useLiveOrders } from '@shared/lib/orders'
import { supabase } from '@shared/lib/supabase'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import { calculatePromo } from '@shared/lib/promo'
import {
  CreatedOrderSchema,
  MemberSchema,
  OrderSchema,
  can,
  PAYMENT_LABEL,
  PaymentMethodSchema,
  type Member,
  type Order,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type Product,
  isSellable,
} from '@shared/types/contracts'
import { MergePanel, SplitPanel } from './components/bill-tools'
import { ExtrasBox } from './components/extras-box'
import { HistoryDrawer } from './components/history-drawer'
import { Receipt } from './components/receipt'
import { OpenShiftCard, ShiftBar } from './components/shift'
import { AllOrdersDrawer, QueueSection, fromCustomer, matches, sortQueue } from './components/order-queue'

const ACTIVE: OrderStatus[] = ['UNPAID', 'IN_KITCHEN', 'READY']

const PILL = 'relative h-10 rounded-full border bg-card px-4 aria-pressed:border-primary aria-pressed:bg-transparent aria-pressed:text-primary-foreground'
const CHOICE = 'relative h-10 aria-pressed:border-primary aria-pressed:bg-transparent aria-pressed:text-accent-foreground'

const toCartItem = (i: Order['items'][number]): CartItem => {
  const choices = i.choices.map(({ group, option }) => ({ group, option }))
  return { key: itemKey(i.product_id, choices, i.note), product_id: i.product_id, qty: i.qty, choices, note: i.note, name: i.name, unit_price: i.unit_price }
}

export function CashierPage() {
  const { orders } = useLiveOrders(ACTIVE)
  const { storeId, role } = useStaff()
  const { t } = useI18n()
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
  const [code, setCode] = useState('')
  const [member, setMember] = useState<Member | null>(null)
  const [redeem, setRedeem] = useState(0)
  const [splitOpen, setSplitOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const [allSource, setAllSource] = useState<'all' | 'customer' | 'cashier'>('all')
  const [notice, setNotice] = useState('')
  const { config } = useStoreConfig(storeId)
  const payer = can.pay(role)
  const { shift, status: shiftStatus, loading: shiftLoading, reload: reloadShift } = useShift(payer)

  const soldOutCount = catalog?.products.filter((p) => !isSellable(p)).length ?? 0

  const handleToggleAvailability = async (productId: string, isAvailable: boolean) => {
    const { error: err } = await rpc('set_product_availability', { p_product: productId, p_available: isAvailable })
    if (err) {
      setError(`Gagal mengubah status menu: ${err.message}`)
    } else {
      reload()
    }
  }

  useEffect(() => {
    const run = () => rpc('expire_stale_orders').then(({ error }) => error && console.error(error))
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
    setCode('')
    setMember(null)
    setRedeem(0)
  }

  // Sinkron dengan server: isi ulang draft saat order berubah via realtime; tutup jika sudah dibayar/batal di tempat lain.
  const syncKey = selected ? `${selected.id}:${selected.total}:${selected.items.length}` : ''
  useEffect(() => {
    if (selected) {
      setItems(selected.items.map(toCartItem))
      setDirty(false)
      setCode(selected.promo_code ?? '')
      setRedeem(selected.points_redeemed)
      if (!selected.member_id) setMember(null)
      else
        supabase.from('members').select('*').eq('id', selected.member_id).maybeSingle().then(({ data }) => {
          const parsed = MemberSchema.safeParse(data)
          setMember(parsed.success ? parsed.data : null)
        })
    } else if (selectedId) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey])

  const lines = toLines(items)
  const savedView = !!selected && !dirty
  const { quote, loading: quoteLoading } = useQuote({ storeId, lines, code, memberId: member?.id ?? null, redeem, enabled: !savedView })

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

  // Total selalu dari database: pesanan tersimpan memakai angka tersimpan, draft memakai quote_order.
  const subtotalLocal = cartTotal(items)
  const promoCalc = calculatePromo(items, catalog?.promotions ?? [], catalog?.products ?? [])
  const view = savedView
    ? {
        subtotal: selected.subtotal || selected.total + selected.discount_amount,
        promo: selected.discount_amount, promoName: selected.promo_name, voucher: selected.voucher_discount, points: selected.points_discount,
        service: selected.service_amount, tax: selected.tax_amount, rounding: selected.rounding_amount, total: selected.total, earned: selected.points_earned,
      }
    : quote
      ? {
          subtotal: quote.subtotal, promo: quote.promo_discount, promoName: quote.promo_name, voucher: quote.voucher_discount, points: quote.points_discount,
          service: quote.service, tax: quote.tax, rounding: quote.rounding, total: quote.total, earned: quote.points_earned,
        }
      : {
          subtotal: subtotalLocal, promo: promoCalc.discount, promoName: promoCalc.appliedPromo?.name ?? null, voucher: 0, points: 0,
          service: 0, tax: 0, rounding: 0, total: Math.max(0, subtotalLocal - promoCalc.discount), earned: 0,
        }
  const total = view.total
  const cashN = Number(cash) || 0
  const needsSave = !!selected && dirty
  const hasShift = !payer || !!shift
  const canSubmit = items.length > 0 && hasShift && (needsSave || method !== 'CASH' || cashN >= total)

  // Kode/member/poin pada pesanan tersimpan langsung diterapkan di server; pada draft cukup disimpan di state.
  const applyExtras = async (next: { code?: string; member?: Member | null; redeem?: number }) => {
    const c = next.code ?? code
    const m = next.member === undefined ? member : next.member
    const r = next.redeem ?? redeem
    setCode(c)
    setMember(m)
    setRedeem(r)
    if (selected && !dirty) {
      const { error: err } = await rpc('apply_order_extras', { p_order_id: selected.id, p_promo_code: c || null, p_member_id: m?.id ?? null, p_redeem_points: r })
      if (err) setError(err.message)
    }
  }

  const createDraft = async () => {
    if (orderType === 'DINE_IN' && !table.trim()) throw new Error('Nomor meja wajib untuk makan di tempat')
    const { data, error } = await rpc('create_order', {
      p_store_id: storeId,
      p_customer_name: customer.trim() || 'Pelanggan',
      p_order_type: orderType,
      p_table_no: orderType === 'DINE_IN' ? table.trim() : null,
      p_lines: toLines(items),
      p_promo_code: code || null,
      p_member_id: member?.id ?? null,
      p_redeem_points: redeem,
    })
    if (error) throw error
    return CreatedOrderSchema.parse(data).id
  }

  // Open bill: simpan pesanan tanpa membayar (dine-in makan dulu bayar belakangan, atau dibuat pelayan).
  const saveOpenBill = async () => {
    setBusy(true)
    setError('')
    try {
      const id = await createDraft()
      const row = (await supabase.from('orders').select('queue_code').eq('id', id).maybeSingle()).data
      reset()
      setNotice(`Pesanan ${row?.queue_code ?? ''} disimpan, menunggu pembayaran.`)
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      if (needsSave && selected) {
        const { error } = await rpc('update_order_lines', { p_order_id: selected.id, p_lines: toLines(items) })
        if (error) throw error
        return setDirty(false)
      }
      let orderId = selected?.id
      if (!orderId) {
        if (orderType === 'DINE_IN' && !table.trim()) throw new Error('Nomor meja wajib untuk makan di tempat')
        orderId = await createDraft()
        setSelectedId(orderId) // jika bayar gagal, pesanan tetap terbuka sebagai UNPAID
      }
      if (!shift) throw new Error(t('shift.required'))
      const { data, error } = await rpc('pay_order', {
        p_order_id: orderId,
        p_method: method,
        p_cash_received: method === 'CASH' ? cashN : null,
      })
      if (error) throw error
      setReceipt(OrderSchema.parse(data))
      reset()
      void reloadShift()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!selected) return
    const { error } = await rpc('advance_order', { p_order_id: selected.id, p_to: 'CANCELLED' })
    if (error) return setError(error.message)
    reset()
  }

  const oq = orderQuery.trim().toLowerCase()
  const queue = sortQueue(orders).filter((o) => matches(o, oq))
  const mq = menuQuery.trim().toLowerCase()
  const products = (catalog?.products ?? []).filter((p) => (!category || p.category_id === category) && p.name.toLowerCase().includes(mq))
  const imageOf = (productId: string) => catalog?.products.find((p) => p.id === productId)?.image_url

  return (
    <div className="grid gap-4 p-3 pb-24 md:grid-cols-[1fr_20rem] md:pb-3 lg:grid-cols-[1fr_24rem] lg:gap-5 lg:p-5">
      <div className="min-w-0 space-y-5">
        {payer && shiftLoading && <BarSkeleton />}
        {payer && !shiftLoading && (shift ? <ShiftBar shift={shift} onChange={reloadShift} /> : <OpenShiftCard status={shiftStatus} role={role} onOpened={reloadShift} />)}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">{notice}</p>}

        {/* Antrean pesanan: dipisah pelanggan (QR) & kasir, masing-masing maksimal 10; sisanya di "Semua pesanan" */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              Antrean Pesanan
              <Badge className="size-6 rounded-full p-0">{orders.length}</Badge>
            </h2>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button className="h-10 shrink-0" onClick={() => { setAllSource('all'); setAllOpen(true) }}>
                <ListOrdered /> <span>Semua pesanan</span>
              </Button>
              <Button variant="outline" className="h-10 shrink-0" onClick={() => setHistoryOpen(true)}>
                <History /> <span>Riwayat</span>
              </Button>
              <div className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
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
          </div>
          <QueueSection source="customer" orders={queue.filter(fromCustomer)} selectedId={selectedId} onPick={setSelectedId} onShowAll={() => { setAllSource('customer'); setAllOpen(true) }} />
          <QueueSection source="cashier" orders={queue.filter((o) => !fromCustomer(o))} selectedId={selectedId} onPick={setSelectedId} onShowAll={() => { setAllSource('cashier'); setAllOpen(true) }} />
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
                <span>Stok Menu</span>
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
                    {category === c.id && <LiquidPill id="cashier-cat" className="bg-primary" />}
                    <Icon className="relative" /> <span className="relative">{c.name}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          </div>

          {/* Ubin menu: ketuk seluruh kartu untuk menambah; jumlah diatur di ringkasan */}
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5">
            <Progressive items={products} resetKey={`${category}|${menuQuery}`}>
            {(rows) => (
            <AnimatePresence mode="popLayout" initial={false}>
            {rows.map((p, idx) => {
              const qty = qtyOf(p.id)
              return (
                <m.button
                  key={p.id}
                  type="button"
                  layout="position"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ ...liquid, delay: Math.min(idx, 12) * 0.02 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={!isSellable(p)}
                  onClick={() => addProduct(p)}
                  className={`relative flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors disabled:opacity-50 disabled:grayscale ${qty ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
                >
                  <MenuImage src={p.image_url} alt="" aspectRatio="aspect-[3/2]" fallbackIconSize="size-6" />
                  <div className="w-full p-2.5">
                    <p className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{p.name}</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{isSellable(p) ? rupiah(p.price) : 'Habis'}{isSellable(p) && p.portions !== null && p.portions <= 5 && <span className="ml-1 text-xs font-normal text-amber-600">· sisa {p.portions}</span>}</p>
                  </div>
                  {qty > 0 && (
                    <m.span key={qty} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute right-2 top-2 grid min-w-7 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-sm font-bold text-primary-foreground tabular-nums">
                      {qty}
                    </m.span>
                  )}
                </m.button>
              )
            })}
            </AnimatePresence>
            )}
            </Progressive>
          </div>
        </section>
      </div>

      {/* Ringkasan pesanan */}
      <aside id="ringkasan" className="md:sticky md:top-18 md:self-start">
        <Card className="gap-0 py-0 md:max-h-[calc(100dvh-5.5rem)]">
          <CardHeader className="border-b py-3">
            <CardTitle>Ringkasan Pesanan</CardTitle>
            <CardDescription>
              {selected
                ? `#${selected.queue_code} · ${selected.customer_name} · ${selected.order_type === 'DINE_IN' ? `Meja ${selected.table_no}` : 'Bawa pulang'}`
                : 'Pesanan baru'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 py-4 scrollbar-none md:flex-1 md:overflow-y-auto">
            {!selected && (
              <>
                <ToggleGroup
                  aria-label="Tipe pesanan"
                  className="grid w-full grid-cols-2"
                  variant="outline"
                  value={[orderType]}
                  onValueChange={(v) => v[0] !== undefined && setOrderType(v[0] as OrderType)}
                >
                  {(['DINE_IN', 'TAKEAWAY'] as const).map((v) => (
                    <ToggleGroupItem key={v} value={v} className={CHOICE}>
                      {orderType === v && <LiquidPill id="cashier-type" className="rounded-md bg-accent" />}
                      <span className="relative">{v === 'DINE_IN' ? 'Makan di sini' : 'Bawa pulang'}</span>
                    </ToggleGroupItem>
                  ))}
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
              Barang dipesan <span className="text-muted-foreground">({items.reduce((n, i) => n + i.qty, 0)})</span>
            </p>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                Ketuk menu untuk menambah, atau pilih pesanan di antrean.
              </p>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                {items.map((i) => {
                  const img = imageOf(i.product_id)
                  return (
                    <m.li
                      key={i.key}
                      layout="position"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
                      className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">{img && <img src={img} alt="" className="size-full object-cover" />}</div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{i.name}</div>
                            {(i.choices.length > 0 || i.note) && (
                              <div className="truncate text-xs text-muted-foreground">{[...i.choices.map((c) => c.option), i.note].filter(Boolean).join(' · ')}</div>
                            )}
                          </div>
                          <Button variant="ghost" className="-mt-1 -mr-1 h-11 shrink-0 px-2 text-destructive hover:text-destructive" aria-label={`Hapus ${i.name}`} onClick={() => edit(setItemQty(items, i.key, 0))}>
                            <Trash2 /> Hapus
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold tabular-nums">{rupiah(i.unit_price * i.qty)}</span>
                          <Stepper value={i.qty} min={0} onChange={(v) => edit(setItemQty(items, i.key, v))} />
                        </div>
                      </div>
                    </m.li>
                  )
                })}
                </AnimatePresence>
              </ul>
            )}

            {items.length > 0 && can.floor(role) && (
              <ExtrasBox
                config={config}
                code={code}
                onCode={(c) => applyExtras({ code: c })}
                member={member}
                onMember={(m) => applyExtras({ member: m, redeem: m ? redeem : 0 })}
                redeem={redeem}
                onRedeem={(n) => applyExtras({ redeem: n })}
                quote={savedView ? null : quote}
                checking={quoteLoading}
              />
            )}

            {payer && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-semibold">Pembayaran</p>
              <ToggleGroup
                aria-label="Metode pembayaran"
                className="grid w-full grid-cols-3"
                variant="outline"
                value={[method]}
                onValueChange={(v) => v[0] !== undefined && setMethod(v[0] as PaymentMethod)}
              >
                {PaymentMethodSchema.options.map((m) => (
                  <ToggleGroupItem key={m} value={m} className={`${CHOICE} text-xs`}>
                    {method === m && <LiquidPill id="cashier-pay" className="rounded-md bg-accent" />}
                    <span className="relative">{PAYMENT_LABEL[m]}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {method === 'CASH' && (
                <div className="space-y-2">
                  <CurrencyInput value={cash} onValueChange={setCash} placeholder="Uang diterima" aria-label="Uang diterima" />
                  <div className="flex flex-wrap gap-2">
                    {[total, 50_000, 100_000].map((v, n) => (
                      <Button key={n} variant="secondary" className="h-10 flex-1" onClick={() => setCash(String(v))}>
                        {n === 0 ? 'Uang pas' : rupiah(v)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}
          </CardContent>

          <div className="space-y-3 border-t bg-card p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{rupiah(view.subtotal)}</span>
              </div>
              {view.promo > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Promo ({view.promoName ?? 'Diskon'})</span>
                  <span className="tabular-nums">-{rupiah(view.promo)}</span>
                </div>
              )}
              {view.voucher > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Voucher</span>
                  <span className="tabular-nums">-{rupiah(view.voucher)}</span>
                </div>
              )}
              {view.points > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Poin</span>
                  <span className="tabular-nums">-{rupiah(view.points)}</span>
                </div>
              )}
              {view.service > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Service</span>
                  <span className="tabular-nums">{rupiah(view.service)}</span>
                </div>
              )}
              {view.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Pajak</span>
                  <span className="tabular-nums">{rupiah(view.tax)}</span>
                </div>
              )}
              {view.rounding !== 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Pembulatan</span>
                  <span className="tabular-nums">{view.rounding < 0 ? '-' : ''}{rupiah(Math.abs(view.rounding))}</span>
                </div>
              )}
              {payer && method === 'CASH' && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Kembalian</span>
                  <span>{cashN >= total ? rupiah(cashN - total) : '—'}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums"><AnimatedRupiah value={total} /></span>
              </div>
            </div>

            <ErrorAlert message={error} />

            {payer && !hasShift && <p className="text-sm text-muted-foreground">{t('shift.required')}</p>}
            {payer || needsSave ? (
              <Button size="lg" disabled={busy || !canSubmit} onClick={submit} className="h-16 w-full text-xl font-bold">
                {busy ? 'Memproses…' : needsSave ? 'Simpan Perubahan' : selected ? 'Terima Pembayaran' : 'Buat & Bayar'}
              </Button>
            ) : (
              !selected && (
                <Button size="lg" disabled={busy || items.length === 0} onClick={saveOpenBill} className="h-16 w-full text-xl font-bold">
                  {busy ? 'Menyimpan…' : 'Simpan pesanan'}
                </Button>
              )
            )}
            {payer && !selected && items.length > 0 && (
              <Button variant="outline" disabled={busy} onClick={saveOpenBill} className="h-12 w-full text-base">
                Simpan dulu, bayar nanti
              </Button>
            )}
            {selected && !dirty && can.floor(role) && (
              <details className="group rounded-lg border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
                  Pilihan lain <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="grid grid-cols-2 gap-2 border-t p-2">
                  <Button variant="outline" className="h-12" onClick={() => setSplitOpen(true)} disabled={selected.items.length < 2}>
                    <Split /> Pisah tagihan
                  </Button>
                  <Button variant="outline" className="h-12" onClick={() => setMergeOpen(true)}>
                    <Merge /> Gabung tagihan
                  </Button>
                </div>
              </details>
            )}
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
                <ConfirmButton
                  variant="ghost"
                  disabled={busy}
                  className="h-12 w-full text-base text-destructive hover:text-destructive"
                  title="Hapus pesanan ini?"
                  description="Semua barang yang sudah dipilih akan dihapus dari pesanan. Ini tidak bisa dibatalkan."
                  confirmLabel="Ya, hapus pesanan"
                  onConfirm={reset}
                >
                  Hapus pesanan
                </ConfirmButton>
              )
            )}
          </div>
        </Card>
      </aside>

      {/* Layar kecil: ringkasan ada di bawah menu, jadi total & pintasan selalu terlihat */}
      <div className="fixed inset-x-0 bottom-(--bottom-nav) z-20 flex items-center gap-3 border-t bg-card p-3 md:hidden">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{items.length ? `${items.reduce((n, i) => n + i.qty, 0)} item` : 'Belum ada item'}</p>
          <p className="font-bold">{rupiah(total)}</p>
        </div>
        <Button className="h-12 px-5 text-base" onClick={() => document.getElementById('ringkasan')?.scrollIntoView({ behavior: 'smooth' })}>Lihat pesanan</Button>
      </div>

      {picking && <ProductPicker product={picking} onAdd={(i) => edit(addItem(items, i))} onClose={() => setPicking(null)} />}
      {receipt && catalog && (
        <Receipt order={receipt} store={{ name: catalog.store.name, address: config?.address, footer: config?.receipt_footer }} onClose={() => setReceipt(null)} />
      )}
      <AllOrdersDrawer open={allOpen} onOpenChange={setAllOpen} orders={orders} initialSource={allSource} onPick={setSelectedId} />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} role={role} onReprint={(o) => { setHistoryOpen(false); setReceipt(o) }} />
      {splitOpen && selected && (
        <SplitPanel order={selected} onClose={() => setSplitOpen(false)} onDone={() => { setSplitOpen(false); setNotice('Bill dipisah. Pesanan baru ada di antrean.'); setTimeout(() => setNotice(''), 4000) }} />
      )}
      {mergeOpen && selected && <MergePanel order={selected} candidates={orders} onClose={() => setMergeOpen(false)} onDone={() => setMergeOpen(false)} />}
      <StockDialog
        open={stockOpen}
        onOpenChange={setStockOpen}
        products={catalog?.products ?? []}
        onToggleAvailability={handleToggleAvailability}
      />
    </div>
  )
}
