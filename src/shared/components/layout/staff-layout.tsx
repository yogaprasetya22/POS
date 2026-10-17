import { Building2, ChefHat, LayoutGrid, LogOut, ShoppingBag, Store } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Avatar, AvatarFallback } from '@shared/components/ui/avatar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@shared/components/ui/breadcrumb'
import { Button } from '@shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu'
import { Separator } from '@shared/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@shared/components/ui/sidebar'
import { useStaff, type Staff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'

const NAV = [
  { to: '/cashier', label: 'Kasir', icon: ShoppingBag, show: (s: Staff) => !!s.role },
  { to: '/kitchen', label: 'Dapur', icon: ChefHat, show: (s: Staff) => !!s.role },
  { to: '/admin', label: 'Admin', icon: LayoutGrid, show: (s: Staff) => s.role === 'owner' },
  { to: '/super', label: 'Kelola Toko', icon: Building2, show: (s: Staff) => s.isSuper },
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="hidden text-sm text-muted-foreground md:block">
      {now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

const roleLabel = (s: Staff) => (s.role === 'owner' ? 'Owner' : s.role === 'cashier' ? 'Kasir' : 'Super Admin')

export function StaffLayout({ title, children }: { title: string; children: ReactNode }) {
  const staff = useStaff()
  const { pathname } = useLocation()
  const items = NAV.filter((n) => n.show(staff))

  return (
    <SidebarProvider defaultOpen={window.innerWidth >= 1280}>
      <Sidebar variant="floating" collapsible="icon" className="print:hidden">
        <SidebarHeader>
          <div className="flex items-center gap-3 p-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30 group-data-[collapsible=icon]:mx-auto">
              <Store className="size-4.5" aria-hidden />
            </div>
            <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <p className="truncate font-bold">{staff.storeName ?? 'WA-Order POS'}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(staff)}</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:gap-2">
                {items.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to} className="flex justify-center">
                    <SidebarMenuButton
                      size="lg"
                      tooltip={label}
                      isActive={pathname.startsWith(to)}
                      render={<NavLink to={to} />}
                      className="rounded-xl font-medium data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm data-active:shadow-primary/25 hover:data-active:bg-primary/90 [&_svg]:size-4.5 group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:[&>span]:hidden"
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <Separator />
          <div className="flex items-center gap-3 p-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
            <Avatar className="size-8.5 group-data-[collapsible=icon]:mx-auto">
              <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{(staff.email[0] ?? '?').toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{staff.email}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(staff)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Keluar"
              title="Keluar"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:hidden"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background px-4 md:px-6 print:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">{staff.storeName ?? 'WA-Order POS'}</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-base font-bold">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-3">
            <Clock />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="h-auto gap-2 rounded-full py-1 pr-3 pl-1" aria-label="Menu akun" />}>
                <Avatar className="size-8">
                  <AvatarFallback className="bg-accent text-sm font-semibold text-accent-foreground">{(staff.email[0] ?? '?').toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-36 truncate text-sm font-medium">{staff.email}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{roleLabel(staff)}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <span className="block truncate text-sm font-medium text-foreground">{staff.email}</span>
                    <span className="block">{staff.storeName ?? 'Super Admin'} · {roleLabel(staff)}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => supabase.auth.signOut()}>
                  <LogOut /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
