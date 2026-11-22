import { useEffect } from 'react'
import { supabase } from './supabase'
import { applyTheme } from './theme'

/** Warna halaman publik (landing, masuk, daftar) yang ditentukan super admin. */
const CACHE = 'pos_landing_theme'

const cached = () => {
  try {
    return localStorage.getItem(CACHE)
  } catch {
    return null
  }
}

export async function fetchLandingTheme(): Promise<string> {
  const { data } = await supabase.from('platform_settings').select('landing_theme').eq('id', 1).maybeSingle()
  const t = (data as { landing_theme?: string } | null)?.landing_theme ?? 'biru'
  try {
    localStorage.setItem(CACHE, t)
  } catch {
    /* abaikan */
  }
  return t
}

/** Pasang warna landing di halaman publik. Warna toko tersimpan tidak ikut tertimpa. */
export function useLandingTheme() {
  useEffect(() => {
    applyTheme(cached() ?? 'biru', { persist: false }) // langsung, tanpa menunggu jaringan
    void fetchLandingTheme().then((t) => applyTheme(t, { persist: false }))
  }, [])
}
