import { ChevronLeft, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
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
  const { pathname } = useLocation()
  const items = MAIN_NAV.filter((i) => i.show(staff))
  const hasNav = items.length > 1
  const here = findNav(pathname)
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
                <Icon className="size-7" aria-hidden />
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
      </div>
    </div>
  )
}
