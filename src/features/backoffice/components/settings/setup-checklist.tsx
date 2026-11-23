import { CheckCircle2, ChevronRight, Circle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from 'motion/react'
import { Link } from 'react-router'
import { Collapse, appear } from '@shared/components/motion'
import { liquid, liquidSoft } from '@shared/lib/motion'
import { Button } from '@shared/components/ui/button'
import { useStaff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import { can, type Product, type Store } from '@shared/types/contracts'
import { StarterMenuPicker } from '../menu/starter-menu-picker'

type Step = { key: string; title: string; hint: string; to: string; action: string; done: boolean }

const hideKey = (storeId: string) => `setup-hidden:${storeId}`
const readHidden = (storeId: string) => {
  try {
    return localStorage.getItem(hideKey(storeId)) === '1'
  } catch {
    return false
  }
}

/**
 * Kartu "Langkah awal" di halaman Hari Ini: memandu owner baru dari toko kosong sampai jualan pertama.
 * Setiap langkah dicek dari data nyata, jadi tercentang sendiri. Hilang otomatis bila semua selesai.
 */
export function SetupChecklist({ store, products, onSeeded }: { store: Store; products: Product[]; onSeeded: () => void }) {
  const { role, storeId } = useStaff()
  const [counts, setCounts] = useState<{ tables: number; staff: number; sold: number } | null>(null)
  const [hidden, setHidden] = useState(() => (storeId ? readHidden(storeId) : false))

  useEffect(() => {
    if (!storeId) return
    let alive = true
    const head = { count: 'exact' as const, head: true }
    void Promise.all([
      supabase.from('store_tables').select('id', head),
      supabase.from('profiles').select('user_id', head).eq('store_id', storeId),
      supabase.from('orders').select('id', head).not('paid_at', 'is', null),
    ]).then(([t, s, o]) => alive && setCounts({ tables: t.count ?? 0, staff: s.count ?? 0, sold: o.count ?? 0 }))
    return () => {
      alive = false
    }
  }, [storeId])

  if (!storeId || !counts || hidden) return null

  const steps: Step[] = [
    { key: 'menu', title: 'Isi daftar menu', hint: 'Pakai menu contoh, lalu ubah nama dan harganya.', to: '/admin/menu', action: 'Buka menu', done: products.length > 0 },
    { key: 'toko', title: 'Lengkapi info toko', hint: 'Logo dan keterangan singkat, tampil di struk dan halaman pembeli.', to: '/admin/toko', action: 'Atur toko', done: !!(store.logo_url || store.tagline) },
    { key: 'meja', title: 'Cetak QR meja (boleh dilewati)', hint: 'Pembeli bisa pesan sendiri dari HP-nya.', to: '/admin/meja', action: 'Atur meja', done: counts.tables > 0 },
    ...(can.ownerOnly(role) ? [{ key: 'tim', title: 'Tambah kasir atau tukang masak', hint: 'Setiap orang punya akun sendiri, jadi tercatat siapa yang jualan.', to: '/admin/tim', action: 'Tambah', done: counts.staff > 1 }] : []),
    { key: 'jual', title: 'Coba jualan pertama', hint: 'Buka kasir, pilih menu, terima uang. Selesai!', to: '/cashier', action: 'Mulai jualan', done: counts.sold > 0 },
  ]
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null
  const next = steps.find((s) => !s.done)!

  const hide = () => {
    try {
      localStorage.setItem(hideKey(storeId), '1')
    } catch {
      /* tanpa penyimpanan: cukup sembunyikan untuk sesi ini */
    }
    setHidden(true)
  }

  return (
    <m.section {...appear()} className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl"> Langkah awal
          </h2>
          <p className="mt-1 text-base text-foreground/80">
            {done} dari {steps.length} selesai. Ikuti urutan ini supaya toko siap dipakai.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-10 text-base" onClick={hide} aria-label="Sembunyikan langkah awal">
          <X /> Sembunyikan
        </Button>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary/15">
        {/* scaleX (bukan width) supaya animasi hanya di GPU */}
        <m.div className="h-full origin-left rounded-full bg-primary" initial={{ scaleX: 0 }} animate={{ scaleX: done / steps.length }} transition={liquidSoft} />
      </div>

      <ol className="mt-4 grid gap-2">
        {steps.map((s, i) => {
          const current = s.key === next.key
          return (
            <m.li key={s.key} {...appear(i + 1)} layout="position" className={`rounded-2xl border-2 bg-card p-3 transition-colors sm:p-4 ${current ? 'border-primary' : 'border-transparent'}`}>
              <div className="flex items-center gap-3">
                <m.span key={String(s.done)} initial={{ scale: 0.5, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={liquid} className="inline-flex shrink-0">
                  {s.done ? <CheckCircle2 className="size-7 text-emerald-600" /> : <Circle className="size-7 text-muted-foreground" />}
                </m.span>
                <div className="min-w-0 flex-1">
                  <p className={`text-base font-bold sm:text-lg ${s.done ? 'text-muted-foreground line-through' : ''}`}>
                    {i + 1}. {s.title}
                  </p>
                  {!s.done && <p className="text-sm text-foreground/75 sm:text-base">{s.hint}</p>}
                </div>
                {!s.done && (
                  <Link to={s.to} className={`inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-4 text-base font-semibold ${current ? 'bg-primary text-primary-foreground' : 'border-2 bg-background'}`}>
                    {s.action} <ChevronRight className="size-4" />
                  </Link>
                )}
              </div>
              <Collapse open={s.key === 'menu' && !s.done}>
                <div className="mt-3 border-t pt-3">
                  <StarterMenuPicker onDone={onSeeded} />
                </div>
              </Collapse>
            </m.li>
          )
        })}
      </ol>
    </m.section>
  )
}
