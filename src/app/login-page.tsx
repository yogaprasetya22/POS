import { m } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { AccountSwitcher } from '@shared/components/switch-user'
import { listAccounts, rememberAccount } from '@shared/lib/device-accounts'
import { supabase } from '@shared/lib/supabase'
import { AuthShell } from './auth-shell'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [remember, setRemember] = useState(true)
  const [useEmail, setUseEmail] = useState(() => listAccounts().length === 0)
  const next = params.get('next') ?? '/cashier'

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) })
    if (error) {
      setBusy(false)
      return setError(/invalid/i.test(error.message) ? 'Email atau kata sandi salah.' : error.message)
    }
    if (remember && data.session) {
      // ingat di perangkat ini supaya lain kali cukup ketuk nama + PIN
      const { data: p } = await supabase.from('profiles').select('role, display_name').eq('user_id', data.session.user.id).maybeSingle()
      if (p?.role) rememberAccount({ userId: data.session.user.id, email: data.session.user.email ?? '', name: (p.display_name ?? '').trim(), role: p.role, refreshToken: data.session.refresh_token })
    }
    setBusy(false)
    navigate(next, { replace: true })
  }

  if (!useEmail)
    return (
      <AuthShell>
        <div className="grid gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Masuk</h2>
            <p className="mt-1 text-base text-muted-foreground">Ketuk nama kamu, lalu masukkan PIN.</p>
          </div>
          <AccountSwitcher onDone={() => window.location.assign(next)} />
          <Button variant="outline" className="h-12 border-2 text-base" onClick={() => setUseEmail(true)}>
            Masuk pakai email & kata sandi
          </Button>
        </div>
      </AuthShell>
    )

  return (
    <AuthShell>
      <m.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Masuk</h2>
          <p className="mt-1 text-sm text-muted-foreground">Masuk dengan akun owner atau staf tokomu.</p>
        </div>
        <Input name="email" type="email" required placeholder="Email" aria-label="Email" />
        <Input name="password" type="password" required placeholder="Kata sandi" aria-label="Password" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-5 accent-primary" />
          Ingat saya di perangkat ini (lain kali cukup pakai PIN)
        </label>
        <ErrorAlert message={error} />
        <Button size="lg" disabled={busy} className="w-full">{busy ? 'Memproses…' : 'Masuk'}</Button>
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun? <Link to="/register" className="font-semibold text-primary">Daftar</Link>
        </p>
        {listAccounts().length > 0 && (
          <Button type="button" variant="ghost" className="h-11 text-base" onClick={() => setUseEmail(false)}>
            Kembali ke daftar nama
          </Button>
        )}
      </m.form>
    </AuthShell>
  )
}
