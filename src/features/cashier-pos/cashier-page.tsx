import { liquid, liquidSoft } from '@shared/lib/motion'
import { Progressive } from '@shared/components/progressive'
import { CurrencyInput } from '@shared/components/currency-input'
import { BarSkeleton } from '@shared/components/skeletons'
import { LiquidPill } from '@shared/components/liquid-pill'
import { AnimatedRupiah } from '@shared/components/animated-rupiah'
import { Bookmark, ChevronDown, History, ListOrdered, Merge, PackageX, QrCode, Search, Split, Trash2 } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { Collapse, SwapText, pop } from '@shared/components/motion'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { addItem, cartTotal, itemKey, setItemQty, toLines, type CartItem } from '@features/cart-checkout'
import { ProductPicker, categoryIcon, useCatalog } from '@features/menu-catalog'
import { ConfirmButton } from '@shared/components/confirm-button'
import { ErrorAlert } from '@shared/components/error-alert'
import { Stepper } from '@shared/components/stepper'
import { StockDialog } from '@shared/components/stock-dialog'
import { CashierSkeleton } from '@shared/components/page-skeleton'
import { MenuImage } from '@shared/components/menu-image'
import { SmartImage } from '@shared/components/smart-image'
import { Button, buttonVariants } from '@shared/components/ui/button'
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
import { createMidtransQris } from '@shared/lib/midtrans'
import { QrisModal } from '@features/cart-checkout/qris-modal'
import {
  CreatedOrderSchema,
  MemberSchema,
  OrderSchema,
  can,
  PAYMENT_LABEL,
  type Member,
  type Order,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type Product,
  isSellable,
} from '@shared/types/contracts'

const CASHIER_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'QRIS_STATIC', 'EDC_CARD']
import { MergePanel, SplitPanel } from './components/bill-tools'
import { ExtrasBox } from './components/extras-box'
import { HistoryDrawer } from './components/history-drawer'
import { Receipt } from './components/receipt'
import { OpenShiftCard, ShiftBar } from './components/shift'
import { STATUS, matches, sortQueue } from './components/order-queue'

const ACTIVE: OrderStatus[] = ['UNPAID', 'IN_KITCHEN', 'READY']

const PILL = 'relative h-10 rounded-full border bg-card px-4 aria-pressed:border-primary aria-pressed:bg-transparent aria-pressed:text-primary-foreground'
const CHOICE = 'relative h-10 aria-pressed:border-primary aria-pressed:bg-transparent aria-pressed:text-accent-foreground'

const toCartItem = (i: Order['items'][number]): CartItem => {
  const choices = i.choices.map(({ group, option }) => ({ group, option }))
  return { key: itemKey(i.product_id, choices, i.note), product_id: i.product_id, qty: i.qty, choices, note: i.note, name: i.name, unit_price: i.unit_price }
}

export function CashierPage() {
  const { orders, loading: ordersLoading } = useLiveOrders(ACTIVE)
  const { storeId, role } = useStaff()
  const { t } = useI18n()
  const { data: catalog, error: catalogError, reload } = useCatalog('id', storeId)

  // Panel kanan: pesanan WA yang dipilih (UNPAID) atau pesanan baru walk-in.
  const [params, setParams] = useSearchParams()
  // Dari halaman Antrean: "Terima bayar" membuka Jualan dengan pesanan itu terpilih
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('pesanan'))
  useEffect(() => {
    if (params.has('pesanan')) setParams({}, { replace: true })
  }, [params, setParams])
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
  const [notice, setNotice] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [midtransConfig, setMidtransConfig] = useState<{ enabled: boolean; clientKey: string; isProduction: boolean } | null>(null)
  const [qrisModal, setQrisModal] = useState<{ orderId: string; queueCode: string; total: number; qrString: string; qrUrl?: string } | null>(null)
  const { config } = useStoreConfig(storeId)
  const payer = can.pay(role)
  const { shift, status: shiftStatus, loading: shiftLoading, reload: reloadShift } = useShift(payer)

  useEffect(() => {
    if (!storeId) return
    fetch(`/api/midtrans?action=config&storeId=${storeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d?.enabled) setMidtransConfig(d)
      })
      .catch(() => {})
  }, [storeId])

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
    } else if (selectedId && !ordersLoading) reset() // tunggu antrean termuat: pesanan pilihan dari halaman Antrean belum ada di daftar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, ordersLoading])

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

  const finishPayment = async (orderId: string, payMethod: PaymentMethod = method) => {
    const { data, error } = await rpc('pay_order', {
      p_order_id: orderId,
      p_method: payMethod,
      p_cash_received: payMethod === 'CASH' ? cashN : null,
    })
    if (error) throw error
    setReceipt(OrderSchema.parse(data))
    reset()
    void reloadShift()
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

      // Jika kasir memilih QRIS dan Midtrans aktif: buka modal QRIS dinamis (nominal otomatis)
      if (method === 'QRIS_STATIC' && midtransConfig?.enabled) {
        const targetOrder = orders.find((o) => o.id === orderId) || selected
        const queueCode = targetOrder?.queue_code || 'QRIS'
        const qrisRes = await createMidtransQris(orderId, storeId || undefined)
        if (qrisRes.success && (qrisRes.qr_string || qrisRes.qr_url)) {
          setQrisModal({
            orderId,
            queueCode,
            total,
            qrString: qrisRes.qr_string || '',
            qrUrl: qrisRes.qr_url,
          })
          setBusy(false)
          return
        }
      }

      await finishPayment(orderId, method)
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
  const unpaidCount = orders.filter((o) => o.status === 'UNPAID').length
  const mq = menuQuery.trim().toLowerCase()
  const products = (catalog?.products ?? []).filter((p) => (!category || p.category_id === category) && p.name.toLowerCase().includes(mq))
  const imageOf = (productId: string) => catalog?.products.find((p) => p.id === productId)?.image_url

  return (
    <div className="grid gap-4 p-3 pb-24 md:grid-cols-[1fr_20rem] md:pb-3 lg:grid-cols-[1fr_24rem] lg:gap-5 lg:p-5">
      <div className="min-w-0 space-y-5">
        {payer && shiftLoading && <BarSkeleton />}
        <AnimatePresence mode="wait" initial={false}>
          {payer && !shiftLoading && (
            <m.div key={shift ? 'bar' : 'open'} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }} transition={liquid}>
              {shift ? <ShiftBar shift={shift} onChange={reloadShift} /> : <div id="shift-card" className="scroll-mt-4"><OpenShiftCard status={shiftStatus} role={role} onOpened={reloadShift} /></div>}
            </m.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {notice && (
            <m.p key={notice} role="status" {...pop} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">{notice}</m.p>
          )}
        </AnimatePresence>

        {/* Antrean lengkap ada di halaman Antrean; di sini cukup cari cepat (ketik kode lalu Enter) + jumlah yang menunggu bayar */}
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border-2 bg-card p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              onKeyDown={(e) => {
                const first = queue.find((o) => o.status === 'UNPAID')
                if (e.key === 'Enter' && first) {
                  setSelectedId(first.id)
                  setOrderQuery('')
                }
              }}
              placeholder="Ketik kode pesanan (042) lalu Enter…"
              aria-label="Cari pesanan"
              className="h-12 pl-11 text-base"
            />
          </div>
          <Link to="/antrean" className={buttonVariants({ variant: unpaidCount ? 'default' : 'outline', className: 'h-12 shrink-0 px-4 text-base font-bold' })}>
            <ListOrdered /> {unpaidCount ? `${unpaidCount} menunggu bayar` : 'Antrean'}
          </Link>
          <Button variant="outline" className="h-12 shrink-0 px-4 text-base" onClick={() => setHistoryOpen(true)}>
            <History /> Riwayat
          </Button>
          {oq && (
            <div className="flex w-full flex-wrap gap-2" aria-label="Hasil pencarian pesanan">
              {queue.slice(0, 6).map((o) => (
                <Button
                  key={o.id}
                  variant="outline"
                  disabled={o.status !== 'UNPAID'}
                  onClick={() => { setSelectedId(o.id); setOrderQuery('') }}
                  className="h-11 gap-2 text-base"
                >
                  <span className="font-mono font-bold">{o.queue_code}</span> {o.customer_name}
                  <span className="text-sm text-muted-foreground">· {STATUS[o.status as keyof typeof STATUS]?.label}</span>
                </Button>
              ))}
              {queue.length === 0 && <p className="text-base text-muted-foreground">Tidak ada pesanan dengan kode atau nama itu.</p>}
            </div>
          )}
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
                  <MenuImage src={p.image_url} alt="" aspectRatio="aspect-[3/2]" fallbackIconSize="size-6" width={220} priority={idx < 8} />
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
      <aside id="ringkasan" className="transition-[top] duration-200 md:sticky md:top-[calc(var(--header-h,4rem)+0.5rem)] md:self-start">
        <Card className="gap-0 py-0 transition-[height] duration-200 md:h-[calc(100dvh-var(--header-h,4rem)-1.5rem)]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-3">
            <div className="min-w-0">
              <CardTitle><SwapText value={selected ? `Pesanan #${selected.queue_code}` : 'Pesanan baru'} /></CardTitle>
              <CardDescription className="truncate">
                {selected
                  ? `${selected.customer_name} · ${selected.order_type === 'DINE_IN' ? `Meja ${selected.table_no}` : 'Bawa pulang'}`
                  : <SwapText value={items.reduce((n, i) => n + i.qty, 0)} className="tabular-nums" />}{!selected && ' barang'}
              </CardDescription>
            </div>
            {/* Aksi sekunder kecil di pojok (pola Square/Moka), supaya tombol bayar di bawah bisa satu & lebar */}
            <div className="flex shrink-0 items-center gap-1">
              <AnimatePresence initial={false} mode="popLayout">
              {payer && !selected && items.length > 0 && (
                <m.div key="later" {...pop}>
                <Button variant="outline" size="sm" disabled={busy} onClick={saveOpenBill} className="h-10 px-3" title="Simpan pesanan dulu, bayar nanti">
                  <Bookmark /> Bayar nanti
                </Button>
                </m.div>
              )}
              {(selected || items.length > 0) && (
                <m.div key="trash" {...pop}>
                <ConfirmButton
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  className="size-10 text-destructive hover:text-destructive"
                  title={selected ? `Batalkan pesanan ${selected.queue_code}?` : 'Hapus pesanan ini?'}
                  description={selected ? 'Pesanan ini ditandai batal dan hilang dari antrean.' : 'Semua barang yang sudah dipilih akan dihapus dari pesanan.'}
                  confirmLabel={selected ? 'Batalkan pesanan' : 'Ya, hapus pesanan'}
                  onConfirm={selected ? cancel : reset}
                  aria-label={selected ? 'Batalkan pesanan' : 'Hapus semua pesanan'}
                >
                  <Trash2 />
                </ConfirmButton>
                </m.div>
              )}
              </AnimatePresence>
            </div>
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
                  <AnimatePresence initial={false}>
                    {orderType === 'DINE_IN' && (
                      <m.div key="meja" initial={{ width: 0, opacity: 0 }} animate={{ width: '6rem', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={liquidSoft} className="shrink-0 overflow-hidden">
                        <Input value={table} onChange={(e) => setTable(e.target.value)} maxLength={10} placeholder="Meja" aria-label="Nomor meja" className="w-24" />
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            <AnimatePresence initial={false}>
              {items.length === 0 && (
                <m.p key="empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }} transition={liquidSoft} className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Ketuk menu untuk menambah, atau pilih pesanan di antrean.
                </m.p>
              )}
            </AnimatePresence>
            {items.length > 0 && (
              <ul className="space-y-2.5">
                <AnimatePresence initial={false}>
                {items.map((i) => {
                  const img = imageOf(i.product_id)
                  return (
                    <m.li
                      key={i.key}
                      layout="position"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }}
                      transition={liquid}
                      className="flex items-center gap-3 border-b pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">{img && <SmartImage src={img} alt="" width={44} priority />}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{i.name}</div>
                        {(i.choices.length > 0 || i.note) && (
                          <div className="truncate text-xs text-muted-foreground">{[...i.choices.map((c) => c.option), i.note].filter(Boolean).join(' · ')}</div>
                        )}
                        <SwapText value={i.unit_price * i.qty} className="text-sm font-bold tabular-nums">{rupiah(i.unit_price * i.qty)}</SwapText>
                      </div>
                      {/* kurangi sampai 0 = hapus barang */}
                      <Stepper value={i.qty} min={0} onChange={(v) => edit(setItemQty(items, i.key, v))} />
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
                className="grid w-full grid-cols-3 gap-1.5"
                variant="outline"
                value={[method]}
                onValueChange={(v) => v[0] !== undefined && setMethod(v[0] as PaymentMethod)}
              >
                {CASHIER_PAYMENT_METHODS.map((m) => (
                  <ToggleGroupItem key={m} value={m} className={`${CHOICE} text-xs py-2 px-1 text-center`}>
                    {method === m && <LiquidPill id="cashier-pay" className="rounded-md bg-accent" />}
                    <span className="relative truncate">{PAYMENT_LABEL[m]}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Collapse open={method === 'QRIS_STATIC'}>
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <QrCode className="size-3.5 text-primary" /> QRIS {midtransConfig?.enabled ? 'Dinamis (Otomatis)' : 'Statis'}
                    </p>
                    {midtransConfig?.enabled && (
                      <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                        Nominal Pas
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {midtransConfig?.enabled
                      ? 'Scan via GoPay, BCA, Livin, Mandiri, ShopeePay, Dana dll. Nominal otomatis pas sesuai pesanan.'
                      : 'Tunjukkan QRIS toko ke pelanggan, lalu verifikasi pembayaran.'}
                  </p>
                </div>
              </Collapse>
              <Collapse open={method === 'CASH'}>
                <div className="space-y-2 pt-0.5">
                  <CurrencyInput value={cash} onValueChange={setCash} placeholder="Uang diterima" aria-label="Uang diterima" />
                  <div className="flex flex-wrap gap-2">
                    {[total, 50_000, 100_000].map((v, n) => (
                      <Button key={n} variant="secondary" className="h-10 flex-1" onClick={() => setCash(String(v))}>
                        {n === 0 ? 'Uang pas' : rupiah(v)}
                      </Button>
                    ))}
                  </div>
                </div>
              </Collapse>
            </div>
            )}
          </CardContent>

          <div className="space-y-2.5 border-t bg-card p-3 lg:p-4">
            {/* Rincian dilipat; yang selalu terlihat cukup Total (pola Moka/Majoo) */}
            <div>
              <button type="button" aria-expanded={detailOpen} onClick={() => setDetailOpen((o) => !o)} className="flex min-h-9 w-full items-center justify-between text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Rincian harga
                  <m.span animate={{ rotate: detailOpen ? 180 : 0 }} transition={liquid} className="inline-flex"><ChevronDown className="size-4" aria-hidden /></m.span>
                </span>
                <AnimatePresence initial={false}>
                  {payer && method === 'CASH' && cashN >= total && total > 0 && (
                    <m.span key="kembali" {...pop} className="font-semibold text-foreground">Kembalian <SwapText value={cashN - total}>{rupiah(cashN - total)}</SwapText></m.span>
                  )}
                </AnimatePresence>
              </button>
              <Collapse open={detailOpen}>
              {(() => {
                // Rincian lengkap: tiap baris punya keterangan kecil (persen, dasar hitung, nama promo)
                const pct = (bp?: number) => (bp ? `${(bp / 100).toLocaleString('id-ID')}%` : '')
                const count = (selected ? selected.items : items).reduce((n, i) => n + i.qty, 0)
                const discount = view.promo + view.voucher + view.points
                const afterDiscount = view.subtotal - discount
                const rows: { label: string; note?: string; value: string; tone?: 'good' | 'bold' | 'bad' }[] = [
                  { label: 'Subtotal', note: `${count} barang`, value: rupiah(view.subtotal) },
                  ...(view.promo > 0 ? [{ label: 'Promo', note: view.promoName ?? 'Diskon', value: `-${rupiah(view.promo)}`, tone: 'good' as const }] : []),
                  ...(view.voucher > 0 ? [{ label: 'Voucher', note: code || undefined, value: `-${rupiah(view.voucher)}`, tone: 'good' as const }] : []),
                  ...(view.points > 0 ? [{ label: 'Tukar poin', note: member?.name, value: `-${rupiah(view.points)}`, tone: 'good' as const }] : []),
                  ...(discount > 0 ? [{ label: 'Setelah potongan', value: rupiah(afterDiscount), tone: 'bold' as const }] : []),
                  ...(view.service > 0 ? [{ label: 'Service', note: pct(config?.service_bp), value: rupiah(view.service) }] : []),
                  ...(view.tax > 0 ? [{ label: config?.tax_inclusive ? 'Pajak (sudah termasuk)' : 'Pajak', note: pct(config?.tax_bp), value: rupiah(view.tax) }] : []),
                  ...(view.rounding !== 0 ? [{ label: 'Pembulatan', note: config?.rounding_to && config.rounding_to > 1 ? `ke Rp${config.rounding_to.toLocaleString('id-ID')} terdekat` : undefined, value: `${view.rounding < 0 ? '-' : '+'}${rupiah(Math.abs(view.rounding))}` }] : []),
                ]
                const paying = payer && method === 'CASH' && cashN > 0
                return (
                  <dl className="mt-1 space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
                    {rows.map((r) => (
                      <div key={r.label} className={`flex items-baseline justify-between gap-2 ${r.tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : r.tone === 'bold' ? 'border-t pt-1 font-semibold text-foreground' : 'text-foreground/80'}`}>
                        <dt className="min-w-0">
                          {r.label}
                          {r.note && <span className="ml-1.5 text-xs text-muted-foreground">{r.note}</span>}
                        </dt>
                        <dd className="shrink-0 tabular-nums">{r.value}</dd>
                      </div>
                    ))}
                    {paying && (
                      <>
                        <div className="flex justify-between gap-2 border-t pt-1 text-foreground/80">
                          <dt>Uang diterima <span className="ml-1.5 text-xs text-muted-foreground">Tunai</span></dt>
                          <dd className="tabular-nums">{rupiah(cashN)}</dd>
                        </div>
                        <div className={`flex justify-between gap-2 font-semibold ${cashN >= total ? 'text-foreground' : 'text-destructive'}`}>
                          <dt>{cashN >= total ? 'Kembalian' : 'Uang kurang'}</dt>
                          <dd className="tabular-nums">{rupiah(Math.abs(cashN - total))}</dd>
                        </div>
                      </>
                    )}
                    {view.earned > 0 && (
                      <p className="border-t pt-1 text-xs text-muted-foreground">Member dapat {view.earned.toLocaleString('id-ID')} poin dari pesanan ini</p>
                    )}
                  </dl>
                )
              })()}
              </Collapse>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold">Total</span>
              <span className="text-2xl font-extrabold tabular-nums"><AnimatedRupiah value={total} /></span>
            </div>

            <ErrorAlert message={error} />

            {/* Satu tombol utama, lebar penuh, nominal tertulis di tombol */}
            {payer && !hasShift && !needsSave ? (
              <div className="space-y-1">
                <Button
                  size="lg"
                  onClick={() => {
                    const card = document.getElementById('shift-card')
                    card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    card?.querySelector<HTMLInputElement>('#open-cash')?.focus({ preventScroll: true })
                  }}
                  className="h-14 w-full text-lg font-bold transition-transform active:scale-[0.98]"
                >
                  <SwapText value={shiftStatus?.open && !shiftStatus.open.mine ? 'Laci dipegang orang lain' : 'Buka Kasir dulu'} />
                </Button>
                {shiftStatus?.open && !shiftStatus.open.mine && (
                  <p className="text-center text-xs text-muted-foreground">Minta {shiftStatus.open.who ?? 'kasir sebelumnya'} menutup kasirnya dulu.</p>
                )}
              </div>
            ) : payer || needsSave ? (
              <Button size="lg" disabled={busy || !canSubmit} onClick={submit} className="h-14 w-full text-lg font-bold transition-transform active:scale-[0.98]">
                <SwapText value={busy ? 'Memproses…' : needsSave ? 'Simpan Perubahan' : selected ? 'Terima' : 'Bayar'} />
                {!busy && !needsSave && <AnimatedRupiah value={total} />}
              </Button>
            ) : (
              !selected && (
                <Button size="lg" disabled={busy || items.length === 0} onClick={saveOpenBill} className="h-14 w-full text-lg font-bold transition-transform active:scale-[0.98]">
                  <SwapText value={busy ? 'Menyimpan…' : 'Simpan pesanan'} />
                </Button>
              )
            )}
            {selected && !dirty && can.floor(role) && (
              <div className="rounded-lg border">
                <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className="flex min-h-11 w-full items-center justify-between px-3 text-base font-semibold">
                  Pilihan lain
                  <m.span animate={{ rotate: moreOpen ? 180 : 0 }} transition={liquid} className="inline-flex"><ChevronDown className="size-5" aria-hidden /></m.span>
                </button>
                <Collapse open={moreOpen}>
                  <div className="grid grid-cols-2 gap-2 border-t p-2">
                    <Button variant="outline" className="h-12" onClick={() => setSplitOpen(true)} disabled={selected.items.length < 2}>
                      <Split /> Pisah tagihan
                    </Button>
                    <Button variant="outline" className="h-12" onClick={() => setMergeOpen(true)}>
                      <Merge /> Gabung tagihan
                    </Button>
                  </div>
                </Collapse>
              </div>
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
        <Receipt order={receipt} store={{ name: catalog.store.name, address: config?.address, footer: config?.receipt_footer, logo: config?.logo }} onClose={() => setReceipt(null)} />
      )}
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
      {qrisModal && (
        <QrisModal
          orderId={qrisModal.orderId}
          queueCode={qrisModal.queueCode}
          total={qrisModal.total}
          qrString={qrisModal.qrString}
          qrUrl={qrisModal.qrUrl}
          storeId={storeId || undefined}
          closeLabel="Tutup / Simpan Pesanan"
          onManualConfirm={async () => {
            const id = qrisModal.orderId
            setQrisModal(null)
            setBusy(true)
            try {
              await finishPayment(id, 'QRIS_STATIC')
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            } finally {
              setBusy(false)
            }
          }}
          onSuccess={async () => {
            const id = qrisModal.orderId
            setQrisModal(null)
            setBusy(true)
            try {
              await finishPayment(id, 'QRIS_STATIC')
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            } finally {
              setBusy(false)
            }
          }}
          onClose={() => setQrisModal(null)}
        />
      )}
    </div>
  )
}
