import {
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  ClipboardList,
  Coins,
  Ellipsis,
  Gift,
  Languages,
  ListOrdered,
  QrCode,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { Staff } from '@shared/lib/auth'
import { can } from '@shared/types/contracts'

export type NavItem = { to: string; label: string; icon: LucideIcon; show: (s: Staff) => boolean; end?: boolean; hint?: string }

const manage = (s: Staff) => can.manage(s.role)
const owner = (s: Staff) => can.ownerOnly(s.role)

/**
 * Navigasi utama: paling banyak 5 tombol berlabel, sama di semua layar staf.
 * Owner/manager: Jualan · Antrean · Hari Ini · Menu · Lainnya. Kasir: Jualan · Antrean · Dapur. Dapur: tanpa navigasi (satu layar saja).
 */
export const MAIN_NAV: NavItem[] = [
  { to: '/cashier', label: 'Jualan', icon: ShoppingBag, show: (s) => can.floor(s.role) },
  { to: '/antrean', label: 'Antrean', icon: ListOrdered, show: (s) => can.floor(s.role) },
  { to: '/kitchen', label: 'Dapur', icon: ChefHat, show: (s) => can.kitchen(s.role) && !can.manage(s.role) },
  { to: '/admin', label: 'Hari Ini', icon: BarChart3, show: manage, end: true },
  { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, show: manage },
  { to: '/admin/lainnya', label: 'Lainnya', icon: Ellipsis, show: manage },
  { to: '/super', label: 'Kelola toko', icon: Building2, show: (s) => s.isSuper },
]

/** Isi halaman "Lainnya": fitur yang tidak dipakai setiap hari. Maksimal 5 di depan. */
export const MORE_NAV: NavItem[] = [
  { to: '/admin/promo', label: 'Potongan harga', hint: 'Diskon, beli 2 gratis 1, kode kupon', icon: Tag, show: manage },
  { to: '/admin/member', label: 'Pelanggan tetap', hint: 'Kumpulkan poin untuk pembeli langganan', icon: Gift, show: manage },
  { to: '/admin/stok', label: 'Stok bahan', hint: 'Stok bahan, resep, hitung stok', icon: Boxes, show: manage },
  { to: '/admin/pembelian', label: 'Pembelian', hint: 'Daftar belanja, terima barang, utang pemasok', icon: ShoppingCart, show: manage },
  { to: '/admin/tim', label: 'Karyawan', hint: 'Tambah kasir atau tukang masak', icon: Users, show: owner },
  { to: '/admin/toko', label: 'Pengaturan toko', hint: 'Nama, alamat, jam buka, struk', icon: Store, show: owner },
]

/** Fitur lanjutan, disembunyikan di balik "Fitur lanjutan" pada halaman Lainnya. */
export const ADVANCED_NAV: NavItem[] = [
  { to: '/admin/keuangan', label: 'Keuangan & Penarikan', hint: 'Laba bersih, laba kotor, saldo laci & Midtrans', icon: Coins, show: manage },
  { to: '/admin/laporan', label: 'Laporan lengkap', hint: 'Penjualan per hari, per menu, unduh', icon: BarChart3, show: manage },
  { to: '/admin/shift', label: 'Catatan laci kasir', hint: 'Uang laci saat buka dan tutup kasir', icon: ClipboardList, show: manage },
  { to: '/admin/meja', label: 'Meja & kode QR', hint: 'Pembeli pesan sendiri dari meja', icon: QrCode, show: manage },
  { to: '/admin/bahasa', label: 'Bahasa & pesan', hint: 'Pilihan bahasa dan kalimat peringatan', icon: Languages, show: owner },
  { to: '/kitchen', label: 'Layar dapur', hint: 'Daftar pesanan yang harus dimasak', icon: ChefHat, show: (s) => can.kitchen(s.role) },
]

const hit = (item: NavItem, pathname: string) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/'))

/** Halaman yang sedang dibuka: judulnya, dan apakah ia berada di dalam "Lainnya" (untuk tombol Kembali). */
export function findNav(pathname: string): { item: NavItem; inMore: boolean } | null {
  for (const item of [...MORE_NAV, ...ADVANCED_NAV]) if (item.to.startsWith('/admin/') && hit(item, pathname)) return { item, inMore: true }
  for (const item of MAIN_NAV) if (hit(item, pathname)) return { item, inMore: false }
  return null
}

/** Tombol navigasi utama yang menyala: halaman di dalam Lainnya menyalakan "Lainnya". */
export function isActive(item: NavItem, pathname: string, inMore = !!findNav(pathname)?.inMore) {
  if (item.to === '/admin/lainnya') return hit(item, pathname) || inMore
  return hit(item, pathname)
}
