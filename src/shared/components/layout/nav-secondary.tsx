import { ExternalLink, ShieldCheck, Store } from 'lucide-react'
import type { ComponentProps } from 'react'
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@shared/components/ui/sidebar'

/** Tautan pendukung di dasar sidebar (pola NavSecondary dashboard-01). */
export function NavSecondary({ slug, ...props }: { slug?: string } & ComponentProps<typeof SidebarGroup>) {
  const items = [
    ...(slug ? [{ title: 'Halaman pelanggan', url: `/s/${slug}`, icon: Store }] : []),
    { title: 'Privasi & syarat', url: '/privasi', icon: ShieldCheck },
  ]
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton size="sm" tooltip={item.title} className="h-8" render={<a href={item.url} target="_blank" rel="noreferrer" />}>
                <item.icon />
                <span>{item.title}</span>
                <ExternalLink className="ml-auto size-3 opacity-50 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
