import type { CSSProperties, ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@shared/components/ui/sidebar'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
import { AppSidebar } from './app-sidebar'
import { SiteHeader } from './site-header'
import { StatusBanners } from './parts'

/** Layout back office & super admin, mengikuti shadcn dashboard-01 (sidebar `inset` + SiteHeader). */
export function AdminLayout({ children }: { children: ReactNode }) {
  const staff = useStaff()
  const { config } = useStoreConfig(staff.storeId)
  return (
    <SidebarProvider
      defaultOpen={window.innerWidth >= 1280}
      style={{ '--sidebar-width': 'calc(var(--spacing) * 64)', '--header-height': 'calc(var(--spacing) * 12)' } as CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <StatusBanners staff={staff} config={config} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
