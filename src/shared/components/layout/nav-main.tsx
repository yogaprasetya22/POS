import { ChefHat, ShoppingBag } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router'
import { buttonVariants } from '@shared/components/ui/button'
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@shared/components/ui/sidebar'
import type { Staff } from '@shared/lib/auth'
import { ADMIN_NAV, WORK_NAV } from './nav'

/** Aksi utama di puncak sidebar (pola "Quick Create" dashboard-01): masuk ke ruang kerja kasir; tombol ikon untuk dapur. */
function QuickAction({ staff }: { staff: Staff }) {
  const [primary, secondary] = WORK_NAV.filter((i) => i.show(staff))
  if (!primary) return null
  const Icon = primary.icon
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip={`Buka ${primary.label}`}
              className="h-9 min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              render={<Link to={primary.to} />}
            >
              <Icon />
              <span>Buka {primary.label}</span>
            </SidebarMenuButton>
            {secondary && (
              <Link
                to={secondary.to}
                aria-label={`Buka ${secondary.label}`}
                title={`Buka ${secondary.label}`}
                className={buttonVariants({ variant: 'outline', size: 'icon', className: 'size-9 shrink-0 group-data-[collapsible=icon]:hidden' })}
              >
                {secondary.to === '/kitchen' ? <ChefHat /> : <ShoppingBag />}
              </Link>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** Menu back office, dikelompokkan menurut tugas. Baris setinggi 36px (standar shadcn), bukan 52px. */
export function NavMain({ staff }: { staff: Staff }) {
  const { pathname } = useLocation()
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.show(staff)) })).filter((g) => g.items.length > 0)
  return (
    <>
      <QuickAction staff={staff} />
      {groups.map((g) => (
        <SidebarGroup key={g.label} className="py-1">
          <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    tooltip={label}
                    className="h-9"
                    isActive={end ? pathname === to : pathname === to || pathname.startsWith(to + '/')}
                    render={<NavLink to={to} end={end} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
