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
      <form onSubmit={submit} className="grid gap-4">
        <h2 className="text-xl font-bold">Masuk Staf</h2>
        <Input name="email" type="email" required placeholder="Email" aria-label="Email" />
        <Input name="password" type="password" required placeholder="Password" aria-label="Password" />
        <ErrorAlert message={error} />
        <Button size="lg" disabled={busy} className="w-full">{busy ? 'Memproses…' : 'Masuk'}</Button>
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun? <Link to="/register" className="font-semibold text-primary">Daftar</Link>
        </p>
      </form>
    </AuthShell>
  )
}
