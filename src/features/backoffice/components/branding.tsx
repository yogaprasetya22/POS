import { Check, ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
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
      <div className="grid h-20 w-36 place-items-center rounded-xl border-2 border-dashed bg-white p-2">
        {logo ? <img src={logo} alt="Logo struk" className="max-h-full max-w-full [image-rendering:pixelated]" /> : <span className="text-sm text-muted-foreground">Belum ada logo</span>}
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
  const dark = t === 'gelap'
  const bg = dark ? '#22242b' : t === 'lembut' ? `color-mix(in oklch, ${color} 14%, white)` : '#f3f4f8'
  const card = dark ? '#33363f' : '#fff'
  const photo = dark ? '#565a66' : '#cfd3dc'
  const line = dark ? '#8b8f9b' : '#9aa0ad'
  const box = (extra: React.CSSProperties) => ({ background: card, borderRadius: t === 'lembut' ? 10 : 5, overflow: 'hidden', ...extra })
  return (
    <div aria-hidden className="h-28 w-full rounded-lg p-2" style={{ background: bg }}>
      {t === 'daftar' ? (
        <div className="flex h-full flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2" style={box({})}>
              <div className="h-full w-8" style={{ background: photo }} />
              <div className="flex-1 space-y-1"><div className="h-1.5 w-3/4 rounded" style={{ background: line }} /><div className="h-1.5 w-1/3 rounded" style={{ background: color }} /></div>
            </div>
          ))}
        </div>
      ) : t === 'foto' ? (
        <div className="flex h-full flex-col gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-1 flex-col" style={box({})}>
              <div className="flex-1" style={{ background: photo }} />
              <div className="flex items-center justify-between p-1"><div className="h-1.5 w-1/2 rounded" style={{ background: line }} /><div className="h-1.5 w-1/5 rounded" style={{ background: color }} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid h-full grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col" style={box(t === 'lembut' ? { padding: 3, boxShadow: '0 1px 4px #0002' } : {})}>
              <div className="flex-1" style={{ background: photo, borderRadius: t === 'lembut' ? 8 : 0 }} />
              <div className="space-y-1 p-1"><div className="h-1.5 w-full rounded" style={{ background: line }} /><div className="h-1.5 w-1/2 rounded" style={{ background: color }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
