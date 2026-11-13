import { m } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { supabase } from '@shared/lib/supabase'
import { AuthShell } from './auth-shell'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) })
    setBusy(false)
    if (error) return setError(error.message)
    navigate(params.get('next') ?? '/cashier', { replace: true })
  }

  return (
    <AuthShell>
      <m.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Masuk</h2>
          <p className="mt-1 text-sm text-muted-foreground">Masuk dengan akun owner atau staf tokomu.</p>
        </div>
        <Input name="email" type="email" required placeholder="Email" aria-label="Email" />
        <Input name="password" type="password" required placeholder="Password" aria-label="Password" />
        <ErrorAlert message={error} />
        <Button size="lg" disabled={busy} className="w-full">{busy ? 'Memproses…' : 'Masuk'}</Button>
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun? <Link to="/register" className="font-semibold text-primary">Daftar</Link>
        </p>
      </m.form>
    </AuthShell>
  )
}
