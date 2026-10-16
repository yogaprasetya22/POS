import {
  Edit2,
  Percent,
  Plus,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ConfirmButton } from '@shared/components/confirm-button'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog'
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

export function PromoTab({ storeId, products, categories, reloadCatalog, run }: Props) {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [type, setType] = useState<PromotionType>('BUY_X_GET_Y')
  const [scope, setScope] = useState<PromotionScope>('PRODUCT')
  const [targetId, setTargetId] = useState<string>('')
  const [buyQty, setBuyQty] = useState(2)
  const [getQty, setGetQty] = useState(1)
  const [discountPercent, setDiscountPercent] = useState(10)
  const [discountAmount, setDiscountAmount] = useState(5000)
  const [minSpend, setMinSpend] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const fetchPromos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (!error && data) {
      setPromos(data as Promotion[])
    }
  }, [storeId])

  useEffect(() => {
    fetchPromos()
  }, [fetchPromos])

  const openCreateModal = () => {
    setEditing(null)
    setName('')
    setType('BUY_X_GET_Y')
    setScope('PRODUCT')
    setTargetId(products[0]?.id ?? '')
    setBuyQty(2)
    setGetQty(1)
    setDiscountPercent(10)
    setDiscountAmount(5000)
    setMinSpend(0)
    setIsActive(true)
    setError('')
    setIsCreating(true)
  }

  const openEditModal = (p: Promotion) => {
    setEditing(p)
    setName(p.name)
    setType(p.type)
    setScope(p.scope)
    setTargetId(p.target_id ?? '')
    setBuyQty(p.buy_qty)
    setGetQty(p.get_qty)
    setDiscountPercent(p.discount_percent)
    setDiscountAmount(p.discount_amount)
    setMinSpend(p.min_spend)
    setIsActive(p.is_active)
    setError('')
    setIsCreating(true)
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
      name,
      type,
      scope,
      target_id: scope === 'CART_TOTAL' ? null : targetId || null,
      buy_qty: type === 'BUY_X_GET_Y' ? buyQty : 1,
      get_qty: type === 'BUY_X_GET_Y' ? getQty : 1,
      discount_percent: type === 'PERCENTAGE' ? discountPercent : 0,
      discount_amount: type === 'FIXED_AMOUNT' ? discountAmount : 0,
      min_spend: minSpend,
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

    setIsCreating(false)
    fetchPromos()
    reloadCatalog()
  }

  const targetName = (p: Promotion) => {
    if (p.scope === 'CART_TOTAL') return 'Seluruh Pesanan'
    if (p.scope === 'CATEGORY') {
      const cat = categories.find((c) => c.id === p.target_id)
      return `Kategori: ${cat?.name ?? 'Kategori Dihapus'}`
    }
    const prod = products.find((pr) => pr.id === p.target_id)
    return `Menu: ${prod?.name ?? 'Menu Dihapus'}`
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-6 text-rose-500" />
            <span>Promo & Diskon</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Tingkatkan omzet dengan promo otomatis (Beli 2 Gratis 1, diskon persen, atau potongan nominal).
          </p>
        </div>

        <Button onClick={openCreateModal} className="gap-2 rounded-xl font-bold self-start sm:self-auto">
          <Plus className="size-4" />
          <span>Buat Promo Baru</span>
        </Button>
      </div>

      {/* Promo List Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-10 text-center">
          <Tag className="mx-auto size-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-bold text-base text-foreground">Belum ada promo aktif</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Buat promo menarik seperti Beli 2 Gratis 1 untuk memikat pelanggan memesan lebih banyak menu.
          </p>
          <Button onClick={openCreateModal} variant="outline" className="rounded-xl gap-2 font-semibold">
            <Plus className="size-4" />
            <span>Mulai Buat Promo</span>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((p) => (
            <Card
              key={p.id}
              className={`rounded-2xl border transition-all ${
                p.is_active ? 'bg-card shadow-xs hover:border-primary/40' : 'bg-muted/40 opacity-70'
              }`}
            >
              <CardHeader className="pb-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-base font-bold truncate">{p.name}</CardTitle>
                    <CardDescription className="text-xs truncate">{targetName(p)}</CardDescription>
                  </div>
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={() => handleToggle(p.id, p.is_active)}
                    aria-label="Status Promo"
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {/* Promo Spec Badges */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {p.type === 'BUY_X_GET_Y' && (
                    <Badge variant="default" className="bg-rose-500 font-bold">
                      Beli {p.buy_qty} Gratis {p.get_qty}
                    </Badge>
                  )}
                  {p.type === 'PERCENTAGE' && (
                    <Badge variant="default" className="bg-amber-500 font-bold">
                      Diskon {p.discount_percent}%
                    </Badge>
                  )}
                  {p.type === 'FIXED_AMOUNT' && (
                    <Badge variant="default" className="bg-emerald-600 font-bold">
                      Potongan {rupiah(p.discount_amount)}
                    </Badge>
                  )}

                  {p.min_spend > 0 && (
                    <Badge variant="secondary" className="text-[11px]">
                      Min. {rupiah(p.min_spend)}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 border-t pt-2.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => openEditModal(p)}
                    className="size-8 rounded-lg"
                    aria-label="Ubah promo"
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Buat / Edit Promo */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-md p-5 rounded-3xl gap-4">
          <DialogTitle className="text-base sm:text-lg font-bold">
            {editing ? 'Ubah Promo' : 'Buat Promo Baru'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground -mt-2">
            Atur aturan promo otomatis untuk toko Anda.
          </DialogDescription>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
                {error}
              </div>
            )}

            {/* Nama Promo */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Promo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Beli 2 Gratis 1 Kopi Susu"
                className="h-9 text-xs sm:text-sm rounded-xl"
                required
              />
            </div>

            {/* Tipe Promo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Jenis Promo</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType('BUY_X_GET_Y')}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer ${
                    type === 'BUY_X_GET_Y'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Beli X Gratis Y
                </button>
                <button
                  type="button"
                  onClick={() => setType('PERCENTAGE')}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer ${
                    type === 'PERCENTAGE'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Diskon %
                </button>
                <button
                  type="button"
                  onClick={() => setType('FIXED_AMOUNT')}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer ${
                    type === 'FIXED_AMOUNT'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Potongan Rp
                </button>
              </div>
            </div>

            {/* Parameter Nilai Diskon Berdasarkan Tipe */}
            {type === 'BUY_X_GET_Y' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Jumlah Beli (X)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={buyQty}
                    onChange={(e) => setBuyQty(Number(e.target.value))}
                    className="h-9 text-xs sm:text-sm rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Jumlah Gratis (Y)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={getQty}
                    onChange={(e) => setGetQty(Number(e.target.value))}
                    className="h-9 text-xs sm:text-sm rounded-xl"
                    required
                  />
                </div>
              </div>
            )}

            {type === 'PERCENTAGE' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Besar Diskon (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="h-9 text-xs sm:text-sm rounded-xl pr-8"
                    required
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                </div>
              </div>
            )}

            {type === 'FIXED_AMOUNT' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Potongan Nominal (Rp)</Label>
                <Input
                  type="number"
                  min={100}
                  step={500}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="h-9 text-xs sm:text-sm rounded-xl"
                  required
                />
              </div>
            )}

            {/* Target / Scope */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Berlaku Untuk</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScope('PRODUCT')
                    if (!targetId && products[0]) setTargetId(products[0].id)
                  }}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer ${
                    scope === 'PRODUCT'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Menu Spesifik
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScope('CATEGORY')
                    if (categories[0]) setTargetId(categories[0].id)
                  }}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer ${
                    scope === 'CATEGORY'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Kategori
                </button>
                <button
                  type="button"
                  onClick={() => setScope('CART_TOTAL')}
                  className={`rounded-xl border p-2 text-center text-xs font-bold transition-all cursor-pointer ${
                    scope === 'CART_TOTAL'
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Total Belanja
                </button>
              </div>
            </div>

            {/* Dropdown pemilih Target */}
            {scope === 'PRODUCT' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Pilih Menu</Label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-ring focus:outline-none"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({rupiah(p.price)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'CATEGORY' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Pilih Kategori</Label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-ring focus:outline-none"
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

            {/* Minimal Belanja */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Syarat Minimal Belanja <span className="text-muted-foreground font-normal">(opsional)</span>
              </Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={minSpend}
                onChange={(e) => setMinSpend(Number(e.target.value))}
                placeholder="0 = Tanpa minimal belanja"
                className="h-9 text-xs sm:text-sm rounded-xl"
              />
            </div>

            {/* Toggle Aktif */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold">Langsung Aktifkan Promo</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} className="rounded-xl">
                Batal
              </Button>
              <Button type="submit" disabled={busy} className="rounded-xl font-bold">
                {busy ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Buat Promo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
