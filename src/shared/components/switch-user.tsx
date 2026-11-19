import { Delete, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { rpc } from '@shared/lib/api'
import { displayName, type Staff } from '@shared/lib/auth'
import { SWITCH_MESSAGE, leaveToLogin, listAccounts, refreshAccountInfo, switchAccount, type DeviceAccount } from '@shared/lib/device-accounts'

const ROLE: Record<string, string> = { owner: 'Pemilik', manager: 'Manager', cashier: 'Kasir', waiter: 'Pelayan', kitchen: 'Dapur' }
export const roleName = (r: string | null | undefined) => (r ? (ROLE[r] ?? r) : 'Staf')

/** Papan angka besar untuk PIN 4 angka; terkirim otomatis begitu angka ke-4 ditekan. */
export function PinPad({ busy, onSubmit, length = 4 }: { busy: boolean; onSubmit: (pin: string) => void; length?: number }) {
  const [pin, setPin] = useState('')
  const press = (d: string) => {
    if (busy) return
    const next = (pin + d).slice(0, 6)
    setPin(next)
    if (next.length === length) {
      onSubmit(next)
      setPin('')
    }
  }
  return (
    <div className="mx-auto grid w-full max-w-72 gap-3">
      <div className="flex justify-center gap-3" aria-label={`${pin.length} angka dimasukkan`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`size-4 rounded-full border-2 border-primary ${i < pin.length ? 'bg-primary' : ''}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Button key={d} type="button" variant="outline" disabled={busy} className="h-16 border-2 text-2xl font-bold" onClick={() => press(d)}>
            {d}
          </Button>
        ))}
        <span />
        <Button type="button" variant="outline" disabled={busy} className="h-16 border-2 text-2xl font-bold" onClick={() => press('0')}>
          0
        </Button>
        <Button type="button" variant="ghost" disabled={busy || !pin} className="h-16" aria-label="Hapus satu angka" onClick={() => setPin(pin.slice(0, -1))}>
          <Delete className="size-7" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Pilih nama → ketik PIN → pindah akun. Dipakai di menu akun ("Ganti orang") dan di halaman masuk.
 * `exclude`: akun yang sedang aktif tidak perlu ditampilkan.
 */
export function AccountSwitcher({ exclude, onDone }: { exclude?: string; onDone: () => void }) {
  const [accounts] = useState<DeviceAccount[]>(() => listAccounts().filter((a) => a.userId !== exclude))
  const [picked, setPicked] = useState<DeviceAccount | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (accounts.length === 0) return null

  if (picked)
    return (
      <div className="grid gap-4">
        <div className="text-center">
          <p className="text-lg font-bold">{picked.name || picked.email}</p>
          <p className="text-base text-foreground/75">Masukkan PIN kamu</p>
        </div>
        <PinPad
          busy={busy}
          onSubmit={async (pin) => {
            setBusy(true)
            setError('')
            const r = await switchAccount(picked.userId, pin)
            setBusy(false)
            if (r === 'OK') return onDone()
            setError(SWITCH_MESSAGE[r])
          }}
        />
        <ErrorAlert message={error} />
        <Button variant="ghost" className="h-11 text-base" onClick={() => { setPicked(null); setError('') }}>
          Bukan saya, pilih nama lain
        </Button>
      </div>
    )

  return (
    <div className="grid gap-2">
      <p className="text-base font-semibold">Pilih nama kamu:</p>
      <div className="grid grid-cols-2 gap-2">
        {accounts.map((a) => (
          <button
            key={a.userId}
            type="button"
            onClick={() => setPicked(a)}
            className="flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-background p-3 text-left transition hover:border-primary"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {(a.name || a.email)[0]?.toUpperCase() ?? <UserRound />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold">{a.name || a.email}</span>
              <span className="block text-sm text-foreground/70">{roleName(a.role)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function SwitchUserDialog({ open, onOpenChange, staff }: { open: boolean; onOpenChange: (v: boolean) => void; staff: Staff }) {
  const others = listAccounts().filter((a) => a.userId !== staff.userId)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Ganti orang</DialogTitle>
          <DialogDescription className="text-base">Sekarang: {displayName(staff)}. Pilih siapa yang mau pakai perangkat ini.</DialogDescription>
        </DialogHeader>
        {others.length > 0 ? (
          <AccountSwitcher exclude={staff.userId} onDone={() => window.location.assign('/cashier')} />
        ) : (
          <p className="rounded-xl bg-muted p-3 text-base">
            Belum ada akun lain di perangkat ini. Minta karyawan masuk sekali pakai email dan kata sandi di perangkat ini. Setelah itu, namanya muncul di sini dan cukup pakai PIN.
          </p>
        )}
        <Button
          variant="outline"
          className="h-12 border-2 text-base"
          onClick={() => void leaveToLogin()}
        >
          Masuk pakai email lain
        </Button>
      </DialogContent>
    </Dialog>
  )
}

/** Atur nama tampilan dan PIN pribadi untuk akun yang sedang masuk. */
export function MyProfileDialog({ open, onOpenChange, staff }: { open: boolean; onOpenChange: (v: boolean) => void; staff: Staff }) {
  const [name, setName] = useState(staff.name)
  const [pin, setPin] = useState('')
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (!open) return
    setName(staff.name)
    setPin('')
    setError('')
    setSaved('')
    void rpc('has_my_pin').then(({ data }) => setHasPin(data === true))
  }, [open, staff.name])

  const save = async () => {
    setError('')
    setSaved('')
    if (pin && !/^\d{4}$/.test(pin)) return setError('PIN harus 4 angka.')
    setBusy(true)
    const r1 = await rpc('set_staff_name', { p_user_id: staff.userId, p_name: name })
    const r2 = pin ? await rpc('set_my_pin', { p_pin: pin }) : { error: null }
    setBusy(false)
    const err = r1.error ?? r2.error
    if (err) return setError(err.message)
    refreshAccountInfo(staff.userId, { name: name.trim(), role: staff.role ?? '', email: staff.email })
    if (pin) setHasPin(true)
    setPin('')
    setSaved('Tersimpan.')
    // muat ulang profil supaya nama baru langsung tampil di header
    const { supabase } = await import('@shared/lib/supabase')
    void supabase.auth.refreshSession()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Nama & PIN saya</DialogTitle>
          <DialogDescription className="text-base">Nama tampil di layar dan catatan. PIN dipakai untuk ganti orang dengan cepat di perangkat bersama.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="me-name" className="text-base">Nama panggilan</Label>
            <Input id="me-name" value={name} maxLength={40} placeholder="Contoh: Budi" className="h-12 text-base" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="me-pin" className="text-base">{hasPin ? 'Ganti PIN (kosongkan bila tidak diganti)' : 'Buat PIN (4 angka)'}</Label>
            <Input id="me-pin" value={pin} inputMode="numeric" type="password" autoComplete="new-password" maxLength={4} placeholder="••••" className="h-12 text-center text-2xl tracking-[0.5em]" onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            {hasPin === false && <p className="text-sm text-amber-700 dark:text-amber-300">Kamu belum punya PIN, jadi belum bisa memakai "Ganti orang".</p>}
          </div>
          <ErrorAlert message={error} />
          {saved && <p role="status" className="text-base font-semibold text-emerald-700 dark:text-emerald-300">{saved}</p>}
          <Button className="h-12 text-base font-bold" disabled={busy} onClick={save}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
