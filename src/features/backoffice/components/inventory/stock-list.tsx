import { Barcode as BarcodeIcon, ChevronDown, PackageMinus, PackagePlus, Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '@shared/components/pagination'
import { RowsSkeleton } from '@shared/components/skeletons'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { rupiah } from '@shared/lib/utils'
import { LEVEL, fmtQty, levelOf, type Barcode, type Ingredient, type Level } from './data'

type Filter = 'all' | Level

/** Tab Inventory Stock: ringkasan, cari & saring status, dan aksi per bahan. */
export function StockList({
  items,
  barcodes,
  loaded,
  onBuy,
  onWaste,
  onEdit,
  onNew,
}: {
  items: Ingredient[]
  barcodes: Barcode[]
  loaded: boolean
  onBuy: (id?: string) => void
  onWaste: (i: Ingredient) => void
  onEdit: (i: Ingredient) => void
  onNew: () => void
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const active = items.filter((i) => i.is_active)
  const count = (l: Level) => active.filter((i) => levelOf(i) === l).length
  const value = active.reduce((n, i) => n + Math.max(i.stock, 0) * i.cost, 0)
  const term = q.trim().toLowerCase()
  const codesOf = (id: string) => barcodes.filter((b) => b.ingredient_id === id).length
  const shown = active
    .filter((i) => (filter === 'all' || levelOf(i) === filter) && (!term || i.name.toLowerCase().includes(term)))
    // yang perlu perhatian di atas: habis, hampir habis, lalu aman
    .sort((a, b) => ['out', 'low', 'ok'].indexOf(levelOf(a)) - ['out', 'low', 'ok'].indexOf(levelOf(b)) || a.name.localeCompare(b.name))
  // "Tampilkan lebih banyak": lebih mudah dari nomor halaman, dan daftar tetap terbuka setelah mengubah bahan
  const STEP = 24
  const [limit, setLimit] = useState(STEP)
  useEffect(() => setLimit(STEP), [filter, term])
  const rows = shown.slice(0, limit)
  const left = shown.length - rows.length

  const tiles: { key: Filter; label: string; value: string; tone: string }[] = [
    { key: 'all', label: 'Semua bahan', value: String(active.length), tone: '' },
    { key: 'low', label: 'Hampir habis', value: String(count('low')), tone: 'text-amber-700 dark:text-amber-400' },
    { key: 'out', label: 'Habis', value: String(count('out')), tone: 'text-red-700 dark:text-red-400' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={filter === t.key}
            onClick={() => setFilter(filter === t.key && t.key !== 'all' ? 'all' : t.key)}
            className={`rounded-2xl border-2 bg-card px-4 py-3 text-left transition-colors ${filter === t.key ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
          >
            <span className="block text-base font-semibold text-muted-foreground">{t.label}</span>
            <span className={`block text-3xl font-extrabold tabular-nums ${t.tone}`}>{t.value}</span>
          </button>
        ))}
        <div className="rounded-2xl border-2 bg-card px-4 py-3">
          <span className="block text-base font-semibold text-muted-foreground">Nilai stok</span>
          <span className="block text-2xl font-extrabold tabular-nums">{rupiah(Math.round(value))}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bahan…" aria-label="Cari bahan" className="h-12 pl-11 text-base" />
        </div>
        <Button variant="outline" className="h-12 border-2 px-4 text-base" onClick={onNew}>
          <Plus /> Bahan baru
        </Button>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((i) => {
          const lv = LEVEL[levelOf(i)]
          const n = codesOf(i.id)
          return (
            <li key={i.id} className="space-y-3 rounded-2xl border-2 bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
                    <span className="truncate">{i.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${lv.pill}`}>{lv.label}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Minimum {fmtQty(i.min_stock)} {i.unit} · {rupiah(i.cost)}/{i.unit}
                    {n > 0 && (
                      <span className="ml-1 inline-flex items-center gap-1">
                        · <BarcodeIcon className="size-3.5" aria-hidden /> {n} barcode
                      </span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-2xl font-extrabold tabular-nums">{fmtQty(i.stock)}</span>
                  <span className="block text-sm text-muted-foreground">{i.unit}</span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-11 border-2 text-base" aria-label={`Barang masuk ${i.name}`} onClick={() => onBuy(i.id)}><PackagePlus /> Masuk</Button>
                <Button variant="outline" className="h-11 border-2 text-base" aria-label={`Catat terbuang ${i.name}`} disabled={i.stock <= 0} onClick={() => onWaste(i)}><PackageMinus /> Terbuang</Button>
                <Button variant="outline" className="h-11 border-2 text-base" aria-label={`Ubah ${i.name}`} onClick={() => onEdit(i)}><Pencil /> Ubah</Button>
              </div>
            </li>
          )
        })}
      </ul>
      {!loaded && <RowsSkeleton rows={6} />}
      {loaded && shown.length === 0 && (
        <EmptyState
          title={active.length === 0 ? 'Belum ada bahan' : 'Tidak ada bahan yang cocok'}
          hint={active.length === 0 ? 'Tambahkan bahan satu per satu lewat “Bahan baru”, atau sekaligus lewat “Import Excel”.' : 'Coba kata lain atau pilih “Semua bahan”.'}
        />
      )}
      {left > 0 && (
        <div className="space-y-2 text-center">
          <p className="text-base text-muted-foreground">Menampilkan {rows.length} dari {shown.length} bahan</p>
          <Button variant="outline" className="h-14 w-full border-2 text-lg font-bold sm:w-auto sm:px-10" onClick={() => setLimit((n) => n + STEP)}>
            <ChevronDown /> Tampilkan {Math.min(STEP, left)} bahan lagi{left > STEP ? ` (sisa ${left})` : ''}
          </Button>
        </div>
      )}
    </div>
  )
}
