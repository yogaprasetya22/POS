import { liquid } from '@shared/lib/motion'
import { GRID, applyBuyerLook, asTemplate } from '@shared/lib/buyer-look'
import { rememberMenu } from '@shared/lib/last-menu'
import { Progressive } from '@shared/components/progressive'
import { LiquidPill } from '@shared/components/liquid-pill'
import { AnimatedRupiah } from '@shared/components/animated-rupiah'
import { ArrowRight, Search, X } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { CheckoutPanel, MyOrders, cartTotal, itemKey, unitPrice, useCartStore } from '@features/cart-checkout'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { MenuSkeleton } from '@shared/components/page-skeleton'
import { rupiah } from '@shared/lib/utils'
import { calculatePromo } from '@shared/lib/promo'
import type { Product } from '@shared/types/contracts'
import { MenuCard } from './components/menu-card'
import { ProductPicker } from './components/product-picker'
import { toast } from 'sonner'
import { Toaster } from '@shared/components/ui/sonner'
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

  // Ingat menu + meja ini supaya tombol "kembali" di halaman lain mengarah ke sini, bukan ke landing page
  const query = params.toString()
  useEffect(() => {
    if (data) rememberMenu(`/s/${slug}${query ? `?${query}` : ''}`, new URLSearchParams(query).get('meja'))
  }, [data, slug, query])

  // Warna toko + template pilihan pemilik; ?template=... untuk pratinjau dari Pengaturan toko
  const template = asTemplate(params.get('template') ?? data?.store.buyer_template)
  const storeTheme = data?.store.theme
  useEffect(() => {
    if (storeTheme) return applyBuyerLook(storeTheme, template)
  }, [storeTheme, template])

  if (error)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
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
          <h1 className="mt-4 text-xl font-bold">{data.store.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toko sedang tutup. Silakan coba lagi nanti.
          </p>
        </div>
      </div>
    )

  const q = search?.trim().toLowerCase() ?? ''
  const shown = data.products
    .filter((p) => (!category || p.category_id === category) && (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)))
    // menu andalan di atas; urutan lain tetap seperti yang diatur pemilik
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
  const count = items.reduce((n, i) => n + i.qty, 0)
  const totalPrice = cartTotal(items)
  const promo = calculatePromo(items, data.promotions, data.products)
  const discountedTotal = Math.max(0, totalPrice - promo.discount)
  const qtyOf = (productId: string) =>
    items.filter((i) => i.product_id === productId).reduce((n, i) => n + i.qty, 0)
  const table = params.get('tipe') === 'bungkus' ? null : params.get('meja')
  // tombol +: menu tanpa varian langsung masuk pesanan; menu dengan varian membuka pilihan dulu
  const quickAdd = (p: Product) => {
    if (p.modifiers.length > 0) return setPicking(p)
    add({ key: itemKey(p.id, [], ''), product_id: p.id, qty: 1, choices: [], note: '', name: p.name, unit_price: unitPrice(p, []), image: p.image_url })
    navigator.vibrate?.(30)
    toast.success(`${p.name} ditambahkan`, { duration: 1500 })
  }
  return (
    <div className="min-h-dvh w-full bg-background pb-28">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="flex items-center gap-3">
            {data.store.logo_url && <img src={data.store.logo_url} alt="" className="size-12 shrink-0 rounded-2xl border bg-white object-cover" />}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold leading-tight">{data.store.name}</h1>
              {data.store.tagline && <p className="line-clamp-2 text-base leading-5 text-muted-foreground">{data.store.tagline}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-base font-bold text-primary-foreground">{table ? `Meja ${table}` : 'Bawa pulang'}</span>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu"
              aria-label="Cari menu"
              className="h-11 pl-9 pr-10"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian" className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-muted-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="-mx-4 mt-2 overflow-x-auto px-4 pb-3 scrollbar-none">
            <ToggleGroup
              aria-label="Kategori"
              className="w-max gap-2"
              value={[category ?? 'all']}
              onValueChange={(v) => v[0] !== undefined && setCategory(v[0] === 'all' ? null : v[0])}
            >
              {[{ id: null, name: 'Semua' }, ...data.categories].map((c) => (
                <ToggleGroupItem
                  key={c.id ?? 'all'}
                  value={c.id ?? 'all'}
                  className="relative h-10 rounded-full border bg-card px-4 aria-pressed:border-foreground aria-pressed:bg-transparent aria-pressed:text-background"
                >
                  {category === c.id && <LiquidPill id="menu-cat" />}
                  <span className="relative">{c.name}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4">
        <MyOrders storeId={data.store.id} />
        {shown.length === 0 ? (
          <p className="rounded-lg border border-dashed py-14 text-center text-muted-foreground">Menu tidak ditemukan.</p>
        ) : (
          <div className={GRID[template]}>
            <Progressive items={shown} resetKey={`${category}|${q}`}>
            {(rows) => (
            <AnimatePresence mode="popLayout" initial={false}>
            {rows.map((p, idx) => {
              const pr = data.promotions.find(
                (x) => (x.scope === 'PRODUCT' && x.target_id === p.id) || (x.scope === 'CATEGORY' && x.target_id === p.category_id),
              )
              const promoLabel = !pr
                ? ''
                : pr.type === 'BUY_X_GET_Y'
                  ? `Beli ${pr.buy_qty} gratis ${pr.get_qty}`
                  : pr.type === 'PERCENTAGE'
                    ? `Diskon ${pr.discount_percent}%`
                    : `Hemat ${rupiah(pr.discount_amount)}`
              const hero = template === 'majalah' && idx === 0 && !category && !q
              return (
                <m.div
                  key={p.id}
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ ...liquid, delay: Math.min(idx, 12) * 0.025 }}
                  className={hero ? 'col-span-full' : ''}
                >
                  <MenuCard
                    p={p}
                    t={template}
                    qty={qtyOf(p.id)}
                    promo={promoLabel}
                    hero={hero}
                    priority={idx < 4}
                    onOpen={() => setPicking(p)}
                    onAdd={() => quickAdd(p)}
                  />
                </m.div>
              )
            })}
            </AnimatePresence>
            )}
            </Progressive>
          </div>
        )}
      </main>

      <AnimatePresence>
      {count > 0 && !checkout && (
        <m.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                {count} item{promo.bonusItem ? ` + ${promo.bonusItem.qty} gratis` : ''}
              </p>
              <p className="text-lg font-bold tabular-nums">
                <AnimatedRupiah value={discountedTotal} />
                {promo.discount > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{rupiah(totalPrice)}</span>}
              </p>
            </div>
            <Button size="lg" onClick={() => setCheckout(true)} className="h-12 px-6 text-base">
              Lihat pesanan <ArrowRight />
            </Button>
          </div>
        </m.div>
      )}
      </AnimatePresence>

      {/* notifikasi "ditambahkan" dari tombol + */}
      <Toaster position="top-center" />

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
          defaultTable={table ?? ''}
          promotions={data.promotions}
          products={data.products}
          onClose={() => setCheckout(false)}
        />
      )}
    </div>
  )
}
