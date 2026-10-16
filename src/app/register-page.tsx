import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button, buttonVariants } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { supabase } from '@shared/lib/supabase'
import { RegisterSchema } from '@shared/types/contracts'
import { AuthShell } from './auth-shell'

export function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const parsed = RegisterSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setError(parsed.error.issues[0].message)

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password })
    setBusy(false)
    if (error) return setError(error.message)
    // Tanpa session = project mewajibkan konfirmasi email
    if (data.session) navigate('/cashier', { replace: true })
    else setSent(true)
  }

  if (sent)
    return (
      <AuthShell>
        <h2 className="text-xl font-bold">Cek email kamu</h2>
        <p className="mt-2 text-sm text-muted-foreground">Klik link konfirmasi di email, lalu masuk. Akun baru perlu dihubungkan ke toko oleh owner sebelum bisa dipakai.</p>
        <Link to="/login" className={buttonVariants({ variant: "link", className: "mt-6 px-0" })}>Ke halaman masuk</Link>
      </AuthShell>
    )

  return (
    <AuthShell>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <h2 className="text-xl font-bold">Daftar Staf</h2>
          <p className="mt-1 text-sm text-muted-foreground">Setelah mendaftar, minta owner tokomu menambahkan emailmu sebagai staf.</p>
        </div>
        <Input name="email" type="email" required placeholder="Email" aria-label="Email" autoComplete="email" />
        <Input name="password" type="password" required placeholder="Password (min. 8 karakter)" aria-label="Password" autoComplete="new-password" />
        <Input name="confirm" type="password" required placeholder="Ulangi password" aria-label="Ulangi password" autoComplete="new-password" />
        <ErrorAlert message={error} />
        <Button size="lg" disabled={busy} className="w-full">{busy ? 'Memproses…' : 'Daftar'}</Button>
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun? <Link to="/login" className="font-semibold text-primary">Masuk</Link>
        </p>
      </form>
    </AuthShell>
  )
}
