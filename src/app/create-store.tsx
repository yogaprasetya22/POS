import { useState, type FormEvent } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { rpc } from '@shared/lib/api'

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/** Pendaftar baru tanpa toko: buat toko sendiri (jadi owner, masa uji coba 14 hari). */
export function CreateStoreForm() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [touched, setTouched] = useState(false)
  const [wa, setWa] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const phone = wa.replace(/\D/g, '').replace(/^0/, '62')
    if (!/^62\d{8,13}$/.test(phone)) return setError('Nomor WhatsApp harus format 62xxxxxxxxxx')
    if (slug.length < 3) return setError('Alamat toko minimal 3 karakter')
    setBusy(true)
    const { error: err } = await rpc('register_store', { p_name: name, p_slug: slug, p_wa: phone })
    setBusy(false)
    if (err) return setError(err.message)
    window.location.assign('/admin')
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="cs-name">Nama usaha</Label>
        <Input id="cs-name" value={name} required maxLength={60} className="h-11" onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)) }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cs-slug">Alamat link toko</Label>
        <Input id="cs-slug" value={slug} required className="h-11 font-mono" onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)) }} />
        <p className="text-xs text-muted-foreground">Pelanggan memesan di /s/{slug || 'nama-toko'}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cs-wa">Nomor WhatsApp kasir</Label>
        <Input id="cs-wa" value={wa} required inputMode="numeric" placeholder="62812xxxxxxx" className="h-11" onChange={(e) => setWa(e.target.value)} />
      </div>
      <ErrorAlert message={error} />
      <Button size="lg" className="h-12" disabled={busy}>{busy ? 'Membuat…' : 'Buat toko saya'}</Button>
    </form>
  )
}
