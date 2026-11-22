import { m } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { getDevice } from '@shared/lib/device-binding'
import { supabase } from '@shared/lib/supabase'
import { AuthShell } from './auth-shell'

/**
 * Masuk dengan email & kata sandi. Ganti kasir cepat pakai PIN ada di perangkat kasir (/kunci),
 * yang sesinya dibuat server tiap kali masuk sehingga tidak pernah "habis".
 */
export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const next = params.get('next') ?? '/cashier'

  // Bersihkan daftar "akun tersimpan" versi lama (token yang bisa kedaluwarsa)
  useEffect(() => {
    try {
      localStorage.removeItem('pos-device-accounts')
    } catch {
      /* abaikan */
    }
  }, [])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: String(f.get('password')) })
    setBusy(false)
    if (error) return setError(/invalid/i.test(error.message) ? 'Email atau kata sandi salah.' : error.message)
    navigate(next, { replace: true })
  }

  // Perangkat kasir terikat: pakai layar PIN. ?email=1 tetap bisa masuk email biasa.
  if (getDevice() && !params.has('email')) return <Navigate to="/kunci" replace />

  return (
    <AuthShell>
      <m.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Masuk</h2>
          <p className="mt-1 text-sm text-muted-foreground">Masuk dengan akun owner atau staf tokomu.</p>
        </div>
        <Input name="email" type="email" required placeholder="Email" aria-label="Email" autoComplete="username" />
        <Input name="password" type="password" required placeholder="Kata sandi" aria-label="Password" autoComplete="current-password" />
        <ErrorAlert message={error} />
        <Button size="lg" disabled={busy} className="w-full">{busy ? 'Memproses…' : 'Masuk'}</Button>
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun? <Link to="/register" className="font-semibold text-primary">Daftar</Link>
        </p>
        <div className="rounded-xl bg-muted/50 p-3 text-center text-sm text-muted-foreground">
          Mau kasir masuk cukup pakai PIN di tablet ini?
          <br />
          Masuk sebagai <strong className="text-foreground">owner/manager</strong>, lalu buka menu akun → <strong className="text-foreground">Jadikan perangkat kasir</strong>.
        </div>
      </m.form>
    </AuthShell>
  )
}
