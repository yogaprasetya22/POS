import { ClipboardCheck, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import { BarcodeField, UnknownBarcode } from './barcode'
import { fmtQty, onlyNum, packQty, type Barcode, type Ingredient } from './data'

/**
 * Tab Stock Opname ("hitung stok di rak"). Hanya bahan yang diisi yang dihitung.
 * Angka catatan sengaja tidak ditampilkan saat menghitung (mencegah menyalin angka); baru muncul di pratinjau.
 */
export function StockOpname({ items, barcodes, storeId, onDone, onNeedNewIngredient }: { items: Ingredient[]; barcodes: Barcode[]; storeId: string; onDone: () => void; onNeedNewIngredient: (code: string) => void }) {
  const active = items.filter((i) => i.is_active)
  const byId = new Map(items.map((i) => [i.id, i]))
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState(false)
  const [unknown, setUnknown] = useState<string | null>(null)
  const [codes, setCodes] = useState(barcodes)
  const [flash, setFlash] = useState('')

  const term = q.trim().toLowerCase()
  const shown = active.filter((i) => !term || i.name.toLowerCase().includes(term))
  const filled = Object.entries(counts).filter(([, v]) => v !== '' && !Number.isNaN(Number(v)))

  const bump = (id: string) => {
    const i = byId.get(id)
    if (!i) return
    setCounts((c) => ({ ...c, [id]: String((Number(c[id]) || 0) + packQty(i)) }))
    setFlash(id)
    setTimeout(() => setFlash(''), 900)
    navigator.vibrate?.(40)
    document.getElementById(`op-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  const onScan = (code: string) => {
    const hit = codes.find((b) => b.code === code)
    if (hit) bump(hit.ingredient_id)
    else setUnknown(code)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 bg-card p-4">
        <p className="text-lg font-bold">Hitung stok di rak</p>
        <p className="text-base text-muted-foreground">
          Isi jumlah yang benar-benar ada untuk bahan yang kamu hitung. Bahan yang dikosongkan tidak diubah. Scan barcode kemasan = tambah 1 kemasan.
        </p>
        <div className="mt-3">
          <BarcodeField onCode={onScan} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bahan…" aria-label="Cari bahan untuk dihitung" className="h-12 pl-11 text-base" />
        </div>
        {filled.length > 0 && (
          <Button variant="outline" className="h-12 border-2 px-4 text-base" onClick={() => setCounts({})}>
            <RotateCcw /> Kosongkan hitungan
          </Button>
        )}
      </div>

      <ul className="grid gap-2 md:grid-cols-2">
        {shown.map((i) => (
          <li key={i.id} id={`op-${i.id}`} className={`flex items-center gap-3 rounded-xl border-2 bg-card px-3 py-2 transition-colors ${flash === i.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : counts[i.id] ? 'border-primary/50' : ''}`}>
            <label htmlFor={`opi-${i.id}`} className="min-w-0 flex-1 truncate text-base font-semibold">{i.name}</label>
            <Input
              id={`opi-${i.id}`}
              inputMode="decimal"
              value={counts[i.id] ?? ''}
              onChange={(e) => setCounts((c) => ({ ...c, [i.id]: onlyNum(e.target.value) }))}
              placeholder="jumlah di rak"
              className="h-11 w-36 text-right text-base tabular-nums"
            />
            <span className="w-12 text-sm text-muted-foreground">{i.unit}</span>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-(--bottom-nav) z-10 -mx-1 flex items-center justify-between gap-3 rounded-2xl border-2 bg-background/95 p-3 backdrop-blur md:bottom-3">
        <p className="text-base">
          <strong className="tabular-nums">{filled.length}</strong> bahan dihitung
        </p>
        <Button className="h-12 px-6 text-base font-bold" disabled={filled.length === 0} onClick={() => setPreview(true)}>
          <ClipboardCheck /> Lihat hasil
        </Button>
      </div>

      {preview && (
        <OpnamePreview
          rows={filled.map(([id, v]) => ({ item: byId.get(id)!, counted: Number(v) })).filter((r) => r.item)}
          onClose={() => setPreview(false)}
          onSaved={() => {
            setPreview(false)
            setCounts({})
            onDone()
          }}
        />
      )}
      {unknown && (
        <UnknownBarcode
          code={unknown}
          items={items}
          storeId={storeId}
          onClose={() => setUnknown(null)}
          onLinked={(id) => {
            setCodes((c) => [...c, { code: unknown, ingredient_id: id }])
            setUnknown(null)
            bump(id)
          }}
          onCreateNew={() => {
            const c = unknown
            setUnknown(null)
            onNeedNewIngredient(c)
          }}
        />
      )}
    </div>
  )
}

/** Pratinjau: baru di sini angka catatan, selisih, dan nilai rupiahnya terlihat. */
function OpnamePreview({ rows, onClose, onSaved }: { rows: { item: Ingredient; counted: number }[]; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lines = rows.map((r) => ({ ...r, delta: r.counted - r.item.stock, value: (r.counted - r.item.stock) * r.item.cost }))
  const changed = lines.filter((l) => l.delta !== 0)
  const total = changed.reduce((n, l) => n + l.value, 0)

  const save = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await rpc('stock_count', { p_items: rows.map((r) => ({ ingredient_id: r.item.id, counted: r.counted })), p_note: note.trim() })
    setBusy(false)
    if (err) return setError(err.message)
    toast.success(changed.length === 0 ? `Stock opname tersimpan · ${rows.length} bahan, semuanya cocok` : `Stock opname tersimpan · ${changed.length} bahan disesuaikan`)
    onSaved()
  }

  return (
    <Panel
      onClose={onClose}
      title="Hasil stock opname"
      description={changed.length === 0 ? `${rows.length} bahan dihitung, semuanya cocok dengan catatan.` : `${rows.length} bahan dihitung, ${changed.length} berbeda dari catatan.`}
      maxWidth="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 border-2 text-base" onClick={onClose}>Hitung lagi</Button>
            <Button className="h-12 text-base font-bold" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan hasil'}</Button>
          </div>
        </div>
      }
    >
      {changed.length > 0 && (
        <p className={`rounded-xl px-4 py-3 text-base font-semibold ${total < 0 ? 'bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'}`}>
          Total selisih: {total < 0 ? 'kurang' : 'lebih'} {rupiah(Math.abs(Math.round(total)))}
        </p>
      )}
      <ul className="divide-y rounded-xl border-2">
        {lines.map((l) => (
          <li key={l.item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2.5">
            <span className="truncate text-base font-semibold">{l.item.name}</span>
            <span className={`text-right text-base font-bold tabular-nums ${l.delta < 0 ? 'text-red-700 dark:text-red-400' : l.delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
              {l.delta === 0 ? 'Cocok' : `${l.delta > 0 ? '+' : '−'}${fmtQty(Math.abs(l.delta))} ${l.item.unit}`}
            </span>
            <span className="text-sm text-muted-foreground">
              Catatan {fmtQty(l.item.stock)} → dihitung {fmtQty(l.counted)} {l.item.unit}
            </span>
            <span className="text-right text-sm text-muted-foreground tabular-nums">{l.delta !== 0 && rupiah(Math.round(l.value))}</span>
          </li>
        ))}
      </ul>
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Catatan <span className="font-normal text-muted-foreground">(boleh dikosongkan)</span></span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="contoh: opname akhir bulan, rak dapur" maxLength={100} className="h-12 text-base" />
      </label>
    </Panel>
  )
}
