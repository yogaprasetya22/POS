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
      </span>
      {badge > 0 && <span className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-base font-extrabold text-white">{badge} hampir habis</span>}
      <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}

/** Halaman "Lainnya": fitur yang jarang dipakai. 5 pilihan di depan, sisanya di "Fitur lanjutan" yang tertutup. */
export function MorePageView() {
  const staff = useStaff()
  const { config } = useStoreConfig(staff.storeId)
  const main = MORE_NAV.filter((i) => i.show(staff))
  const advanced = ADVANCED_NAV.filter((i) => i.show(staff) && !(config?.use_kitchen_screen === false && i.to === '/kitchen'))

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Lainnya</h1>
        <p className="mt-1 text-lg text-muted-foreground">Fitur tambahan. Tidak perlu dipakai setiap hari.</p>
      </div>

      <div className="divide-y overflow-hidden rounded-2xl border-2 bg-card">
        {main.map((item) => (
          <Row key={item.to} item={item} />
        ))}
      </div>

      {advanced.length > 0 && (
        <details className="group overflow-hidden rounded-2xl border-2 bg-card">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
            <span className="flex-1">Fitur lanjutan</span>
            <span className="text-base font-semibold text-muted-foreground group-open:hidden">Tampilkan</span>
            <span className="hidden text-base font-semibold text-muted-foreground group-open:inline">Sembunyikan</span>
            <ChevronDown className="size-6 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="divide-y border-t">
            {advanced.map((item) => (
              <Row key={item.to} item={item} />
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
