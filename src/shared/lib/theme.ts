/** Warna utama aplikasi per toko. Hanya pilihan siap pakai, supaya teks tetap terbaca di atas warna. */
export const THEMES = {
  biru: { label: 'Biru', h: 264, c: 0.19 },
  tosca: { label: 'Tosca', h: 195, c: 0.12 },
  hijau: { label: 'Hijau', h: 150, c: 0.15 },
  oranye: { label: 'Oranye', h: 45, c: 0.17 },
  merah: { label: 'Merah', h: 25, c: 0.2 },
  pink: { label: 'Pink', h: 355, c: 0.19 },
  ungu: { label: 'Ungu', h: 300, c: 0.18 },
  coklat: { label: 'Coklat', h: 55, c: 0.09 },
} as const
export type ThemeKey = keyof typeof THEMES
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

/** Warna tombol utama (dipakai juga untuk contoh di pemilih warna). */
export const swatch = (k: ThemeKey) => `oklch(0.58 ${THEMES[k].c} ${THEMES[k].h})`

const KEY = 'pos_theme'

/** Pasang warna ke variabel CSS; disimpan di browser supaya halaman berikutnya langsung berwarna benar. */
export function applyTheme(k: string | null | undefined) {
  const key = (k && k in THEMES ? k : 'biru') as ThemeKey
  const { h, c } = THEMES[key]
  const s = document.documentElement.style
  const main = swatch(key)
  for (const v of ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring', '--chart-1']) s.setProperty(v, main)
  for (const v of ['--secondary', '--accent', '--sidebar-accent']) s.setProperty(v, `oklch(0.95 0.03 ${h})`)
  for (const v of ['--secondary-foreground', '--accent-foreground', '--sidebar-accent-foreground']) s.setProperty(v, `oklch(0.42 ${c} ${h})`)
  try {
    localStorage.setItem(KEY, key)
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

/** Dipanggil sekali saat aplikasi dibuka. */
export function applySavedTheme() {
  try {
    const k = localStorage.getItem(KEY)
    if (k) applyTheme(k)
  } catch {
    /* abaikan */
  }
}
