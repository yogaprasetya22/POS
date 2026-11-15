import { ChevronLeft, Store } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Toaster } from '@shared/components/ui/sonner'
import { useStaff } from '@shared/lib/auth'
import { useKitchenAlerts } from '@shared/lib/kitchen-alerts'
import { useLowStockAlerts, useLowStockCount } from '@shared/lib/low-stock-alerts'
import { useNewOrderToast } from '@shared/lib/new-order-toast'
import { can } from '@shared/types/contracts'
import { loadLogo } from '@shared/lib/receipt-logo'
import { useStoreConfig } from '@shared/lib/store-config'
import { applyTheme } from '@shared/lib/theme'
import { MAIN_NAV, findNav, isActive } from './nav'
import { AccountMenu, Clock, StatusBanners } from './parts'

/**
 * Satu layout untuk semua layar staf, dibuat untuk pengguna awam:
 * maksimal 4 tombol navigasi, selalu ada ikon + tulisan, tombol minimal 64px.
 * HP: bilah bawah tetap. Tablet/desktop: kolom kiri. `--bottom-nav` dipakai halaman yang punya bilah bawah sendiri.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const staff = useStaff()
  const { config } = useStoreConfig(staff.storeId)
  // warna toko & logo struk (piksel dimuat lebih awal supaya cetak struk langsung berlogo)
  useEffect(() => {
    if (!config) return
    applyTheme(config.theme)
    void loadLogo(config.logo)
  }, [config])
  const { pathname } = useLocation()
  // Layar dapur dimatikan pemilik: menu Dapur disembunyikan (kecuali untuk staf dapur, satu-satunya layarnya)
  const kitchenOff = config?.use_kitchen_screen === false
  const items = MAIN_NAV.filter((i) => i.show(staff) && !(kitchenOff && i.to === '/kitchen' && staff.role !== 'kitchen'))
  const hasNav = items.length > 1
  const here = findNav(pathname)
  useNewOrderToast(can.floor(staff.role), staff.userId)
  const overdue = useKitchenAlerts(can.floor(staff.role), config)
  // Peringatan stok minimum untuk pemilik, manager, dan kasir (keputusan rancangan inventory)
  useLowStockAlerts(can.pay(staff.role), can.manage(staff.role))
  const lowStock = useLowStockCount()
  // Owner/manager membuka Dapur dari Lainnya (tidak ada tombol Dapur di navigasinya): anggap bagian dari Lainnya.
  const inMore = !!here?.inMore || (pathname.startsWith('/kitchen') && !items.some((i) => i.to === '/kitchen') && items.some((i) => i.to === '/admin/lainnya'))

  return (
    <div className={`min-h-dvh bg-background md:flex ${hasNav ? '[--bottom-nav:4.75rem] md:[--bottom-nav:0px]' : '[--bottom-nav:0px]'}`}>
      {hasNav && (
        <nav
          aria-label="Menu utama"
          className="fixed inset-x-0 bottom-0 z-40 flex h-(--bottom-nav) border-t-2 bg-background print:hidden md:sticky md:top-0 md:h-dvh md:w-28 md:shrink-0 md:flex-col md:gap-2 md:border-t-0 md:border-r-2 md:p-2"
        >
          {items.map((item) => {
            const active = isActive(item, pathname, inMore)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-base transition-colors md:flex-none md:py-3 ${
                  active ? 'font-extrabold text-primary md:bg-primary/10' : 'font-semibold text-foreground/75 hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="relative">
                  <Icon className="size-7" aria-hidden />
                  {(() => {
                    // tanda angka: pesanan lewat waktu di Antrean, bahan hampir habis di Lainnya (tempat Inventory Stock)
                    const n = item.to === '/antrean' ? overdue : item.to === '/admin/lainnya' && can.manage(staff.role) ? lowStock : 0
                    if (n <= 0) return null
                    return (
                      <span className="absolute -right-3.5 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1.5 text-sm font-extrabold text-white tabular-nums">
                        {n}
                        <span className="sr-only">{item.to === '/antrean' ? ' pesanan belum diantar, lewat waktu' : ' bahan hampir habis'}</span>
                      </span>
                    )
                  })()}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      <div className="min-w-0 flex-1 pb-(--bottom-nav)">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background px-3 print:hidden md:px-5">
          {inMore ? (
            <Link to="/admin/lainnya" className="-ml-1 inline-flex min-h-12 items-center gap-1 rounded-lg px-2 text-base font-bold hover:bg-muted">
              <ChevronLeft className="size-6" aria-hidden /> Kembali ke Lainnya
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-5" aria-hidden />
              </span>
              <span className="truncate text-base font-bold">{staff.storeName ?? 'Kelola toko'}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Clock />
            <AccountMenu staff={staff} />
          </div>
        </header>
        <StatusBanners staff={staff} config={config} />
        <main>{children}</main>
        <Toaster position="top-right" />
      </div>
    </div>
  )
}
