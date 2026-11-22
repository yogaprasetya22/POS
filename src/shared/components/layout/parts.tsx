import { KeyRound, Lock, LogOut, MonitorSmartphone } from 'lucide-react'
import { BindDeviceDialog } from '@shared/components/bind-device-dialog'
import { getDevice, lockDevice } from '@shared/lib/device-binding'
import { MyProfileDialog } from '@shared/components/switch-user'
import { forgetAccount } from '@shared/lib/device-accounts'
import { LanguageMenu } from './language-menu'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@shared/components/ui/avatar'
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
import { displayName, type Staff } from '@shared/lib/auth'
import { planDaysLeft } from '@shared/lib/store-config'
import { supabase } from '@shared/lib/supabase'
import { ROLE_LABEL, type StoreConfig } from '@shared/types/contracts'

export const roleLabel = (s: Staff) => (s.role ? ROLE_LABEL[s.role] : 'Super Admin')

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="hidden whitespace-nowrap text-sm text-muted-foreground lg:block">
      {now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

/** Banner offline dan masa langganan; dipasang di bawah header kedua layout. */
export function StatusBanners({ staff, config }: { staff: Staff; config: StoreConfig | null }) {
  const online = useOnline()
  const daysLeft = planDaysLeft(config)
  return (
    <>
      {!online && (
        <p role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 print:hidden dark:bg-amber-500/20 dark:text-amber-100">
          Tidak ada internet. Aplikasi tetap terbuka, tapi pesanan dan pembayaran baru bisa diproses setelah tersambung lagi.
        </p>
      )}
      {daysLeft !== null && daysLeft <= 7 && staff.role && (
        <p role="status" className={`px-4 py-2 text-center text-sm print:hidden ${daysLeft < 0 ? 'bg-destructive text-white' : 'bg-primary/10'}`}>
          {daysLeft < 0
            ? 'Langganan toko sudah berakhir. Pesanan dan pembayaran baru ditolak sampai diperpanjang.'
            : `Masa ${config?.plan === 'trial' ? 'uji coba' : 'langganan'} tersisa ${daysLeft} hari.`}
        </p>
      )}
    </>
  )
}

export function AccountMenu({ staff }: { staff: Staff }) {
  const [dialog, setDialog] = useState<'bind' | 'me' | null>(null)
  const who = displayName(staff)
  // Perangkat kasir terikat: ganti orang = kunci layar -> layar PIN (perangkat tetap terikat)
  const bound = Boolean(getDevice()) && Boolean(staff.role)
  return (
    <>
    {bound && (
      <Button variant="outline" className="h-10 gap-1.5 rounded-full border-2 px-3 font-semibold" onClick={() => void lockDevice()} title="Kunci layar. Kasir berikutnya masuk dengan PIN.">
        <Lock className="size-4" /> <span className="hidden sm:inline">Kunci / Ganti kasir</span>
      </Button>
    )}
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-auto gap-2 rounded-full py-1 pr-3 pl-1" aria-label="Menu akun" />}>
        <Avatar className="size-8">
          <AvatarFallback className="bg-accent text-sm font-semibold text-accent-foreground">{(who[0] ?? '?').toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-medium">{who}</span>
          <span className="block text-xs font-normal text-muted-foreground">{roleLabel(staff)}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-medium text-foreground">{who}</span>
            {staff.name && <span className="block truncate">{staff.email}</span>}
            <span className="block">{staff.storeName ?? 'Super Admin'} · {roleLabel(staff)}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {staff.role && (
          <>
            {bound ? (
              <DropdownMenuItem className="min-h-11 text-base" onClick={() => void lockDevice()}>
                <Lock /> Kunci layar / Ganti kasir
              </DropdownMenuItem>
            ) : (staff.role === 'owner' || staff.role === 'manager') ? (
              <DropdownMenuItem className="min-h-11 text-base" onClick={() => setDialog('bind')}>
                <MonitorSmartphone /> Jadikan perangkat kasir
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem className="min-h-11 text-base" onClick={() => setDialog('me')}>
              <KeyRound /> Nama & PIN saya
            </DropdownMenuItem>
          </>
        )}
        <LanguageMenu />
        <DropdownMenuItem
          className="min-h-11 text-destructive focus:text-destructive"
          onClick={() => {
            if (bound) return void lockDevice() // perangkat kasir: keluar = kunci, binding tetap
            // keluar penuh: akun ini juga dilupakan dari daftar "Ganti orang" di perangkat ini
            forgetAccount(staff.userId)
            void supabase.auth.signOut()
          }}
        >
          <LogOut /> {bound ? 'Keluar (kunci layar)' : 'Keluar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {dialog === 'bind' && <BindDeviceDialog onClose={() => setDialog(null)} />}
    <MyProfileDialog open={dialog === 'me'} onOpenChange={(v) => setDialog(v ? 'me' : null)} staff={staff} />
    </>
  )
}
