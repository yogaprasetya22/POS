import { Store } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@shared/components/ui/sidebar'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
import { NavMain } from './nav-main'
import { NavSecondary } from './nav-secondary'
import { NavUser } from './nav-user'

/** Sidebar back office dengan susunan shadcn dashboard-01: brand, menu utama, tautan pendukung, akun. */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const staff = useStaff()
  const { config } = useStoreConfig(staff.storeId)
  return (
    <Sidebar collapsible="icon" className="print:hidden" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="data-[slot=sidebar-menu-button]:p-1.5!" render={<Link to="/admin" />}>
              <Store className="size-5!" />
              <span className="truncate text-base font-semibold">{staff.storeName ?? 'Platform'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="scrollbar-none">
        <NavMain staff={staff} />
        <NavSecondary slug={config?.slug} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser staff={staff} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
