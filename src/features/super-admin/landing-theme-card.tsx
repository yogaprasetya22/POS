import { Check, ExternalLink, Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@shared/components/ui/card'
import { rpc } from '@shared/lib/api'
import { fetchLandingTheme } from '@shared/lib/landing-theme'
import { THEMES, THEME_KEYS, swatch, type ThemeKey } from '@shared/lib/theme'

/** Super admin memilih warna halaman publik: landing page, halaman masuk & daftar. */
export function LandingThemeCard() {
  const [current, setCurrent] = useState<string | null>(null)
  const [saving, setSaving] = useState<ThemeKey | null>(null)

  useEffect(() => {
    void fetchLandingTheme().then(setCurrent)
  }, [])

  const pick = async (k: ThemeKey) => {
    if (k === current) return
    setSaving(k)
    const { error } = await rpc('set_landing_theme', { p_theme: k })
    setSaving(null)
    if (error) return toast.error('Warna belum tersimpan', { description: error.message })
    setCurrent(k)
    try {
      localStorage.setItem('pos_landing_theme', k)
    } catch {
      /* abaikan */
    }
    toast.success(`Warna landing page: ${THEMES[k].label}`, { description: 'Berlaku untuk semua pengunjung halaman depan, masuk, dan daftar.' })
  }

  return (
    <Card className="gap-3 rounded-2xl border p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold"><Palette className="size-5 text-primary" /> Warna landing page</h2>
          <p className="text-sm text-muted-foreground">Dipakai di halaman depan, masuk, dan daftar. Setelah login, aplikasi tetap memakai warna masing-masing toko.</p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Lihat landing <ExternalLink className="size-3.5" />
        </a>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Warna landing page">
        {THEME_KEYS.map((k) => {
          const on = current === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={saving !== null}
              onClick={() => void pick(k)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-colors disabled:opacity-60 ${on ? 'border-foreground' : 'border-transparent hover:bg-muted'}`}
            >
              <span className="grid size-10 place-items-center rounded-full text-white" style={{ background: swatch(k) }}>
                {on && <Check className="size-5" />}
                {saving === k && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              </span>
              <span className="text-xs font-semibold">{THEMES[k].label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
