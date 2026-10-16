import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Copy,
  ExternalLink,
  Layers,
  Plus,
  Receipt,
  ShoppingBag,
  Store as StoreIcon,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Switch } from '@shared/components/ui/switch'
import { supabase } from '@shared/lib/supabase'
import { rupiah, timeJakarta, todayJakarta } from '@shared/lib/utils'
import {
  OrderSchema,
  PAYMENT_LABEL,
  PaymentMethodSchema,
  type Category,
  type Order,
  type Product,
  type Store,
} from '@shared/types/contracts'

type Props = {
  products: Product[]
  categories: Category[]
  store: Store
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
  reload: () => void
  onNavigateTab: (tab: string) => void
  onOpenNewProduct: () => void
}

/**
 * Tab Ikhtisar (Dashboard Overview)
 * // ponytail: visualisasi sebaran pembayaran menggunakan bar persentase CSS murni,
 * tanpa library chart eksternal untuk menghemat bundle size dan menjaga latensi render mendekati 0ms.
 */
export function OverviewTab({
  products,
  store,
  run,
  onNavigateTab,
  onOpenNewProduct,
}: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [copied, setCopied] = useState(false)
  const today = todayJakarta()

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .eq('business_day', today)
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          const parsed = z.array(OrderSchema).safeParse(data)
          if (parsed.success) setOrders(parsed.data)
        }
      })
  }, [today])

  const totalRevenue = useMemo(() => orders.reduce((acc, o) => acc + o.total, 0), [orders])
  const totalOrders = orders.length
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  const soldOutProducts = useMemo(() => products.filter((p) => !p.is_available), [products])
  const activeProductsCount = products.length - soldOutProducts.length

  const storeUrl = `${window.location.origin}/s/${store.slug}`

  const copyUrl = async () => {
    await navigator.clipboard.writeText(storeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const paymentStats = useMemo(() => {
    return PaymentMethodSchema.options.map((m) => {
      const filtered = orders.filter((o) => o.payment_method === m)
      const count = filtered.length
      const amount = filtered.reduce((acc, o) => acc + o.total, 0)
      const percent = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0
      return { method: m, label: PAYMENT_LABEL[m], count, amount, percent }
    })
  }, [orders, totalRevenue])

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Quick Actions */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-primary/5 text-xs font-medium">
                <StoreIcon className="size-3" />
                {store.name}
              </Badge>
              <span className="text-xs text-muted-foreground">{formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Dashboard Operasional
            </h1>
            <p className="text-sm text-muted-foreground">
              Ringkasan performa penjualan dan inventaris toko Anda hari ini.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onOpenNewProduct} className="gap-2 shadow-sm shadow-primary/25">
              <Plus className="size-4" /> Tambah Menu
            </Button>
            <Button variant="outline" className="gap-2" nativeButton={false} render={<Link to="/cashier" />}>
              <ShoppingBag className="size-4" /> Kasir
            </Button>
            <Button variant="outline" className="gap-2" nativeButton={false} render={<Link to="/kitchen" />}>
              <ChefHat className="size-4" /> Dapur
            </Button>
            <Button variant="outline" onClick={copyUrl} className="gap-2">
              {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              {copied ? 'Tautan Tersalin' : 'Salin Tautan Toko'}
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Omzet */}
        <Card className="rounded-2xl border bg-card p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Penjualan Hari Ini
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="size-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black tracking-tight">{rupiah(totalRevenue)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Dari {totalOrders} pesanan terbayar
            </p>
          </div>
        </Card>

        {/* KPI 2: Transaksi */}
        <Card className="rounded-2xl border bg-card p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Transaksi
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
              <Receipt className="size-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black tracking-tight">{totalOrders} Pesanan</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pesanan selesai diproses hari ini
            </p>
          </div>
        </Card>

        {/* KPI 3: Nilai Rata-rata */}
        <Card className="rounded-2xl border bg-card p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rata-rata per Struk (AOV)
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Wallet className="size-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black tracking-tight">{rupiah(avgOrderValue)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Rerata nominal per pembeli
            </p>
          </div>
        </Card>

        {/* KPI 4: Status Menu */}
        <Card className="rounded-2xl border bg-card p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Katalog & Ketersediaan
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <UtensilsCrossed className="size-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black tracking-tight">{activeProductsCount} / {products.length} Menu</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {soldOutProducts.length > 0 ? (
                <span className="font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="size-3.5" />
                  <span>{soldOutProducts.length} menu habis</span>
                </span>
              ) : (
                <span className="font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" />
                  <span>Semua menu siap</span>
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Main Two-Column Analytics & Action Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Payments & Recent Orders (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Sebaran Pembayaran */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Metode Pembayaran</CardTitle>
                  <CardDescription className="text-xs">
                    Rincian transaksi berdasarkan metode bayar hari ini
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {totalRevenue > 0 ? rupiah(totalRevenue) : 'Rp0'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Visual Multi-Color Bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
                {paymentStats.map((item, idx) => {
                  if (item.percent === 0) return null
                  const colors = [
                    'bg-primary',
                    'bg-emerald-500',
                    'bg-amber-500',
                  ]
                  return (
                    <div
                      key={item.method}
                      style={{ width: `${item.percent}%` }}
                      className={`${colors[idx % colors.length]} transition-all`}
                      title={`${item.label}: ${item.percent}%`}
                    />
                  )
                })}
              </div>

              {/* Breakdown Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {paymentStats.map((p, idx) => {
                  const borderAccents = [
                    'border-l-primary',
                    'border-l-emerald-500',
                    'border-l-amber-500',
                  ]
                  return (
                    <div
                      key={p.method}
                      className={`rounded-xl border border-l-4 ${borderAccents[idx % borderAccents.length]} bg-muted/30 p-3`}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.label}</span>
                        <span className="font-medium text-foreground">{p.percent}%</span>
                      </div>
                      <div className="mt-1 text-sm font-bold">{rupiah(p.amount)}</div>
                      <div className="text-[11px] text-muted-foreground">{p.count} transaksi</div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Transaksi Terbaru Hari Ini */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Transaksi Terbaru</CardTitle>
                <CardDescription className="text-xs">
                  5 pesanan terakhir yang selesai dan terbayar hari ini
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('penjualan')}
                className="gap-1 text-xs text-primary"
              >
                Lihat Semua <ArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada transaksi terbayar pada hari ini.
                </div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {orders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-3 text-sm hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                          #{o.queue_code}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{o.customer_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.paid_at ? timeJakarta(o.paid_at) : '—'} · {o.order_type === 'DINE_IN' ? `Meja ${o.table_no ?? '-'}` : 'Bawa Pulang'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold">{rupiah(o.total)}</div>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                          {o.payment_method ? PAYMENT_LABEL[o.payment_method] : 'Belum bayar'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Inventory Stock Attention & Store Info (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Menu Habis / Perlu Perhatian */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-amber-500" />
                  Perhatian Stok & Ketersediaan
                </CardTitle>
                <CardDescription className="text-xs">
                  Menu yang saat ini ditandai habis atau tidak aktif
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('menu')}
                className="gap-1 text-xs text-primary"
              >
                Kelola <ArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {soldOutProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                    Semua Menu Tersedia
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tidak ada menu yang sedang dinonaktifkan atau berstatus habis.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                    {soldOutProducts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-accent">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="size-full object-cover grayscale" />
                            ) : (
                              <div className="grid size-full place-items-center text-xs font-bold text-muted-foreground">
                                {p.name[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{rupiah(p.price)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            aria-label={`Aktifkan ${p.name}`}
                            checked={p.is_available}
                            onCheckedChange={(on) =>
                              run(supabase.from('products').update({ is_available: on }).eq('id', p.id))
                            }
                          />
                          <span className="text-[11px] font-medium text-destructive">Habis</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Klik sakelar di atas untuk langsung mengaktifkan kembali menu saat stok tersedia.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Access Store Link & Catalog Info */}
          <Card className="rounded-2xl border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                Akses Katalog Pelanggan
              </CardTitle>
              <CardDescription className="text-xs">
                Tautan mandiri untuk pelanggan memesan melalui HP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-2 font-mono break-all border">
                <div className="text-muted-foreground font-sans text-[11px] font-semibold">Tautan Toko:</div>
                <div className="text-foreground">{storeUrl}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyUrl} className="flex-1 gap-1.5 text-xs">
                  {copied ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copied ? 'Tersalin' : 'Salin Tautan'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  nativeButton={false}
                  render={<a href={storeUrl} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-3.5" /> Buka
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onNavigateTab('toko')} className="text-xs">
                  Pengaturan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
