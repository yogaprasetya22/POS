import { SmartImage } from '@shared/components/smart-image'
import { LiquidPill } from '@shared/components/liquid-pill'
import { cancelMyOrder, saveMyOrder, updateMyOrder } from './my-orders'
import { AnimatedRupiah } from '@shared/components/animated-rupiah'
import { CheckCircle2, Clock, CreditCard, QrCode, Send, Sparkles, Trash2 } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Stepper } from '@shared/components/stepper'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { Label } from '@shared/components/ui/label'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import { calculatePromo } from '@shared/lib/promo'
import { useQuote } from '@shared/lib/use-quote'
import { createMidtransQris } from '@shared/lib/midtrans'
import { InlineQris } from './inline-qris'
import { CheckoutSchema, CreatedOrderSchema, type OrderType, type Product, type Promotion } from '@shared/types/contracts'
import { cartTotal, toLines } from './cart'
import { useCartStore } from './store/cart-store'

export function CheckoutPanel({
  storeId,
  defaultTable,
  promotions = [],
  products = [],
  onClose,
}: {
  storeId: string
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
  const [payMethod, setPayMethod] = useState<'QRIS' | 'CASHIER'>('QRIS')
  const [midtransConfig, setMidtransConfig] = useState<{ enabled: boolean; clientKey: string; isProduction: boolean } | null>(null)
  const [qrisData, setQrisData] = useState<{
    orderId: string
    queueCode: string
    total: number
    qrString?: string
    qrUrl?: string
    snapToken?: string
    clientKey?: string
    isProduction?: boolean
    isFallback?: boolean
    notice?: string
  } | null>(null)
  const [done, setDone] = useState<{ queue_code: string; total: number; isPaid?: boolean } | null>(null)
  const [inputCode, setInputCode] = useState('')
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/midtrans?action=config&storeId=${storeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.enabled) {
          setMidtransConfig(data)
          setPayMethod('QRIS')
        } else {
          setPayMethod('CASHIER')
        }
      })
      .catch(() => setPayMethod('CASHIER'))
  }, [storeId])

  const count = items.reduce((n, i) => n + i.qty, 0)
  const subtotal = cartTotal(items)
  const promo = calculatePromo(items, promotions, products, appliedCode)
  const bonusValue = promo.bonusItem ? promo.bonusItem.unitPrice * promo.bonusItem.qty : 0
  const grossSubtotal = subtotal + bonusValue
  const totalDiscount = promo.discount + bonusValue
  const localTotal = Math.max(0, grossSubtotal - totalDiscount)
  // Total final (promo + service + pajak + pembulatan) dihitung database, sama persis dengan yang disimpan di pesanan.
  const { quote } = useQuote({ storeId, lines: toLines(items, promo.bonusItem), code: appliedCode ?? '' })
  const total = quote?.total ?? localTotal
  const totalItemCount = count + (promo.bonusItem?.qty ?? 0)

  const handleApplyCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const clean = inputCode.trim().toUpperCase()
    if (!clean) return
    const res = calculatePromo(items, promotions, products, clean)
    if (res.codeStatus === 'VALID') {
      setAppliedCode(clean)
      setCodeFeedback(null)
      setInputCode('')
    } else if (res.codeStatus === 'EXPIRED') {
      setCodeFeedback('Periode promo ini telah berakhir')
    } else if (res.codeStatus === 'NOT_STARTED') {
      setCodeFeedback('Periode promo ini belum dimulai')
    } else {
      setCodeFeedback('Kode promo tidak ditemukan')
    }
  }

  const handleRemoveCode = () => {
    setAppliedCode(null)
    setCodeFeedback(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const parsed = CheckoutSchema.safeParse({
      customer_name: name,
      order_type: orderType,
      table_no: orderType === 'DINE_IN' ? table : '',
      lines: toLines(items, promo.bonusItem),
      promo_code: appliedCode ?? undefined,
    })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    const v = parsed.data

    setBusy(true)
    const { data, error: rpcError } = await rpc('create_order', {
      p_store_id: storeId,
      p_customer_name: v.customer_name,
      p_order_type: v.order_type,
      p_table_no: v.table_no || null,
      p_lines: v.lines,
      p_promo_code: appliedCode ?? null,
    }, { asPublic: true })

    if (rpcError) {
      setBusy(false)
      return setError(`Pesanan gagal: ${rpcError.message}`)
    }

    const created = CreatedOrderSchema.parse(data)
    saveMyOrder(storeId, {
      id: created.id,
      queue_code: created.queue_code,
      total: created.total,
      pay_method: payMethod === 'QRIS' && midtransConfig?.enabled ? 'QRIS' : 'CASHIER',
      table_no: orderType === 'DINE_IN' ? (table?.trim() || null) : null,
      order_type: orderType,
      is_unpaid: true,
    })

    // Jika bayar via QRIS Dinamis Midtrans (Sisi Pembeli, nominal otomatis)
    if (payMethod === 'QRIS' && midtransConfig?.enabled) {
      try {
        const qrisRes = await createMidtransQris(created.id, storeId)
        if (qrisRes.success && (qrisRes.qr_string || qrisRes.qr_url || qrisRes.snap_token)) {
          clear()
          setBusy(false)
          setQrisData({
            orderId: created.id,
            queueCode: created.queue_code,
            total: created.total,
            qrString: qrisRes.qr_string || '',
            qrUrl: qrisRes.qr_url,
            snapToken: qrisRes.snap_token,
            clientKey: qrisRes.client_key || midtransConfig.clientKey,
            isProduction: qrisRes.is_production ?? midtransConfig.isProduction,
            isFallback: qrisRes.is_fallback,
            notice: qrisRes.notice,
          })
          return
        } else {
          setBusy(false)
          setError(qrisRes.error || 'Gagal memuat QRIS dinamis. Silakan coba lagi atau pilih opsi Bayar di Kasir.')
          return
        }
      } catch (err) {
        setBusy(false)
        setError(err instanceof Error ? err.message : 'Terjadi kendala saat memuat QRIS. Silakan pilih opsi Bayar di Kasir.')
        return
      }
    }

    setBusy(false)
    clear()
    setDone({ queue_code: created.queue_code, total: created.total, isPaid: false })
  }

  if (done) {
    return (
      <Panel onClose={onClose} title={done.isPaid ? 'Pembayaran Berhasil' : 'Pesanan Terkirim ke Kasir'} footer={null}>
        <div className="flex flex-col items-center py-8 text-center">
          {done.isPaid ? (
            <CheckCircle2 className="size-14 text-emerald-600" aria-hidden />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Clock className="size-8" aria-hidden />
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {done.isPaid ? 'Pembayaran terkonfirmasi otomatis' : 'Pesanan menunggu pembayaran di kasir'}
          </p>
          <p className="mt-1 font-mono text-5xl font-bold tracking-tight" data-testid="queue-code">{done.queue_code}</p>
          <p className="mt-4 text-lg font-semibold tabular-nums">Total {rupiah(done.total)}</p>
          {done.isPaid ? (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="size-3.5" /> Lunas via QRIS Dinamis · Langsung Diproses Dapur
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 max-w-xs">
              <p className="font-semibold">Belum Dibayar</p>
              <p className="mt-1">
                Tunjukkan kode antrean di atas ke kasir untuk membayar tunai atau kartu.
              </p>
            </div>
          )}
          <Button size="lg" className="mt-8 w-full max-w-xs" onClick={onClose}>Selesai</Button>
        </div>
      </Panel>
    )
  }

  const handlePayAtCashierInstead = () => {
    if (!qrisData) return
    updateMyOrder(storeId, qrisData.orderId, { pay_method: 'CASHIER' })
    setDone({ queue_code: qrisData.queueCode, total: qrisData.total, isPaid: false })
    setQrisData(null)
  }

  const handleCancelOrder = () => {
    if (qrisData?.orderId) {
      cancelMyOrder(storeId, qrisData.orderId)
    }
    setQrisData(null)
    onClose()
  }

  return (
    <Panel
      onClose={onClose}
      title={qrisData ? 'Pembayaran QRIS' : `Pesanan kamu (${totalItemCount})`}
      aside={
        qrisData ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-muted-foreground"
          >
            Tutup
          </Button>
        ) : undefined
      }
      footer={
        qrisData ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePayAtCashierInstead}
              className="text-xs font-semibold"
            >
              Bayar di Kasir Saja
            </Button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelOrder}
                className="text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Batalkan
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onClose}
                className="text-xs font-semibold"
              >
                Cek Pesanan
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-lg font-bold tabular-nums">
                <AnimatedRupiah value={total} />
                {totalDiscount > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{rupiah(grossSubtotal)}</span>}
              </p>
            </div>
            <Button form="checkout-form" size="lg" disabled={busy || items.length === 0} className="h-12 shrink-0 px-5 text-base font-semibold">
              {busy ? (
                'Menghubungkan…'
              ) : payMethod === 'QRIS' && midtransConfig?.enabled ? (
                <>
                  <QrCode className="mr-1.5 size-4" /> Bayar QRIS ({rupiah(total)})
                </>
              ) : (
                <>
                  <Send className="mr-1.5 size-4" /> Kirim pesanan
                </>
              )}
            </Button>
          </div>
        )
      }
    >
      {qrisData ? (
        <InlineQris
          orderId={qrisData.orderId}
          queueCode={qrisData.queueCode}
          total={qrisData.total}
          qrString={qrisData.qrString}
          qrUrl={qrisData.qrUrl}
          snapToken={qrisData.snapToken}
          clientKey={qrisData.clientKey}
          isProduction={qrisData.isProduction}
          isFallback={qrisData.isFallback}
          notice={qrisData.notice}
          storeId={storeId}
          initialSeconds={300}
          onSuccess={() => {
            updateMyOrder(storeId, qrisData.orderId, { is_unpaid: false })
            setDone({ queue_code: qrisData.queueCode, total: qrisData.total, isPaid: true })
            setQrisData(null)
          }}
          onBack={onClose}
        />
      ) : (
        <>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">Belum ada menu yang dipilih.</p>
      ) : (
        <ul className="divide-y">
          <AnimatePresence initial={false}>
          {items.map((i) => {
            const itemPromo = promotions.find(
              (p) =>
                p.is_active &&
                ((p.scope === 'PRODUCT' && p.target_id === i.product_id) ||
                  (p.scope === 'CATEGORY' && products.find((pr) => pr.id === i.product_id)?.category_id === p.target_id)),
            )
            return (
              <m.li
                key={i.key}
                layout="position"
                exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }}
                className="flex gap-3 overflow-hidden py-3 first:pt-0"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {i.image && <SmartImage src={i.image} alt="" width={56} priority />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-5">{i.name}</p>
                  {(i.choices.length > 0 || i.note) && (
                    <p className="text-sm text-muted-foreground">{[...i.choices.map((c) => c.option), i.note].filter(Boolean).join(' · ')}</p>
                  )}
                  {itemPromo && (
                    <p className="text-sm text-primary">
                      {itemPromo.type === 'BUY_X_GET_Y'
                        ? `Beli ${itemPromo.buy_qty} gratis ${itemPromo.get_qty}`
                        : itemPromo.type === 'PERCENTAGE'
                          ? `Diskon ${itemPromo.discount_percent}%`
                          : `Hemat ${rupiah(itemPromo.discount_amount)}`}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-semibold tabular-nums">{rupiah(i.unit_price * i.qty)}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Hapus ${i.name}`} onClick={() => setQty(i.key, 0)} className="text-destructive">
                        <Trash2 />
                      </Button>
                      <Stepper value={i.qty} onChange={(q) => setQty(i.key, q)} />
                    </div>
                  </div>
                </div>
              </m.li>
            )
          })}
          </AnimatePresence>
          {promo.bonusItem && (
            <li className="flex gap-3 py-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {promo.bonusItem.image && <SmartImage src={promo.bonusItem.image} alt="" width={56} priority />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-5">
                  {promo.bonusItem.qty}× {promo.bonusItem.name}
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">Gratis dari promo {promo.bonusItem.promoName}</p>
              </div>
            </li>
          )}
        </ul>
      )}

      <form id="checkout-form" onSubmit={submit} className="space-y-4 border-t pt-4">
        <ToggleGroup
          aria-label="Makan di mana"
          className="grid w-full grid-cols-2 gap-2"
          value={[orderType]}
          onValueChange={(v) => v[0] !== undefined && setOrderType(v[0] as typeof orderType)}
        >
          {[['DINE_IN', 'Makan di tempat'], ['TAKEAWAY', 'Bawa pulang']].map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} className="relative h-11 rounded-lg border bg-card aria-pressed:border-foreground aria-pressed:bg-transparent aria-pressed:text-background">
              {orderType === v && <LiquidPill id="co-type" className="rounded-lg" />}
              <span className="relative">{l}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <div className={`space-y-1.5 ${orderType === 'DINE_IN' ? '' : 'col-span-2'}`}>
            <Label htmlFor="co-name">Nama</Label>
            <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nama kamu" className="h-11" required />
          </div>
          {orderType === 'DINE_IN' && (
            <div className="space-y-1.5">
              <Label htmlFor="co-table">Meja</Label>
              <Input id="co-table" value={table} onChange={(e) => setTable(e.target.value)} maxLength={10} inputMode="numeric" className="h-11" required />
            </div>
          )}
        </div>

        {promo.bonusItem || promo.discount > 0 ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">
            {promo.appliedPromo?.name}: {promo.bonusItem ? `+${promo.bonusItem.qty} gratis, hemat ${rupiah(bonusValue)}` : `hemat ${rupiah(promo.discount)}`}
          </p>
        ) : (
          promo.hints.length > 0 && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{promo.hints[0]}</p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="co-code">Kode promo</Label>
          {appliedCode ? (
            <div className="flex h-11 items-center justify-between rounded-lg border px-3 text-sm">
              <span className="font-mono font-semibold">{appliedCode}</span>
              <button type="button" onClick={handleRemoveCode} className="h-full px-2 font-medium text-destructive">Hapus</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id="co-code"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase())
                  if (codeFeedback) setCodeFeedback(null)
                }}
                placeholder="Opsional"
                className="h-11 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleApplyCode()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => handleApplyCode()} disabled={!inputCode.trim()} className="h-11 px-4">
                Pakai
              </Button>
            </div>
          )}
          {codeFeedback && <p className="text-sm text-destructive">{codeFeedback}</p>}
        </div>

        {midtransConfig?.enabled && (
          <div className="space-y-2 border-t pt-3">
            <Label className="text-sm font-semibold">Pilih Cara Pembayaran</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPayMethod('QRIS')}
                className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  payMethod === 'QRIS'
                    ? 'border-primary bg-primary/5 ring-1.5 ring-primary'
                    : 'border-border/70 bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <QrCode className="size-3.5 text-primary" /> QRIS Dinamis
                  </span>
                  <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                    Otomatis
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  GoPay, OVO, Dana, BCA, Mandiri dll
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPayMethod('CASHIER')}
                className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  payMethod === 'CASHIER'
                    ? 'border-primary bg-primary/5 ring-1.5 ring-primary'
                    : 'border-border/70 bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-muted-foreground" /> Di Kasir
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Bayar tunai atau EDC di kasir
                </span>
              </button>
            </div>
            {payMethod === 'QRIS' && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium pt-0.5">
                <Sparkles className="size-3" /> Nominal harga otomatis terisi saat scan QRIS di HP kamu.
              </p>
            )}
          </div>
        )}

        <dl className="space-y-1.5 border-t pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal ({totalItemCount} item)</dt>
            <dd className="tabular-nums">{rupiah(grossSubtotal)}</dd>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <dt>Potongan{promo.bonusItem ? ` (termasuk ${promo.bonusItem.name} gratis)` : ''}</dt>
              <dd className="tabular-nums">-{rupiah(totalDiscount)}</dd>
            </div>
          )}
          {quote && quote.service > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Service</dt>
              <dd className="tabular-nums">{rupiah(quote.service)}</dd>
            </div>
          )}
          {quote && quote.tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Pajak</dt>
              <dd className="tabular-nums">{rupiah(quote.tax)}</dd>
            </div>
          )}
          {quote && quote.rounding !== 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Pembulatan</dt>
              <dd className="tabular-nums">{quote.rounding < 0 ? '-' : ''}{rupiah(Math.abs(quote.rounding))}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums"><AnimatedRupiah value={total} /></dd>
          </div>
        </dl>

        <ErrorAlert message={error} />
      </form>
      </>
    )}
  </Panel>
  )
}
