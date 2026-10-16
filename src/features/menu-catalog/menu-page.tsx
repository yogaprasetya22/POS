import {
  ArrowRight,
  Check,
  Plus,
  Search,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Sparkles,
  Images,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { CheckoutPanel, cartTotal, useCartStore } from '@features/cart-checkout'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { MenuSkeleton } from '@shared/components/page-skeleton'
import { MenuImage } from '@shared/components/menu-image'
import { rupiah } from '@shared/lib/utils'
import { calculatePromo } from '@shared/lib/promo'
import type { Product } from '@shared/types/contracts'
import { categoryIcon } from './category-icon'
import { ProductPicker } from './components/product-picker'
import { useCatalog } from './use-catalog'

/**
 * Halaman Katalog Pelanggan (/s/:slug)
 * // ponytail: responsivitas mobile & desktop ditangani 100% via Tailwind utility breakpoint (sm/md/lg/xl),
 * tanpa perlu routing ganda atau hook window listener yang membebani rendering.
 */
export function MenuPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const { data, error } = useCatalog('slug', slug)
  const { items, add, bind } = useCartStore()
  const [picking, setPicking] = useState<Product | null>(null)
  const [checkout, setCheckout] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState<string | null>(null)

  useEffect(() => {
    if (data) bind(data.store.id)
  }, [data, bind])

  if (error)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <Store className="mx-auto size-12 text-muted-foreground/40" aria-hidden />
          <h1 className="mt-4 text-xl font-bold">
            {error === 'Toko tidak ditemukan' ? 'Toko tidak ditemukan' : 'Gagal memuat menu'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error === 'Toko tidak ditemukan'
              ? 'Periksa kembali link atau QR yang Anda scan.'
              : error}
          </p>
        </div>
      </div>
    )

  if (!data) return <MenuSkeleton />

  if (!data.store.is_active)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <Store className="mx-auto size-12 text-muted-foreground/40" aria-hidden />
          <h1 className="mt-4 text-xl font-bold">{data.store.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toko sedang tutup. Silakan coba lagi nanti.
          </p>
        </div>
      </div>
    )

  const q = search?.trim().toLowerCase() ?? ''
  const shown = data.products.filter(
    (p) => (!category || p.category_id === category) && p.name.toLowerCase().includes(q)
  )
  const count = items.reduce((n, i) => n + i.qty, 0)
  const totalPrice = cartTotal(items)
  const promo = calculatePromo(items, data.promotions, data.products)
  const discountedTotal = Math.max(0, totalPrice - promo.discount)
  const qtyOf = (productId: string) =>
    items.filter((i) => i.product_id === productId).reduce((n, i) => n + i.qty, 0)
  const table = params.get('tipe') === 'bungkus' ? null : params.get('meja')
  const banner = data.products.find((p) => p.image_url && p.is_available)

  return (
    <div className="min-h-dvh w-full bg-background pb-36">
      {/* Top Navbar / Header (Responsive Mobile & Desktop) */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-xs shadow-primary/20">
              <Store className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base truncate text-foreground">
                  {data.store.name}
                </span>
                <Badge
                  variant="secondary"
                  className="font-medium text-xs rounded-full shrink-0"
                >
                  {table ? `Meja ${table}` : 'Bawa Pulang'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate hidden sm:block">
                Pesan mandiri & bayar cepat di kasir
              </p>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search ?? ''}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari makanan atau minuman..."
                className="pl-10 h-10 rounded-full bg-muted/40 border-border focus-visible:bg-background"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Action buttons (Cart & Mobile Search Toggle) */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full md:hidden"
              aria-label="Cari menu"
              onClick={() => setSearch(search === null ? '' : null)}
            >
              <Search className="size-4" />
            </Button>

            {count > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setCheckout(true)}
                className="rounded-full gap-2 px-3.5 h-10 shadow-xs shadow-primary/20"
              >
                <ShoppingBag className="size-4" />
                <span className="font-bold">{count}</span>
                <span className="hidden sm:inline border-l border-primary-foreground/30 pl-2">
                  {rupiah(totalPrice)}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Search Input Drawer (Visible when search is opened on mobile) */}
        {search !== null && (
          <div className="border-t px-4 py-2.5 md:hidden bg-muted/20">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama menu..."
                aria-label="Cari menu"
                className="pl-9 pr-8 h-9 rounded-full bg-background"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 space-y-6">
        {/* Hero Promo Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-primary to-primary/90 text-primary-foreground p-5 sm:p-8 shadow-sm">
          <div className="max-w-md space-y-1.5 z-10 relative">
            <Badge variant="outline" className="text-primary-foreground border-white/30 bg-white/10 text-xs">
              Self-Order POS
            </Badge>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Pesan Menu Favorit Tanpa Antre
            </h2>
            <p className="text-xs sm:text-sm text-primary-foreground/80 leading-relaxed">
              Pilih hidangan langsung dari meja Anda, pesanan dikirim otomatis ke kasir dan dapur.
            </p>
          </div>

          {banner?.image_url && (
            <div className="absolute -right-4 -bottom-4 sm:right-6 sm:top-1/2 sm:-translate-y-1/2">
              <img
                src={banner.image_url.replace('w=600', 'w=300')}
                alt=""
                className="size-32 sm:size-44 rounded-full border-4 border-white/20 object-cover shadow-2xl opacity-90 sm:opacity-100"
              />
            </div>
          )}
        </div>

        {/* Category Filter Pills (Responsive Horizontal Scroll / Flex) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Kategori Pilihan
            </h3>
            <span className="text-xs text-muted-foreground">
              {shown.length} menu tersedia
            </span>
          </div>

          <div className="overflow-x-auto pb-2 scrollbar-none flex items-center gap-2">
            {[{ id: null, name: 'Semua Menu' }, ...data.categories].map((c) => {
              const Icon = categoryIcon(c.id === null ? null : c.name)
              const isSelected = (category === null && c.id === null) || category === c.id
              return (
                <button
                  key={c.id ?? 'all'}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`h-9 inline-flex items-center gap-2 rounded-full px-4 text-xs font-bold transition-all border shrink-0 cursor-pointer select-none ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30 ring-2 ring-primary/20 scale-[1.02]'
                      : 'bg-card text-foreground/80 hover:bg-muted border-border hover:text-foreground shadow-2xs'
                  }`}
                >
                  <Icon className={`size-3.5 shrink-0 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`} />
                  <span>{c.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Product Grid (Mobile 2-cols -> Tablet 3-cols -> Desktop 4/5-cols) */}
        <div>
          {shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground">
              <UtensilsCrossed className="mx-auto size-10 text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-foreground">Menu tidak ditemukan</p>
              <p className="text-xs text-muted-foreground mt-1">
                Coba cari dengan kata kunci lain atau pilih kategori berbeda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-5">
              {shown.map((p) => {
                const qty = qtyOf(p.id)
                const productPromo = data.promotions.find(
                  (pr) =>
                    (pr.scope === 'PRODUCT' && pr.target_id === p.id) ||
                    (pr.scope === 'CATEGORY' && pr.target_id === p.category_id)
                )
                return (
                  <Card
                    key={p.id}
                    onClick={() => p.is_available && setPicking(p)}
                    className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl border bg-card transition-all cursor-pointer p-0 ${
                      p.is_available
                        ? 'hover:border-primary/50 hover:shadow-md'
                        : 'opacity-60 cursor-not-allowed grayscale'
                    } ${qty > 0 ? 'ring-2 ring-primary border-primary' : ''}`}
                  >
                    {/* Food Photo Container with Image Skeleton */}
                    <div className="relative aspect-4/3 w-full overflow-hidden bg-accent">
                      <MenuImage
                        src={p.image_url ? p.image_url.replace('w=600', 'w=360') : null}
                        alt={p.name}
                        className="transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Promo Badge on Food Photo */}
                      {productPromo && p.is_available && (
                        <div className="absolute top-2 left-2 z-10 max-w-[70%]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/95 text-white font-black text-[9px] sm:text-[10px] px-2 py-0.5 shadow-md shadow-rose-600/25 truncate backdrop-blur-xs">
                            <Sparkles className="size-2.5 shrink-0" />
                            <span className="truncate">{productPromo.name}</span>
                          </span>
                        </div>
                      )}

                      {/* Floating In-Cart Badge / Quick Plus Button */}
                      {p.is_available ? (
                        <div className="absolute top-2.5 right-2.5">
                          {qty > 0 ? (
                            <Badge className="size-8 rounded-full bg-primary font-bold text-primary-foreground shadow-md flex items-center justify-center p-0 text-xs">
                              {qty}
                            </Badge>
                          ) : (
                            <div className="grid size-8 place-items-center rounded-full bg-background/90 text-foreground backdrop-blur-md shadow-md transition-transform group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                              <Plus className="size-4" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white font-bold text-xs uppercase tracking-wider backdrop-blur-xs">
                          Habis
                        </div>
                      )}

                      {/* Modifier Tag */}
                      {p.modifiers.length > 0 && (
                        <div className="absolute bottom-2 left-2">
                          <Badge
                            variant="secondary"
                            className="bg-background/85 backdrop-blur-md text-[10px] px-1.5 py-0 font-medium"
                          >
                            Bisa Kustom
                          </Badge>
                        </div>
                      )}

                      {/* Multi-image / Video Indicator Badge */}
                      {(Boolean(p.video_url) || (p.images && p.images.length > 1)) && (
                        <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs shadow-xs">
                            {p.video_url ? (
                              <>
                                <Video className="size-2.5 text-rose-400" />
                                <span>Video</span>
                              </>
                            ) : (
                              <>
                                <Images className="size-2.5 text-amber-300" />
                                <span>{p.images.length} Foto</span>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Food Description */}
                    <div className="p-3 sm:p-4 space-y-1.5">
                      <h4 className="font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {p.name}
                      </h4>
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="font-black text-sm sm:text-base text-foreground tabular-nums">
                          {rupiah(p.price)}
                        </span>
                        {qty > 0 && (
                          <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
                            <Check className="size-3" /> Dipilih
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar (Hidden when checkout modal is active) */}
      {count > 0 && !checkout && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 pointer-events-none">
          <div className="mx-auto w-full max-w-md pointer-events-auto">
            <div className="flex items-center justify-between gap-3 rounded-2xl sm:rounded-full border border-border/80 bg-slate-950/95 dark:bg-card/95 text-white dark:text-foreground p-3 sm:px-5 backdrop-blur-xl shadow-2xl shadow-black/40 transition-all animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-md shadow-primary/30 shrink-0">
                  <ShoppingBag className="size-4.5" />
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-slate-950 ring-2 ring-slate-950">
                    {count}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-muted-foreground uppercase tracking-wider">
                      {count} Menu Dipilih
                    </span>
                    <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-base sm:text-lg font-black tracking-tight text-white dark:text-foreground">
                      {rupiah(discountedTotal)}
                    </div>
                    {promo.discount > 0 && (
                      <span className="text-xs text-slate-400 line-through">
                        {rupiah(totalPrice)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                size="default"
                onClick={() => setCheckout(true)}
                className="rounded-xl sm:rounded-full px-5 h-10 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/30 shrink-0 text-xs sm:text-sm active:scale-95 transition-transform"
              >
                <span>Checkout</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      {picking && (
        <ProductPicker
          product={picking}
          onAdd={add}
          onClose={() => setPicking(null)}
        />
      )}

      {checkout && (
        <CheckoutPanel
          storeId={data.store.id}
          waNumber={data.store.wa_number}
          defaultTable={table ?? ''}
          promotions={data.promotions}
          products={data.products}
          onClose={() => setCheckout(false)}
        />
      )}
    </div>
  )
}
