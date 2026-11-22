import { CheckCircle2, Link2Off, MonitorSmartphone } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { rpc } from '@shared/lib/api'
import { bindThisDevice, clearDevice, getDevice } from '@shared/lib/device-binding'
import { createClient } from '@supabase/supabase-js'

/**
 * Login manager sementara, hanya untuk aktivasi/putus perangkat. Sengaja pakai klien TERPISAH tanpa
 * penyimpanan: klien utama punya sinkron "akun tersimpan" (device-accounts) yang akan menimpa token
 * akun tersimpan dengan sesi sementara ini, lalu jadi mati saat sesi ini dicabut.
 */
async function asManager<T>(email: string, password: string, run: (token: string) => Promise<T>): Promise<T> {
  const temp = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'pos-device-setup-temp' },
  })
  const { data, error } = await temp.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.session) throw new Error('Email atau password salah')
  try {
    return await run(data.session.access_token)
  } finally {
    await temp.auth.signOut({ scope: 'local' }).catch(() => {})
  }
}

/** /perangkat: aktivasi perangkat kasir oleh manager, atau putuskan perangkat yang sudah terikat. */
export function DeviceSetupPage() {
  const navigate = useNavigate()
  const device = getDevice()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('Kasir 1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bind = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await asManager(email, password, (token) => bindThisDevice(name, token))
      navigate('/kunci', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const unbind = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!device) return
    setBusy(true)
    setError('')
    try {
      await asManager(email, password, async (token) => {
        const { error: err } = await rpc('unbind_device', { p_device: device.deviceId }, { token })
        if (err) throw err
      })
      clearDevice()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 p-4">
      <form onSubmit={device ? unbind : bind} className="w-full max-w-md space-y-5 rounded-3xl border-2 bg-card p-6 shadow-sm">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            {device ? <Link2Off className="size-7" /> : <MonitorSmartphone className="size-7" />}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{device ? 'Putuskan perangkat' : 'Aktivasi perangkat kasir'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {device
              ? `Perangkat "${device.name}" terikat ke ${device.storeName}. Setelah diputus, kasir tidak bisa masuk pakai PIN di sini.`
              : 'Dilakukan sekali oleh owner/manager. Setelah aktif, kasir cukup masuk dengan PIN di perangkat ini.'}
          </p>
        </div>

        {!device && (
          <ul className="space-y-1.5 rounded-2xl bg-muted/50 p-3 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Tetap aktif walau browser ditutup atau dimuat ulang.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Akun manager langsung keluar lagi setelah aktivasi.</li>
          </ul>
        )}

        {!device && (
          <div className="space-y-1.5">
            <Label htmlFor="dev-name">Nama perangkat</Label>
            <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11" placeholder="Contoh: Kasir depan" required />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="dev-email">Email owner / manager <span className="font-normal text-muted-foreground">(bukan akun kasir)</span></Label>
          <Input id="dev-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dev-pass">Password</Label>
          <Input id="dev-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" required />
        </div>

        {error && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}

        <Button type="submit" disabled={busy} variant={device ? 'destructive' : 'default'} className="h-12 w-full text-base font-bold">
          {busy ? 'Memproses…' : device ? 'Putuskan perangkat ini' : 'Aktifkan perangkat'}
        </Button>
        <p className="text-center text-sm">
          <Link to={device ? '/kunci' : '/login'} className="text-muted-foreground hover:underline">{device ? '← Kembali ke layar PIN' : 'Masuk biasa dengan email'}</Link>
        </p>
      </form>
    </main>
  )
}
