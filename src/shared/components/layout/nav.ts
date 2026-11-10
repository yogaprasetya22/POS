import {
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  ClipboardList,
  Gift,
  Languages,
  LayoutDashboard,
  QrCode,
  Settings,
  ShoppingBag,
  Tag,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { Staff } from '@shared/lib/auth'
import { can } from '@shared/types/contracts'

export type NavItem = { to: string; label: string; icon: LucideIcon; show: (s: Staff) => boolean; end?: boolean }
export type NavGroup = { label: string; items: NavItem[] }

const manage = (s: Staff) => can.manage(s.role)
const owner = (s: Staff) => can.ownerOnly(s.role)

/** Mode kerja layar penuh (tanpa sidebar): dipakai kasir & dapur sepanjang shift. */
export const WORK_NAV: NavItem[] = [
  { to: '/cashier', label: 'Kasir', icon: ShoppingBag, show: (s) => can.floor(s.role) },
  { to: '/kitchen', label: 'Dapur', icon: ChefHat, show: (s) => can.kitchen(s.role) },
]

/** Back office: dikelompokkan menurut tugas, satu halaman (route) per fitur. */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Ringkasan',
    items: [{ to: '/admin', label: 'Ikhtisar', icon: LayoutDashboard, show: manage, end: true }],
  },
  {
    label: 'Katalog',
    items: [
      { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, show: manage },
      { to: '/admin/promo', label: 'Promo & diskon', icon: Tag, show: manage },
    ],
  },
  {
    label: 'Pelanggan',
    items: [{ to: '/admin/member', label: 'Member & voucher', icon: Gift, show: manage }],
  },
  {
    label: 'Persediaan',
    items: [{ to: '/admin/stok', label: 'Stok & resep', icon: Boxes, show: manage }],
  },
  {
    label: 'Laporan',
    items: [
      { to: '/admin/laporan', label: 'Penjualan', icon: BarChart3, show: manage },
      { to: '/admin/shift', label: 'Shift & audit', icon: ClipboardList, show: manage },
    ],
  },
  {
    label: 'Toko',
    items: [
      { to: '/admin/meja', label: 'Meja & QR', icon: QrCode, show: manage },
      { to: '/admin/tim', label: 'Tim & peran', icon: Users, show: owner },
      { to: '/admin/toko', label: 'Pengaturan', icon: Settings, show: owner },
      { to: '/admin/bahasa', label: 'Bahasa & pesan', icon: Languages, show: owner },
    ],
  },
  {
    label: 'Platform',
    items: [{ to: '/super', label: 'Kelola toko', icon: Building2, show: (s) => s.isSuper }],
  },
]

/** Grup + item yang cocok dengan path (untuk breadcrumb). */
export function findNav(pathname: string): { group: string; item: NavItem } | null {
  let best: { group: string; item: NavItem } | null = null
  for (const g of ADMIN_NAV)
    for (const item of g.items) {
      const hit = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')
      if (hit && (!best || item.to.length > best.item.to.length)) best = { group: g.label, item }
    }
  return best
}
