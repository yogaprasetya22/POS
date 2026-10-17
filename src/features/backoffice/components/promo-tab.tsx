import {
  Banknote,
  Check,
  CheckCircle2,
  Edit2,
  Folder,
  Gift,
  Info,
  Percent,
  Plus,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ConfirmButton } from '@shared/components/confirm-button'
import { ToneBadge } from '@shared/components/tone-badge'
import { Button } from '@shared/components/ui/button'
import { Card } from '@shared/components/ui/card'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@shared/components/ui/drawer'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Switch } from '@shared/components/ui/switch'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import {
  PromotionInputSchema,
  type Category,
  type Product,
  type Promotion,
  type PromotionScope,
  type PromotionType,
} from '@shared/types/contracts'

type Props = {
  storeId: string
  products: Product[]
  categories: Category[]
  reloadCatalog: () => void
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
}

/**
 * Tab Manajemen Promo & Diskon dengan tampilan premium,
 * kartu ringkasan KPI, dan drawer samping interaktif (Ponytail).
 */
export function PromoTab({ storeId, products, categories, reloadCatalog, run }: Props) {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState<PromotionType>('BUY_X_GET_Y')
  const [scope, setScope] = useState<PromotionScope>('PRODUCT')
  const [targetId, setTargetId] = useState<string>('')
  const [buyQty, setBuyQty] = useState(2)
  const [getQty, setGetQty] = useState(1)
  const [discountPercent, setDiscountPercent] = useState(15)
  const [discountAmount, setDiscountAmount] = useState(5000)
  const [minSpend, setMinSpend] = useState(0)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [productSearch, setProductSearch] = useState('')

  const fetchPromos = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('promotions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (!err && data) {
      setPromos(data as Promotion[])
    }
  }, [storeId])

  useEffect(() => {
    fetchPromos()
  }, [fetchPromos])

  const openCreateDrawer = () => {
    setEditing(null)
    setName('')
    setCode('')
    setType('BUY_X_GET_Y')
    setScope('PRODUCT')
    setTargetId(products[0]?.id ?? '')
    setBuyQty(2)
    setGetQty(1)
    setDiscountPercent(15)
    setDiscountAmount(5000)
    setMinSpend(0)
    setStartAt('')
    setEndAt('')
    setIsActive(true)
    setProductSearch('')
    setError('')
    setIsDrawerOpen(true)
  }

  const openDetailDrawer = (p: Promotion) => {
    setEditing(p)
    setName(p.name)
    setCode(p.code ?? '')
    setType(p.type)
    setScope(p.scope)
    setTargetId(p.target_id ?? '')
    setBuyQty(p.buy_qty)
    setGetQty(p.get_qty)
    setDiscountPercent(p.discount_percent)
    setDiscountAmount(p.discount_amount)
    setMinSpend(p.min_spend)
    setStartAt(p.start_at ? p.start_at.slice(0, 16) : '')
    setEndAt(p.end_at ? p.end_at.slice(0, 16) : '')
    setIsActive(p.is_active)
    setProductSearch('')
    setError('')
    setIsDrawerOpen(true)
  }

  const handleToggle = async (id: string, current: boolean) => {
    await run(supabase.from('promotions').update({ is_active: !current }).eq('id', id))
    fetchPromos()
    reloadCatalog()
  }

  const handleDelete = async (id: string) => {
    await run(supabase.from('promotions').delete().eq('id', id))
    fetchPromos()
    reloadCatalog()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const payload = {
      name: name.trim(),
      code: code.trim() ? code.trim().toUpperCase() : null,
      type,
      scope,
      target_id: scope === 'CART_TOTAL' ? null : targetId || null,
      buy_qty: type === 'BUY_X_GET_Y' ? buyQty : 1,
      get_qty: type === 'BUY_X_GET_Y' ? getQty : 1,
      discount_percent: type === 'PERCENTAGE' ? discountPercent : 0,
      discount_amount: type === 'FIXED_AMOUNT' ? discountAmount : 0,
      min_spend: minSpend,
      start_at: startAt ? new Date(startAt).toISOString() : null,
      end_at: endAt ? new Date(endAt).toISOString() : null,
      is_active: isActive,
    }

    const parsed = PromotionInputSchema.safeParse(payload)
    if (!parsed.success) {
      return setError(parsed.error.issues[0].message)
    }

    setBusy(true)
    if (editing) {
      const { error: err } = await supabase
        .from('promotions')
        .update(parsed.data)
        .eq('id', editing.id)
      setBusy(false)
      if (err) return setError(err.message)
    } else {
      const { error: err } = await supabase
        .from('promotions')
        .insert({ ...parsed.data, store_id: storeId })
      setBusy(false)
      if (err) return setError(err.message)
    }

    setIsDrawerOpen(false)
    fetchPromos()
    reloadCatalog()
  }

  const targetName = (p: { scope: PromotionScope; target_id: string | null }) => {
    if (p.scope === 'CART_TOTAL') return 'Seluruh Pesanan (Semua Menu)'
    if (p.scope === 'CATEGORY') {
      const cat = categories.find((c) => c.id === p.target_id)
      return `Kategori: ${cat?.name ?? 'Kategori Dihapus'}`
    }
    const prod = products.find((pr) => pr.id === p.target_id)
    return `Menu: ${prod?.name ?? 'Menu Dihapus'}`
  }

  // Stats KPI
  const activeCount = promos.filter((p) => p.is_active).length
  const b2g1Count = promos.filter((p) => p.type === 'BUY_X_GET_Y').length
  const discountCount = promos.filter((p) => p.type === 'PERCENTAGE' || p.type === 'FIXED_AMOUNT').length

  return (
    <div className="space-y-6">
      {/* Header Banner Modern */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-primary/5 border p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Tag className="size-3" />
              <span>Program Promo</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Promo & Diskon
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Atur promo dan diskon otomatis untuk pesanan pelanggan.
            </p>
          </div>

          <Button
            onClick={openCreateDrawer}
            size="lg"
            className="h-11 sm:h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25 gap-2 shrink-0 cursor-pointer self-start sm:self-auto active:scale-95 transition-transform"
          >
            <Plus className="size-5" />
            <span>Buat Promo Baru</span>
          </Button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Promo Aktif</p>
            <p className="text-xl font-black text-foreground">
              {activeCount} <span className="text-xs font-normal text-muted-foreground">dari {promos.length}</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="grid size-11 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
            <Gift className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Beli X Gratis Y</p>
            <p className="text-xl font-black text-foreground">{b2g1Count}</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Zap className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Diskon & Potongan</p>
            <p className="text-xl font-black text-foreground">{discountCount}</p>
          </div>
        </div>
      </div>

      {/* Daftar Promo Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-3xl border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <Card className="rounded-3xl border-dashed p-12 text-center bg-card/50">
          <div className="grid size-14 place-items-center rounded-2xl bg-muted mx-auto mb-3 text-muted-foreground/60">
            <Tag className="size-7" />
          </div>
          <h3 className="font-bold text-lg text-foreground">Belum ada promo</h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-5">
            Buat promo untuk menarik pelanggan.
          </p>
          <Button onClick={openCreateDrawer} className="rounded-xl gap-2 font-bold px-5">
            <Plus className="size-4" />
            <span>Mulai Buat Promo</span>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((p) => {
            const isB2G1 = p.type === 'BUY_X_GET_Y'
            const isPercent = p.type === 'PERCENTAGE'
            return (
              <div
                key={p.id}
                onClick={() => openDetailDrawer(p)}
                className={`group relative overflow-hidden rounded-3xl border transition-all cursor-pointer p-5 flex flex-col justify-between gap-4 ${
                  p.is_active
                    ? 'bg-card shadow-xs hover:border-primary/50 hover:shadow-md'
                    : 'bg-muted/30 border-dashed opacity-75 hover:opacity-100'
                }`}
              >
                {/* Top: Icon + Title + Switch */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`grid size-11 place-items-center rounded-2xl shrink-0 ${
                          isB2G1
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                            : isPercent
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isB2G1 ? (
                          <Gift className="size-5" />
                        ) : isPercent ? (
                          <Percent className="size-5" />
                        ) : (
                          <Banknote className="size-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                          {p.name}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                          {p.scope === 'CART_TOTAL' ? (
                            <>
                              <ShoppingBag className="size-3 text-muted-foreground/70" />
                              <span>Total Belanja</span>
                            </>
                          ) : p.scope === 'CATEGORY' ? (
                            <>
                              <Folder className="size-3 text-muted-foreground/70" />
                              <span>{targetName(p)}</span>
                            </>
                          ) : (
                            <>
                              <UtensilsCrossed className="size-3 text-muted-foreground/70" />
                              <span>{targetName(p)}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={() => handleToggle(p.id, p.is_active)}
                        aria-label="Status Promo"
                      />
                    </div>
                  </div>

                  {/* Highlight Promo Banner Pill */}
                  <div
                    className={`rounded-xl p-2.5 flex items-center justify-between text-xs font-bold ${
                      isB2G1
                        ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                        : isPercent
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <span>
                      {isB2G1
                        ? `Beli ${p.buy_qty} Gratis ${p.get_qty}`
                        : isPercent
                        ? `Diskon ${p.discount_percent}%`
                        : `Potongan ${rupiah(p.discount_amount)}`}
                    </span>
                    <ToneBadge tone={p.is_active ? 'green' : 'gray'}>
                      {p.is_active ? 'Aktif' : 'Nonaktif'}
                    </ToneBadge>
                  </div>

                  {/* Kode Promo & Periode Kampanye Badge */}
                  {(p.code || p.start_at || p.end_at) && (
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground pt-0.5">
                      {p.code && (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          <Tag className="size-2.5" />
                          <span>{p.code}</span>
                        </span>
                      )}
                      {(p.start_at || p.end_at) && (
                        <span className="truncate text-[10px]">
                          {p.start_at ? new Date(p.start_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Sekarang'} - {p.end_at ? new Date(p.end_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Seterusnya'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom: Min spend & Actions */}
                <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
                  <div>
                    {p.min_spend > 0 ? (
                      <span>Min. Belanja: <strong className="text-foreground">{rupiah(p.min_spend)}</strong></span>
                    ) : (
                      <span>Tanpa min. belanja</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openDetailDrawer(p)}
                      className="size-8 rounded-lg hover:bg-muted"
                      aria-label="Detail promo"
                    >
                      <Edit2 className="size-3.5 text-muted-foreground" />
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      size="icon-xs"
                      className="size-8 rounded-lg text-destructive hover:text-destructive"
                      title={`Hapus promo "${p.name}"?`}
                      description="Promo ini akan dihapus dan tidak berlaku lagi di katalog atau pesanan."
                      confirmLabel="Hapus Promo"
                      onConfirm={() => handleDelete(p.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </ConfirmButton>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer Samping untuk Detail & Edit/Buat Promo (Ponytail) */}
      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => !open && setIsDrawerOpen(false)}
        swipeDirection="right"
      >
        <DrawerContent
          style={{ '--drawer-content-width': 'min(100vw, 56rem)' } as React.CSSProperties}
          className="flex flex-col h-full rounded-l-3xl border-l"
        >
          <DrawerHeader className="border-b px-5 py-4 text-left">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Tag className="size-3.5" />
                  <span>{editing ? 'Detail Promo' : 'Buat Promo'}</span>
                </div>
                <DrawerTitle className="text-lg sm:text-xl font-bold">
                  {editing ? editing.name : 'Formulir Promo'}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground">
                  Atur ketentuan program promo.
                </DrawerDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsDrawerOpen(false)}
                className="size-8 rounded-full"
                aria-label="Tutup"
              >
                <X className="size-4" />
              </Button>
            </div>
          </DrawerHeader>

          <form
            id="promo-form"
            onSubmit={handleSubmit}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 scrollbar-none"
          >
            {error && (
              <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium flex items-center gap-2">
                <Info className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Live Catalog Preview Box */}
            <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/40 p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Pratinjau
              </span>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 text-primary-foreground font-bold text-[10px] px-2.5 py-0.5 shadow-xs">
                  <Tag className="size-3" />
                  <span>{name || 'Nama Promo'}</span>
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {type === 'BUY_X_GET_Y'
                    ? `Beli ${buyQty} Gratis ${getQty}`
                    : type === 'PERCENTAGE'
                    ? `Diskon ${discountPercent}%`
                    : `Potongan ${rupiah(discountAmount)}`}
                </span>
              </div>
            </div>

            {/* Nama Promo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nama Promo
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Beli 2 Gratis 1 Kopi Susu"
                className="h-10 text-xs sm:text-sm rounded-xl font-medium"
                required
              />
            </div>

            {/* Pilihan Jenis Promo */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Jenis Promo
              </Label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setType('BUY_X_GET_Y')}
                  className={`rounded-2xl border p-3 text-left transition-all cursor-pointer relative ${
                    type === 'BUY_X_GET_Y'
                      ? 'border-violet-500/50 bg-violet-500/10 text-foreground ring-2 ring-violet-500/20 shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <Gift className={`size-5 mb-1.5 ${type === 'BUY_X_GET_Y' ? 'text-violet-600 dark:text-violet-400' : ''}`} />
                  <div className="font-bold text-xs text-foreground">Beli X Gratis Y</div>
                </button>

                <button
                  type="button"
                  onClick={() => setType('PERCENTAGE')}
                  className={`rounded-2xl border p-3 text-left transition-all cursor-pointer relative ${
                    type === 'PERCENTAGE'
                      ? 'border-amber-500 bg-amber-500/10 text-foreground ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <Percent className={`size-5 mb-1.5 ${type === 'PERCENTAGE' ? 'text-amber-600' : ''}`} />
                  <div className="font-bold text-xs text-foreground">Diskon %</div>
                </button>

                <button
                  type="button"
                  onClick={() => setType('FIXED_AMOUNT')}
                  className={`rounded-2xl border p-3 text-left transition-all cursor-pointer relative ${
                    type === 'FIXED_AMOUNT'
                      ? 'border-emerald-600 bg-emerald-600/10 text-foreground ring-2 ring-emerald-600/20 shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <Banknote className={`size-5 mb-1.5 ${type === 'FIXED_AMOUNT' ? 'text-emerald-600' : ''}`} />
                  <div className="font-bold text-xs text-foreground">Potongan Rp</div>
                </button>
              </div>
            </div>

            {/* Input Nilai Diskon Sesuai Jenis */}
            {type === 'BUY_X_GET_Y' && (
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl border bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Syarat Beli (X)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={buyQty}
                    onChange={(e) => setBuyQty(Number(e.target.value))}
                    className="h-10 text-xs sm:text-sm rounded-xl font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Jumlah Gratis (Y)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={getQty}
                    onChange={(e) => setGetQty(Number(e.target.value))}
                    className="h-10 text-xs sm:text-sm rounded-xl font-bold"
                    required
                  />
                </div>
              </div>
            )}

            {type === 'PERCENTAGE' && (
              <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-1">
                <Label className="text-xs font-semibold">Besar Diskon (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="h-10 text-xs sm:text-sm rounded-xl font-bold pr-9"
                    required
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                </div>
              </div>
            )}

            {type === 'FIXED_AMOUNT' && (
              <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-1">
                <Label className="text-xs font-semibold">Nominal Diskon (Rp)</Label>
                <Input
                  type="number"
                  min={100}
                  step={500}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="h-10 text-xs sm:text-sm rounded-xl font-bold"
                  required
                />
              </div>
            )}

            {/* Target / Ruang Lingkup Promo */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Target Promo
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScope('PRODUCT')
                    if (!targetId && products[0]) setTargetId(products[0].id)
                  }}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    scope === 'PRODUCT'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <UtensilsCrossed className="size-3.5" />
                  <span>Menu</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScope('CATEGORY')
                    if (categories[0]) setTargetId(categories[0].id)
                  }}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    scope === 'CATEGORY'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Folder className="size-3.5" />
                  <span>Kategori</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('CART_TOTAL')}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    scope === 'CART_TOTAL'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <ShoppingBag className="size-3.5" />
                  <span>Total Belanja</span>
                </button>
              </div>

              {scope === 'PRODUCT' && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <Label className="text-xs font-semibold">Pilih Menu Produk</Label>
                    {targetId && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        Terpilih:{' '}
                        <span className="font-bold text-foreground">
                          {products.find((p) => p.id === targetId)?.name ?? '-'}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Search box for products */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Cari menu berdasarkan nama..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-9.5 pl-8.5 pr-8 text-xs rounded-xl bg-background"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground grid place-items-center"
                        aria-label="Bersihkan pencarian"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Product Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1.5 rounded-2xl border bg-muted/15 scrollbar-thin">
                    {products
                      .filter((p) =>
                        p.name.toLowerCase().includes(productSearch.toLowerCase().trim())
                      )
                      .map((p) => {
                        const isSelected = targetId === p.id
                        const img = p.image_url ?? p.images?.[0]
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setTargetId(p.id)}
                            className={`relative flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10 ring-2 ring-primary/25 shadow-xs'
                                : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50'
                            }`}
                          >
                            <div className="relative size-11 rounded-lg overflow-hidden bg-muted/60 shrink-0 grid place-items-center border border-border/50">
                              {img ? (
                                <img src={img} alt={p.name} className="size-full object-cover" />
                              ) : (
                                <UtensilsCrossed className="size-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] font-extrabold text-primary">{rupiah(p.price)}</p>
                            </div>
                            {isSelected && (
                              <div className="size-4.5 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0 shadow-xs">
                                <Check className="size-2.5" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    {products.filter((p) =>
                      p.name.toLowerCase().includes(productSearch.toLowerCase().trim())
                    ).length === 0 && (
                      <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                        Tidak ada menu yang sesuai pencarian "{productSearch}".
                      </div>
                    )}
                  </div>
                </div>
              )}

              {scope === 'CATEGORY' && (
                <div className="space-y-1 pt-1 animate-in fade-in duration-150">
                  <Label className="text-xs font-semibold">Pilih Kategori Menu</Label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-ring focus:outline-none"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Syarat Minimal Belanja */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Minimal Belanja <span className="text-muted-foreground/80 font-normal">(opsional)</span>
              </Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={minSpend}
                onChange={(e) => setMinSpend(Number(e.target.value))}
                placeholder="0 = Tanpa minimal belanja"
                className="h-10 text-xs sm:text-sm rounded-xl font-medium"
              />
            </div>

            {/* Kode Promo (Opsional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Kode Promo Voucher <span className="text-muted-foreground/80 font-normal">(opsional)</span>
              </Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Contoh: DISKON10 (kosongkan jika otomatis)"
                maxLength={20}
                className="h-10 text-xs sm:text-sm rounded-xl font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                Jika diisi, pembeli harus memasukkan kode ini saat checkout.
              </p>
            </div>

            {/* Periode Kampanye */}
            <div className="space-y-2 p-3.5 rounded-2xl border bg-muted/20">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Periode Kampanye <span className="text-muted-foreground/80 font-normal">(opsional)</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">Mulai</span>
                  <Input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">Berakhir</span>
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Promo hanya berlaku di dalam rentang waktu kampanye ini.
              </p>
            </div>

            {/* Toggle Status Aktif */}
            <div className="flex items-center justify-between rounded-2xl border p-4 bg-muted/20">
              <div>
                <span className="block font-bold text-xs sm:text-sm text-foreground">Status Promo</span>
                <span className="text-xs text-muted-foreground">
                  {isActive ? 'Aktif di katalog' : 'Nonaktif'}
                </span>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </form>

          <DrawerFooter className="flex-row border-t px-5 py-3.5 gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDrawerOpen(false)}
              className="rounded-xl flex-1 h-11 font-semibold"
            >
              Batal
            </Button>
            <Button
              form="promo-form"
              disabled={busy}
              className="flex-1 h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/25 cursor-pointer"
            >
              {busy ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Buat Promo'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
