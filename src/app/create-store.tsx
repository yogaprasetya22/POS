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
  const [editSlug, setEditSlug] = useState(false)
  const [wa, setWa] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    // Terima 0812…, +62 812…, 62812…, dengan spasi atau strip
    const phone = wa.replace(/\D/g, '').replace(/^0/, '62')
    if (!/^62\d{8,13}$/.test(phone)) return setError('Nomor WhatsApp belum benar. Contoh: 0812 3456 7890')
    if (slug.length < 3) return setError('Nama usaha minimal 3 huruf')
    setBusy(true)
    const { error: err } = await rpc('register_store', { p_name: name, p_slug: slug, p_wa: phone })
    setBusy(false)
    if (err) {
      if (/duplicate|unique|sudah dipakai|exists/i.test(err.message)) {
        setEditSlug(true)
        return setError('Alamat link toko ini sudah dipakai toko lain. Ganti sedikit, misalnya tambahkan nama kota.')
      }
      return setError(err.message)
    }
    window.location.assign('/admin')
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="cs-name" className="text-base">Nama usaha</Label>
        <Input id="cs-name" value={name} required maxLength={60} placeholder="Contoh: Warkop Pak Budi" className="h-12 text-base" onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)) }} />
        {slug && (
          <p className="text-sm text-foreground/75">
            Link pesan untuk pembeli: <span className="font-semibold">/s/{slug}</span>{' '}
            {!editSlug && <button type="button" className="font-semibold text-primary underline" onClick={() => setEditSlug(true)}>ubah</button>}
          </p>
        )}
      </div>
      {editSlug && (
        <div className="space-y-1.5">
          <Label htmlFor="cs-slug" className="text-base">Alamat link toko</Label>
          <Input id="cs-slug" value={slug} required className="h-12 text-base" onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)) }} />
          <p className="text-sm text-foreground/75">Huruf kecil, angka, dan tanda strip saja.</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="cs-wa" className="text-base">Nomor WhatsApp toko</Label>
        <Input id="cs-wa" value={wa} required inputMode="tel" placeholder="0812 3456 7890" className="h-12 text-base" onChange={(e) => setWa(e.target.value)} />
        <p className="text-sm text-foreground/75">Dipakai pembeli untuk menghubungi toko.</p>
      </div>
      <ErrorAlert message={error} />
      <Button size="lg" className="h-14 text-lg font-bold" disabled={busy}>{busy ? 'Membuat toko…' : 'Buat toko saya'}</Button>
      <p className="text-center text-sm text-foreground/75">Gratis 14 hari. Setelah ini kamu dipandu langkah demi langkah.</p>
    </form>
  )
}
