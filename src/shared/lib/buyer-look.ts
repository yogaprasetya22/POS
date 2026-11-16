import { THEMES, swatch, type ThemeKey } from './theme'

/** 10 template halaman pembeli. Warna utama selalu mengikuti warna toko (tab Warna). */
export const BUYER_TEMPLATES = {
  segar: { label: 'Segar', hint: 'Kartu putih bulat, latar berwarna tipis, tombol + di pojok. Gaya aplikasi pesan antar.' },
  ringkas: { label: 'Daftar ringkas', hint: 'Satu menu per baris, foto kecil di kiri, tombol + di kanan. Paling cepat dibaca.' },
  galeri: { label: 'Galeri foto', hint: 'Foto penuh, nama dan harga di atas bayangan gelap. Cocok bila fotonya bagus.' },
  majalah: { label: 'Majalah', hint: 'Menu andalan tampil besar di atas, sisanya kotak 2 kolom. Latar krem.' },
  kertas: { label: 'Menu kertas', hint: 'Tanpa foto, huruf klasik, titik-titik ke harga. Untuk warung tanpa foto menu.' },
  malam: { label: 'Kafe malam', hint: 'Latar gelap, foto bulat, harga menyala dengan warna toko.' },
  bento: { label: 'Bento', hint: 'Kotak kecil 3 kolom, harga di atas foto. Untuk menu yang banyak.' },
  pastel: { label: 'Pastel', hint: 'Foto bulat di tengah kartu berwarna pastel. Gaya kedai minuman kekinian.' },
  label: { label: 'Label harga', hint: 'Kartu foto dengan pita harga berwarna di pojok, huruf tebal.' },
  minimalis: { label: 'Minimalis', hint: 'Tanpa garis dan bayangan, banyak ruang, teks rata tengah.' },
} as const
export type BuyerTemplate = keyof typeof BUYER_TEMPLATES
export const BUYER_TEMPLATE_KEYS = Object.keys(BUYER_TEMPLATES) as BuyerTemplate[]

// pilihan lama (sebelum 10 template) → yang paling mirip
const LEGACY: Record<string, BuyerTemplate> = { klasik: 'segar', daftar: 'ringkas', foto: 'galeri', lembut: 'pastel', gelap: 'malam' }
export const asTemplate = (v: string | null | undefined): BuyerTemplate => {
  if (v && v in BUYER_TEMPLATES) return v as BuyerTemplate
  return (v && LEGACY[v]) || 'segar'
}

/** Susunan daftar menu per template (grid kartu). */
export const GRID: Record<BuyerTemplate, string> = {
  segar: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  ringkas: 'grid gap-0 overflow-hidden rounded-2xl border bg-card md:grid-cols-2 md:gap-x-6 md:border-0 md:bg-transparent',
  galeri: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]',
  majalah: 'grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]',
  kertas: 'mx-auto grid max-w-3xl gap-x-10 md:grid-cols-2',
  malam: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  bento: 'grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]',
  pastel: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  label: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  minimalis: 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
}

/**
 * Pasang warna toko + latar template ke halaman pembeli. Variabel dipasang di <html> supaya panel/drawer (portal) ikut.
 * Mengembalikan fungsi pembersih: tampilan staf di browser yang sama tidak ikut berubah.
 */
export function applyBuyerLook(theme: string | null | undefined, template: BuyerTemplate) {
  const key = (theme && theme in THEMES ? theme : 'biru') as ThemeKey
  const { h, c } = THEMES[key]
  const root = document.documentElement
  const dark = template === 'malam'
  const vars: Record<string, string> = {
    '--primary': dark ? `oklch(0.74 ${c} ${h})` : swatch(key),
    '--primary-foreground': dark ? 'oklch(0.16 0.02 265)' : 'oklch(0.99 0 0)',
    '--ring': swatch(key),
  }
  const bg: Partial<Record<BuyerTemplate, string>> = {
    segar: `oklch(0.965 0.02 ${h})`,
    ringkas: 'oklch(0.975 0.004 265)',
    galeri: 'oklch(0.97 0.005 265)',
    majalah: 'oklch(0.965 0.02 85)',
    kertas: 'oklch(0.955 0.03 85)',
    bento: `oklch(0.975 0.01 ${h})`,
    pastel: `oklch(0.955 0.035 ${h})`,
    label: 'oklch(0.97 0.004 265)',
    minimalis: 'oklch(1 0 0)',
  }
  if (bg[template]) vars['--background'] = bg[template]!
  if (template === 'kertas') {
    vars['--card'] = 'oklch(0.975 0.025 85)'
    vars['--border'] = 'oklch(0.85 0.03 85)'
  }
  if (dark) {
    vars['--background'] = 'oklch(0.17 0.012 265)'
    vars['--card'] = 'oklch(0.23 0.014 265)'
    vars['--popover'] = 'oklch(0.23 0.014 265)'
  }
  const before = new Map(Object.keys(vars).map((k) => [k, root.style.getPropertyValue(k)]))
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  root.classList.toggle('dark', dark)
  return () => {
    root.classList.remove('dark')
    for (const [k, v] of before) {
      if (v) root.style.setProperty(k, v)
      else root.style.removeProperty(k)
    }
  }
}
