import { Check, ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { useStaff } from '@shared/lib/auth'
import { uploadMedia } from '@shared/lib/media'
import { rpc } from '@shared/lib/api'
import { BUYER_TEMPLATES, BUYER_TEMPLATE_KEYS, asTemplate, type BuyerTemplate } from '@shared/lib/buyer-look'
import { loadLogo, prepareLogo } from '@shared/lib/receipt-logo'
import { THEMES, THEME_KEYS, applyTheme, swatch, type ThemeKey } from '@shared/lib/theme'
import type { StoreConfig } from '@shared/types/contracts'

const save = (logo: string, theme: string) => rpc('save_store_branding', { p_logo: logo, p_theme: theme })

/** Logo di kepala struk: pilih gambar → otomatis diperkecil & dijadikan hitam-putih → langsung tersimpan. */
export function LogoPicker({ config, onSaved }: { config: StoreConfig | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const logo = config?.logo ?? ''

  const apply = async (next: string, done: string) => {
    setBusy(true)
    const { error } = await save(next, config?.theme ?? 'biru')
    if (!error) await loadLogo(next)
    setBusy(false)
    if (error) return toast.error('Logo gagal disimpan', { description: `${error.message} Coba lagi.` })
    toast.success(done)
    onSaved()
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 5_000_000) return toast.error('Gambar terlalu besar', { description: 'Pilih gambar di bawah 5 MB.' })
    try {
      await apply(await prepareLogo(f), 'Logo tersimpan. Akan tercetak di bagian atas struk.')
    } catch (e) {
      toast.error('Gambar tidak bisa dipakai', { description: e instanceof Error ? e.message : 'Pilih file PNG atau JPG.' })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-white p-2">
        {logo ? <img src={logo} alt="Logo struk" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" /> : <span className="text-sm text-muted-foreground">Belum ada logo</span>}
      </div>
      <div className="flex flex-col gap-2">
        <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-4 text-base font-medium hover:bg-muted ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <ImagePlus className="size-5" aria-hidden /> {busy ? 'Menyimpan…' : logo ? 'Ganti logo' : 'Pilih logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {logo && (
          <Button variant="ghost" className="h-11 text-base text-destructive" disabled={busy} onClick={() => void apply('', 'Logo dihapus dari struk.')}>
            <Trash2 /> Hapus logo
          </Button>
        )}
      </div>
    </div>
  )
}

/** Warna utama aplikasi: ketuk satu warna → langsung berubah dan tersimpan untuk semua perangkat toko. */
export function ThemePicker({ config, onSaved }: { config: StoreConfig | null; onSaved: () => void }) {
  const current = (config?.theme ?? 'biru') as ThemeKey
  const [busy, setBusy] = useState<ThemeKey | null>(null)

  const choose = async (k: ThemeKey) => {
    if (k === current) return
    setBusy(k)
    applyTheme(k) // langsung terlihat
    const { error } = await save(config?.logo ?? '', k)
    setBusy(null)
    if (error) {
      applyTheme(current)
      return toast.error('Warna gagal disimpan', { description: `${error.message} Coba lagi.` })
    }
    toast.success(`Warna aplikasi sekarang ${THEMES[k].label}`)
    onSaved()
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Warna aplikasi">
      {THEME_KEYS.map((k) => {
        const on = current === k
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!!busy}
            onClick={() => void choose(k)}
            className={`flex items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left transition-colors ${on ? 'border-foreground' : 'hover:bg-muted'}`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: swatch(k) }}>
              {on && <Check className="size-5" aria-hidden />}
            </span>
            <span className="text-base font-semibold">{THEMES[k].label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Gambar kecil yang meniru susunan tiap template, supaya pemilik bisa membayangkan tanpa membuka halaman. */
function Mock({ t, color }: { t: BuyerTemplate; color: string }) {
  const dark = t === 'malam'
  const BG: Record<BuyerTemplate, string> = {
    segar: `color-mix(in oklch, ${color} 10%, white)`, ringkas: '#f4f5f8', galeri: '#f3f4f8', majalah: '#f6f0e4', kertas: '#f3ead7',
    malam: '#1f2128', bento: `color-mix(in oklch, ${color} 6%, white)`, pastel: `color-mix(in oklch, ${color} 18%, white)`, label: '#f3f4f8', minimalis: '#ffffff',
  }
  const card = dark ? '#2e313a' : '#fff'
  const photo = dark ? '#555a66' : '#cfd3dc'
  const ink = dark ? '#9aa0ad' : '#9aa0ad'
  const bar = (w: string, c = ink) => <div className="h-1.5 rounded" style={{ width: w, background: c }} />
  const dot = <div className="size-3 rounded-full" style={{ background: color }} />
  let body: ReactNode
  switch (t) {
    case 'ringkas':
      body = <div className="flex h-full flex-col gap-1">{[0, 1, 2].map((i) => <div key={i} className="flex flex-1 items-center gap-1.5 rounded px-1" style={{ background: card }}><div className="size-5 rounded" style={{ background: photo }} /><div className="flex-1 space-y-1">{bar('70%')}{bar('35%', color)}</div>{dot}</div>)}</div>
      break
    case 'galeri':
      body = <div className="grid h-full grid-cols-2 gap-1.5">{[0, 1].map((i) => <div key={i} className="relative overflow-hidden rounded-lg" style={{ background: photo }}><div className="absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-black/70 to-transparent p-1.5">{bar('70%', '#fff')}{bar('40%', '#fff')}</div></div>)}</div>
      break
    case 'majalah':
      body = <div className="flex h-full flex-col gap-1.5"><div className="flex flex-1 gap-1.5 rounded-lg p-1" style={{ background: card }}><div className="w-1/2 rounded" style={{ background: photo }} /><div className="flex-1 space-y-1 pt-1">{bar('40%', color)}{bar('90%', '#555')}{bar('60%')}</div></div><div className="grid flex-1 grid-cols-3 gap-1">{[0, 1, 2].map((i) => <div key={i} className="rounded" style={{ background: photo }} />)}</div></div>
      break
    case 'kertas':
      body = <div className="flex h-full flex-col justify-center gap-2 px-2">{[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-1">{bar('35%', '#6b5a3c')}<div className="flex-1 border-b border-dotted border-[#6b5a3c]" />{bar('15%', '#6b5a3c')}</div>)}</div>
      break
    case 'malam':
      body = <div className="grid h-full grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="flex flex-col items-center justify-center gap-1 rounded-lg" style={{ background: card }}><div className="size-7 rounded-full" style={{ background: photo, boxShadow: `0 0 10px ${color}` }} />{bar('60%')}{bar('35%', color)}</div>)}</div>
      break
    case 'bento':
      body = <div className="grid h-full grid-cols-4 grid-rows-2 gap-1">{Array.from({ length: 8 }, (_, i) => <div key={i} className="relative rounded" style={{ background: photo }}><div className="absolute bottom-0.5 left-0.5 h-1.5 w-1/2 rounded-sm bg-black/60" /></div>)}</div>
      break
    case 'pastel':
      body = <div className="grid h-full grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="flex flex-col items-center justify-center gap-1 rounded-2xl" style={{ background: card }}><div className="size-7 rounded-full border-2 border-white shadow" style={{ background: photo }} />{bar('60%')}<div className="h-2 w-1/2 rounded-full" style={{ background: `color-mix(in oklch, ${color} 30%, white)` }} /></div>)}</div>
      break
    case 'label':
      body = <div className="grid h-full grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="relative flex flex-col overflow-hidden rounded-lg shadow-sm" style={{ background: card }}><div className="flex-1" style={{ background: photo }} /><div className="absolute left-0 top-1.5 h-2 w-1/2 rounded-r" style={{ background: color }} /><div className="p-1">{bar('80%', '#444')}</div></div>)}</div>
      break
    case 'minimalis':
      body = <div className="grid h-full grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="flex flex-col items-center gap-1"><div className="w-full flex-1 rounded-xl" style={{ background: photo }} />{bar('60%')}{bar('30%')}</div>)}</div>
      break
    default:
      body = <div className="grid h-full grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="flex flex-col gap-1 rounded-xl p-1 shadow-sm" style={{ background: card }}><div className="flex-1 rounded-lg" style={{ background: photo }} /><div className="flex items-center justify-between">{bar('45%')}{dot}</div></div>)}</div>
  }
  return <div aria-hidden className="h-28 w-full rounded-lg p-2" style={{ background: BG[t] }}>{body}</div>
}

/** Template halaman pembeli: ketuk satu → langsung tersimpan. "Lihat contoh" membuka halaman pembeli dengan template itu. */
export function BuyerTemplatePicker({ config, onSaved }: { config: StoreConfig | null; onSaved: () => void }) {
  const current = asTemplate(config?.buyer_template)
  const color = swatch((config?.theme && config.theme in THEMES ? config.theme : 'biru') as ThemeKey)
  const [busy, setBusy] = useState(false)

  const choose = async (k: BuyerTemplate) => {
    if (k === current) return
    setBusy(true)
    const { error } = await rpc('save_buyer_template', { p_template: k })
    setBusy(false)
    if (error) return toast.error('Template gagal disimpan', { description: `${error.message} Coba lagi.` })
    toast.success(`Halaman pembeli sekarang memakai template ${BUYER_TEMPLATES[k].label}`, { description: 'Pembeli melihatnya paling lambat 1 menit lagi.' })
    onSaved()
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Template halaman pembeli">
      {BUYER_TEMPLATE_KEYS.map((k) => {
        const on = current === k
        return (
          <div key={k} className={`space-y-2 rounded-2xl border-2 bg-card p-3 ${on ? 'border-primary bg-primary/5' : ''}`}>
            <button type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => void choose(k)} className="block w-full space-y-2 text-left">
              <Mock t={k} color={color} />
              <span className="flex items-center justify-between gap-2 text-lg font-bold">
                {BUYER_TEMPLATES[k].label}
                {on && <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-sm text-primary-foreground"><Check className="size-4" aria-hidden /> Dipakai</span>}
              </span>
              <span className="block text-base text-muted-foreground">{BUYER_TEMPLATES[k].hint}</span>
            </button>
            {config?.slug && (
              <a href={`/s/${config.slug}?template=${k}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-primary underline">
                <ExternalLink className="size-4" aria-hidden /> Lihat contoh
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Perkecil gambar ke maks 256px (WebP) supaya logo ringan dibuka pembeli. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(256 / bmp.width, 256 / bmp.height, 1)
  const cv = document.createElement('canvas')
  cv.width = Math.round(bmp.width * scale)
  cv.height = Math.round(bmp.height * scale)
  cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Gambar tidak bisa diproses.'))), 'image/webp', 0.9))
}

/** Logo berwarna + slogan toko untuk halaman pembeli (berbeda dari logo struk yang hitam-putih). */
export function StoreIdentity({ config, onSaved }: { config: StoreConfig | null; onSaved: () => void }) {
  const { storeId } = useStaff()
  const logo = config?.logo_url ?? ''
  const [tagline, setTagline] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const text = tagline ?? config?.tagline ?? ''

  const store = async (nextLogo: string, nextTagline: string, done: string) => {
    setBusy(true)
    const { error } = await rpc('save_store_identity', { p_logo_url: nextLogo, p_tagline: nextTagline })
    setBusy(false)
    if (error) return toast.error('Belum tersimpan', { description: `${error.message} Coba lagi.` })
    toast.success(done)
    setTagline(null)
    onSaved()
  }

  const pick = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return toast.error('Pilih file gambar', { description: 'Gunakan PNG atau JPG.' })
    setBusy(true)
    try {
      // Sama seperti foto menu: tujuan akhir Google Drive (lihat uploadMedia)
      const small = new File([await shrink(f)], 'logo.webp', { type: 'image/webp' })
      const { url } = await uploadMedia(small, storeId ?? 'pos', 'logo')
      await store(url, text, 'Logo toko tersimpan. Tampil di halaman pembeli.')
    } catch (e) {
      setBusy(false)
      toast.error('Logo gagal diunggah', { description: `${e instanceof Error ? e.message : ''} Coba gambar lain.` })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-white">
          {logo ? <img src={logo} alt="Logo toko" className="size-full object-cover" /> : <span className="px-1 text-center text-sm text-muted-foreground">Belum ada logo</span>}
        </div>
        <div className="flex flex-col gap-2">
          <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-4 text-base font-medium hover:bg-muted ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <ImagePlus className="size-5" aria-hidden /> {busy ? 'Menyimpan…' : logo ? 'Ganti logo' : 'Pilih logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {logo && (
            <Button variant="ghost" className="h-11 text-base text-destructive" disabled={busy} onClick={() => void store('', text, 'Logo toko dihapus.')}>
              <Trash2 /> Hapus logo
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="st-tagline" className="block text-base font-semibold">Slogan / deskripsi singkat toko</label>
        <div className="flex flex-wrap gap-2">
          <Input id="st-tagline" value={text} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder="Contoh: Kopi & masakan rumahan sejak 2015" className="h-12 min-w-56 flex-1 text-base" />
          <Button className="h-12 px-5 text-base font-bold" disabled={busy || text === (config?.tagline ?? '')} onClick={() => void store(logo, text, 'Slogan tersimpan.')}>Simpan slogan</Button>
        </div>
      </div>
    </div>
  )
}
