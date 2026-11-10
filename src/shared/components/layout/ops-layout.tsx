import { LayoutGrid, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { buttonVariants } from '@shared/components/ui/button'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
import { can } from '@shared/types/contracts'
import { WORK_NAV } from './nav'
import { AccountMenu, Clock, StatusBanners } from './parts'

/**
 * Mode kerja layar penuh untuk kasir & dapur: tanpa sidebar supaya seluruh layar tablet dipakai kerja.
 * Pindah Kasir ⇄ Dapur lewat dua tombol besar; owner/manager punya jalan pintas ke Back office.
 */
export function OpsLayout({ children }: { children: ReactNode }) {
  const staff = useStaff()
  const { config } = useStoreConfig(staff.storeId)
  const items = WORK_NAV.filter((i) => i.show(staff))

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-3 print:hidden md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden />
          </span>
          <span className="hidden max-w-48 truncate font-semibold sm:block">{staff.storeName}</span>
        </div>

        {items.length > 1 && (
          <nav aria-label="Ruang kerja" className="flex gap-1 rounded-full bg-muted p-1">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${isActive ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`
                }
              >
                <Icon className="size-4" /> {label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {can.manage(staff.role) && (
            <Link to="/admin" className={buttonVariants({ variant: 'outline', className: 'h-10' })}>
              <LayoutGrid /> <span className="hidden md:inline">Back office</span>
            </Link>
          )}
          <Clock />
          <AccountMenu staff={staff} />
        </div>
      </header>
      <StatusBanners staff={staff} config={config} />
      <main>{children}</main>
    </div>
  )
}
