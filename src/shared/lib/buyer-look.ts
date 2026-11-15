import { THEMES, swatch, type ThemeKey } from './theme'

/** Template tampilan halaman pembeli. Warna utamanya mengikuti warna toko. */
export const BUYER_TEMPLATES = {
  klasik: { label: 'Klasik', hint: 'Kotak-kotak dengan foto di atas. Rapi untuk semua jenis menu.' },
  daftar: { label: 'Daftar', hint: 'Foto kecil di kiri, nama dan harga di kanan. Cepat dibaca, hemat kuota.' },
  foto: { label: 'Foto besar', hint: 'Satu menu per baris dengan foto lebar. Cocok bila fotonya bagus.' },
  lembut: { label: 'Lembut', hint: 'Sudut bulat, latar berwarna tipis sesuai warna toko. Terasa ramah.' },
  gelap: { label: 'Gelap', hint: 'Latar gelap, foto makanan lebih menonjol. Cocok untuk kafe malam.' },
} as const
export type BuyerTemplate = keyof typeof BUYER_TEMPLATES
export const BUYER_TEMPLATE_KEYS = Object.keys(BUYER_TEMPLATES) as BuyerTemplate[]
export const asTemplate = (v: string | null | undefined): BuyerTemplate => (v && v in BUYER_TEMPLATES ? (v as BuyerTemplate) : 'klasik')

/** Kelas susunan kartu menu per template. */
export const LAYOUT: Record<BuyerTemplate, { grid: string; card: string; image: string; aspect: string; body: string; name: string; price: string }> = {
  klasik: { grid: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]', card: 'flex-col rounded-lg border bg-card', image: 'w-full', aspect: 'aspect-4/3', body: 'w-full space-y-1 p-3', name: 'line-clamp-2 min-h-10 text-base font-medium leading-5', price: 'text-base font-semibold' },
  daftar: { grid: 'grid gap-2 md:grid-cols-2', card: 'flex-row items-center rounded-xl border bg-card', image: 'w-28 shrink-0', aspect: 'aspect-square', body: 'min-w-0 flex-1 space-y-1 p-3', name: 'line-clamp-2 text-base font-semibold leading-5', price: 'text-lg font-bold' },
  foto: { grid: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3', card: 'flex-col rounded-2xl border bg-card', image: 'w-full', aspect: 'aspect-video', body: 'flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-4', name: 'text-lg font-bold leading-6', price: 'text-lg font-extrabold text-primary' },
  lembut: { grid: 'grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]', card: 'flex-col rounded-3xl bg-card p-2 shadow-md', image: 'w-full overflow-hidden rounded-2xl', aspect: 'aspect-square', body: 'w-full space-y-1 px-2 pb-2 pt-3', name: 'line-clamp-2 min-h-10 text-base font-semibold leading-5', price: 'text-base font-extrabold text-primary' },
  gelap: { grid: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]', card: 'flex-col rounded-xl border bg-card', image: 'w-full', aspect: 'aspect-4/3', body: 'w-full space-y-1 p-3', name: 'line-clamp-2 min-h-10 text-base font-medium leading-5', price: 'text-base font-bold text-primary' },
}

/**
 * Pasang warna toko + template ke halaman pembeli. Variabel dipasang di <html> supaya panel/drawer (portal) ikut.
 * Mengembalikan fungsi pembersih: tampilan staf di browser yang sama tidak ikut berubah.
 */
export function applyBuyerLook(theme: string | null | undefined, template: BuyerTemplate) {
  const key = (theme && theme in THEMES ? theme : 'biru') as ThemeKey
  const { h, c } = THEMES[key]
  const root = document.documentElement
  const dark = template === 'gelap'
  const vars: Record<string, string> = {
    '--primary': dark ? `oklch(0.72 ${c} ${h})` : swatch(key),
    '--primary-foreground': dark ? 'oklch(0.16 0.02 265)' : 'oklch(0.99 0 0)',
    '--ring': swatch(key),
  }
  if (template === 'lembut') {
    vars['--background'] = `oklch(0.96 0.03 ${h})`
    vars['--muted'] = `oklch(0.93 0.035 ${h})`
    vars['--border'] = `oklch(0.9 0.035 ${h})`
  }
  if (dark) {
    vars['--background'] = 'oklch(0.17 0.01 265)'
    vars['--card'] = 'oklch(0.23 0.012 265)'
    vars['--popover'] = 'oklch(0.23 0.012 265)'
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
