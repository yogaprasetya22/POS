import { EllipsisVertical, LogOut } from 'lucide-react'
import { LanguageMenu } from './language-menu'
import { Avatar, AvatarFallback } from '@shared/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@shared/components/ui/sidebar'
import type { Staff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import { roleLabel } from './parts'

/** Akun di dasar sidebar (pola NavUser dashboard-01): avatar, email, peran, menu keluar. */
export function NavUser({ staff }: { staff: Staff }) {
  const { isMobile } = useSidebar()
  const initial = (staff.email[0] ?? '?').toUpperCase()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-accent text-sm font-semibold text-accent-foreground">{initial}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{staff.email}</span>
              <span className="truncate text-xs text-muted-foreground">{roleLabel(staff)}</span>
            </div>
            <EllipsisVertical className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-accent text-sm font-semibold text-accent-foreground">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{staff.email}</span>
                    <span className="truncate text-xs text-muted-foreground">{staff.storeName ?? 'Platform'} · {roleLabel(staff)}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <LanguageMenu />
            <DropdownMenuItem className="min-h-10 text-destructive focus:text-destructive" onClick={() => supabase.auth.signOut()}>
              <LogOut /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
