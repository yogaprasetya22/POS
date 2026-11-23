import { THEMES, swatch, type ThemeKey } from './theme'

/** 20 template halaman pembeli. Warna utama selalu mengikuti warna toko (tab Warna). */
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
  kaca: { label: 'Kaca', hint: 'Glassmorphism: kartu bening buram di atas latar gradien warna toko. Modern dan lembut.' },
  neo: { label: 'Neo brutal', hint: 'Garis hitam tebal, bayangan kotak, warna berani. Gaya kekinian yang mencolok.' },
  reel: { label: 'Reel video', hint: 'Kartu tegak seperti Reels/TikTok. Video menu diputar otomatis tanpa suara.' },
  polaroid: { label: 'Polaroid', hint: 'Foto berbingkai putih sedikit miring, tulisan tangan. Hangat dan playful.' },
  aurora: { label: 'Aurora', hint: 'Latar gradien berpendar, kartu putih melayang dengan sudut sangat bulat.' },
  mewah: { label: 'Mewah', hint: 'Hitam pekat dengan aksen emas dan huruf serif. Untuk fine dining dan kopi spesialti.' },
  sinema: { label: 'Sinema', hint: 'Satu menu per baris, foto lebar 16:9 seperti poster film. Foto jadi bintangnya.' },
  retro: { label: 'Retro', hint: 'Warna hangat 70-an, sudut bulat besar, huruf tebal membulat.' },
  split: { label: 'Split', hint: 'Foto besar di kiri, detail di kanan. Nyaman di tablet dan layar lebar.' },
  swiss: { label: 'Swiss', hint: 'Grid tegas, huruf besar, nomor urut, tanpa hiasan. Bersih ala desain Swiss.' },
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
  kaca: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  neo: 'grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  reel: 'grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]',
  polaroid: 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  aurora: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  mewah: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  sinema: 'mx-auto grid max-w-3xl gap-5',
  retro: 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  split: 'grid gap-3 lg:grid-cols-2',
  swiss: 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-4',
}

/** Template berlatar gelap */
export const DARK_TEMPLATES: BuyerTemplate[] = ['malam', 'mewah']

/**
 * Pasang warna toko + latar template ke halaman pembeli. Variabel dipasang di <html> supaya panel/drawer (portal) ikut.
 * Mengembalikan fungsi pembersih: tampilan staf di browser yang sama tidak ikut berubah.
 */
export function applyBuyerLook(theme: string | null | undefined, template: BuyerTemplate) {
  const key = (theme && theme in THEMES ? theme : 'biru') as ThemeKey
  const { h, c } = THEMES[key]
  const root = document.documentElement
  const dark = DARK_TEMPLATES.includes(template)
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
    kaca: `oklch(0.93 0.05 ${h})`,
    neo: 'oklch(0.97 0.03 95)',
    reel: 'oklch(0.97 0.004 265)',
    polaroid: 'oklch(0.95 0.015 70)',
    aurora: `oklch(0.96 0.03 ${h})`,
    sinema: 'oklch(0.97 0.004 265)',
    retro: 'oklch(0.94 0.045 70)',
    split: 'oklch(0.975 0.006 265)',
    swiss: 'oklch(0.99 0 0)',
  }
  if (bg[template]) vars['--background'] = bg[template]!
  if (template === 'kertas') {
    vars['--card'] = 'oklch(0.975 0.025 85)'
    vars['--border'] = 'oklch(0.85 0.03 85)'
  }
  if (template === 'mewah') {
    vars['--primary'] = 'oklch(0.8 0.12 85)' // emas
    vars['--ring'] = 'oklch(0.8 0.12 85)'
  }
  if (!dark && vars['--background']) {
    // panel/sheet (pesanan, detail) & elemen abu-abu ikut nada tema, bukan putih/abu netral
    vars['--popover'] = `color-mix(in oklch, ${vars['--background']} 55%, white)`
    for (const k of ['--muted', '--secondary', '--accent']) vars[k] = `color-mix(in oklch, ${vars['--background']} 88%, ${vars['--primary']})`
  }
  if (dark) {
    vars['--background'] = template === 'mewah' ? 'oklch(0.13 0.005 85)' : 'oklch(0.17 0.012 265)'
    vars['--card'] = template === 'mewah' ? 'oklch(0.19 0.008 85)' : 'oklch(0.23 0.014 265)'
    vars['--popover'] = vars['--card']
  }
  const before = new Map(Object.keys(vars).map((k) => [k, root.style.getPropertyValue(k)]))
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  root.classList.toggle('dark', dark)
  // latar gradien berpendar untuk Kaca & Aurora (dipasang di body, dibersihkan saat keluar)
  const glow: Partial<Record<BuyerTemplate, string>> = {
    kaca: `radial-gradient(at 10% 0%, oklch(0.78 0.14 ${h} / 0.55), transparent 55%), radial-gradient(at 90% 20%, oklch(0.8 0.12 ${(h + 60) % 360} / 0.45), transparent 50%), radial-gradient(at 50% 100%, oklch(0.82 0.1 ${(h + 300) % 360} / 0.45), transparent 55%)`,
    aurora: `radial-gradient(at 0% 0%, oklch(0.85 0.12 ${(h + 40) % 360} / 0.6), transparent 45%), radial-gradient(at 100% 10%, oklch(0.82 0.13 ${h} / 0.55), transparent 45%), radial-gradient(at 60% 90%, oklch(0.88 0.1 ${(h + 200) % 360} / 0.5), transparent 50%)`,
  }
  const bodyBefore = document.body.style.backgroundImage
  const attachBefore = document.body.style.backgroundAttachment
  if (glow[template]) {
    document.body.style.backgroundImage = glow[template]!
    document.body.style.backgroundAttachment = 'fixed'
  }
  return () => {
    document.body.style.backgroundImage = bodyBefore
    document.body.style.backgroundAttachment = attachBefore
    root.classList.remove('dark')
    for (const [k, v] of before) {
      if (v) root.style.setProperty(k, v)
      else root.style.removeProperty(k)
    }
  }
}
