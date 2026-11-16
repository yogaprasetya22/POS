import { ChevronDown, ChevronRight, ExternalLink, LogOut } from 'lucide-react'
import { Link } from 'react-router'
import { ADVANCED_NAV, MORE_NAV, type NavItem } from '@shared/components/layout/nav'
import { useStaff } from '@shared/lib/auth'
import { useLowStockCount } from '@shared/lib/low-stock-alerts'
import { useStoreConfig } from '@shared/lib/store-config'
import { supabase } from '@shared/lib/supabase'

function Row({ item }: { item: NavItem }) {
  const Icon = item.icon
  const low = useLowStockCount()
  const badge = item.to === '/admin/stok' ? low : 0
  return (
    <Link to={item.to} className="flex min-h-20 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-7" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg font-bold">{item.label}</span>
        {item.hint && <span className="text-base text-muted-foreground">{item.hint}</span>}
        {badge > 0 && <span className="mt-1 w-fit rounded-full bg-red-600 px-3 py-0.5 text-base font-extrabold text-white">{badge} bahan hampir habis</span>}
      </span>
      <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}

/** Kartu besar untuk layar tablet/desktop: ikon, judul, keterangan, dan tanda angka bila ada yang perlu dicek. */
function Tile({ item }: { item: NavItem }) {
  const Icon = item.icon
  const low = useLowStockCount()
  const badge = item.to === '/admin/stok' ? low : 0
  return (
    <Link to={item.to} className="group relative flex min-h-36 flex-col gap-3 rounded-2xl border-2 bg-card p-5 transition-colors hover:border-primary hover:bg-primary/5">
      <span className="flex items-start justify-between gap-2">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-8" aria-hidden />
        </span>
        {badge > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-base font-extrabold text-white">{badge} hampir habis</span>}
      </span>
      <span>
        <span className="flex items-center gap-1 text-xl font-bold">
          {item.label} <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
        {item.hint && <span className="mt-0.5 block text-base text-muted-foreground">{item.hint}</span>}
      </span>
    </Link>
  )
}

/** Pengelompokan menu Lainnya supaya mudah dicari: 3 kelompok, masing-masing 1–2 pilihan. */
const GROUPS: { title: string; hint: string; paths: string[] }[] = [
  { title: 'Stok & belanja', hint: 'Bahan, resep, dan belanja ke pemasok', paths: ['/admin/stok', '/admin/pembelian'] },
  { title: 'Pembeli', hint: 'Promo dan pelanggan langganan', paths: ['/admin/promo', '/admin/member'] },
  { title: 'Toko & karyawan', hint: 'Siapa yang bekerja dan pengaturan toko', paths: ['/admin/tim', '/admin/toko'] },
]

/** Halaman "Lainnya": fitur yang jarang dipakai, dikelompokkan. HP: daftar; tablet & desktop: kartu besar. Sisanya di "Fitur lanjutan". */
export function MorePageView() {
  const staff = useStaff()
  const { config } = useStoreConfig(staff.storeId)
  const main = MORE_NAV.filter((i) => i.show(staff))
  const advanced = ADVANCED_NAV.filter((i) => i.show(staff) && !(config?.use_kitchen_screen === false && i.to === '/kitchen'))
  const groups = GROUPS.map((g) => ({ ...g, items: g.paths.map((p) => main.find((i) => i.to === p)).filter((i): i is NavItem => !!i) })).filter((g) => g.items.length)
  // menu baru yang belum dikelompokkan tetap tampil
  const loose = main.filter((i) => !GROUPS.some((g) => g.paths.includes(i.to)))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Lainnya</h1>
        <p className="mt-1 text-lg text-muted-foreground">Fitur tambahan. Tidak perlu dipakai setiap hari. Pilih yang ingin dibuka.</p>
      </div>

      {[...groups, ...(loose.length ? [{ title: 'Lainnya', hint: '', paths: [], items: loose }] : [])].map((g) => (
        <section key={g.title} className="space-y-2.5">
          <div>
            <h2 className="text-xl font-bold">{g.title}</h2>
            {g.hint && <p className="text-base text-muted-foreground">{g.hint}</p>}
          </div>
          {/* HP: daftar baris */}
          <div className="divide-y overflow-hidden rounded-2xl border-2 bg-card md:hidden">
            {g.items.map((item) => <Row key={item.to} item={item} />)}
          </div>
          {/* Tablet & desktop: kartu besar berdampingan */}
          <div className="hidden gap-4 md:grid md:grid-cols-2">
            {g.items.map((item) => <Tile key={item.to} item={item} />)}
          </div>
        </section>
      ))}

      {advanced.length > 0 && (
        <details className="group overflow-hidden rounded-2xl border-2 bg-card">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
            <span className="flex-1">Fitur lanjutan</span>
            <span className="text-base font-semibold text-muted-foreground group-open:hidden">Tampilkan</span>
            <span className="hidden text-base font-semibold text-muted-foreground group-open:inline">Sembunyikan</span>
            <ChevronDown className="size-6 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="divide-y border-t md:grid md:grid-cols-2 md:divide-y-0 md:gap-px md:bg-border">
            {advanced.map((item) => (
              <div key={item.to} className="bg-card"><Row item={item} /></div>
            ))}
          </div>
        </details>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {config?.slug && (
          <a
            href={`/s/${config.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 bg-card px-4 text-base font-bold hover:bg-muted"
          >
            <ExternalLink className="size-5" aria-hidden /> Lihat halaman pembeli
          </a>
        )}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 bg-card px-4 text-base font-bold hover:bg-muted"
        >
          <LogOut className="size-5" aria-hidden /> Keluar dari akun
        </button>
      </div>
    </div>
  )
}
