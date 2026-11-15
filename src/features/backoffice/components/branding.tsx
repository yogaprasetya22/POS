import { Check, ImagePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import { rpc } from '@shared/lib/api'
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
