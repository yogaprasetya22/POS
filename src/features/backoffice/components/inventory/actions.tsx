import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CurrencyInput } from '@shared/components/currency-input'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import { BarcodeField, UnknownBarcode } from './barcode'
import { buyUnit, fmtQty, onlyNum, type Barcode, type Ingredient } from './data'

type Line = { key: number; ingredient: string; qty: string; price: string }
let seq = 0
const newLine = (ingredient = '', qty = ''): Line => ({ key: ++seq, ingredient, qty, price: '' })

/**
 * Barang masuk: satu kali belanja bisa berisi beberapa bahan. Scan barcode = tambah 1 satuan beli.
 * Stok bertambah, harga beli dirata-rata, dan bila dibayar dari laci kasir dicatat sebagai kas keluar.
 */
export function PurchasePanel({
  items,
  barcodes,
  storeId,
  initial,
  onClose,
  onDone,
  onNeedNewIngredient,
}: {
  items: Ingredient[]
  barcodes: Barcode[]
  storeId: string
  initial?: string
  onClose: () => void
  onDone: () => void
  onNeedNewIngredient: (barcode: string) => void
}) {
  const active = items.filter((i) => i.is_active)
  const byId = new Map(items.map((i) => [i.id, i]))
  const [supplier, setSupplier] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine(initial)])
  const [from, setFrom] = useState<'CASH_DRAWER' | 'OTHER'>('OTHER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unknown, setUnknown] = useState<string | null>(null)
  const [codes, setCodes] = useState(barcodes)

  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const addOne = (ingredientId: string) =>
    setLines((ls) => {
      const hit = ls.find((l) => l.ingredient === ingredientId)
      if (hit) return ls.map((l) => (l === hit ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l))
      const empty = ls.find((l) => !l.ingredient)
      if (empty) return ls.map((l) => (l === empty ? { ...l, ingredient: ingredientId, qty: '1' } : l))
      return [...ls, newLine(ingredientId, '1')]
    })
  const onScan = (code: string) => {
    const hit = codes.find((b) => b.code === code)
    if (!hit) return setUnknown(code)
    navigator.vibrate?.(40)
    addOne(hit.ingredient_id)
    toast(`+1 ${byId.get(hit.ingredient_id)?.name ?? ''}`, { duration: 1500 })
  }

  const filled = lines.filter((l) => l.ingredient && Number(l.qty) > 0)
  const total = filled.reduce((n, l) => n + Math.round(Number(l.qty) * (Number(l.price) || 0)), 0)

  const save = async () => {
    if (filled.length === 0) return setError('Pilih bahan dan isi jumlahnya dulu. Contoh: Gula pasir, 2 kg.')
    setBusy(true)
    setError('')
    const { data, error: err } = await rpc('receive_purchase', {
      p_supplier: supplier.trim(),
      p_items: filled.map((l) => ({ ingredient_id: l.ingredient, qty: Number(l.qty), unit_price: Math.round(Number(l.price) || 0) })),
      p_paid_from: from,
      p_note: '',
    })
    setBusy(false)
    if (err) return setError(err.message)
    const r = data as { total?: number; from_drawer?: boolean } | null
    toast.success(`Barang masuk tersimpan · ${filled.length} bahan · ${rupiah(r?.total ?? total)}${r?.from_drawer ? ' (dicatat sebagai kas keluar laci)' : ''}`)
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title="Barang masuk"
      description="Catat bahan yang baru dibeli. Stok langsung bertambah."
      maxWidth="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button size="lg" className="h-12 w-full text-base font-bold" disabled={busy || filled.length === 0} onClick={save}>
            {busy ? 'Menyimpan…' : `Simpan barang masuk${total > 0 ? ` · ${rupiah(total)}` : ''}`}
          </Button>
        </div>
      }
    >
      <BarcodeField onCode={onScan} placeholder="Scan barcode kemasan (opsional)" />

      <div className="space-y-2">
        <label htmlFor="pb-supplier" className="block text-base font-semibold">Beli dari <span className="font-normal text-muted-foreground">(boleh dikosongkan)</span></label>
        <Input id="pb-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="contoh: Pasar, Toko Makmur" maxLength={60} className="h-12 text-base" />
      </div>

      <div className="space-y-3">
        <p className="text-base font-semibold">Bahan yang dibeli</p>
        {lines.map((l) => {
          const ing = byId.get(l.ingredient)
          const unit = ing ? buyUnit(ing) : 'satuan'
          const q = Number(l.qty)
          return (
            <div key={l.key} className="space-y-2 rounded-xl border-2 p-3">
              <div className="flex gap-2">
                <Select value={l.ingredient} onValueChange={(v) => set(l.key, { ingredient: v ?? '' })} items={active.map((i) => ({ value: i.id, label: i.name }))}>
                  <SelectTrigger aria-label="Pilih bahan" className="h-12 flex-1 text-base"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                  <SelectContent>{active.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                {lines.length > 1 && (
                  <Button variant="ghost" className="h-12 px-3 text-destructive" aria-label="Hapus baris ini" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 /> Hapus
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="block text-sm font-semibold">Jumlah ({unit})</span>
                  <Input inputMode="decimal" value={l.qty} onChange={(e) => set(l.key, { qty: onlyNum(e.target.value) })} placeholder="contoh: 2" className="h-12 text-base" />
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-semibold">Harga per {unit}</span>
                  <CurrencyInput value={l.price} onValueChange={(raw) => set(l.key, { price: raw })} placeholder="contoh: 15.000" className="h-12 text-base" />
                </label>
              </div>
              {ing && q > 0 && (
                <p className="text-sm text-muted-foreground">
                  Stok bertambah {fmtQty(q)} {unit}
                  {ing.purchase_unit && ` = ${fmtQty(q * ing.purchase_factor)} ${ing.unit}`}
                  {Number(l.price) > 0 && ` · subtotal ${rupiah(Math.round(q * Number(l.price)))}`}
                </p>
              )}
            </div>
          )
        })}
        <Button variant="outline" className="h-12 w-full border-2 text-base" onClick={() => setLines((ls) => [...ls, newLine()])}>
          <Plus /> Tambah bahan lain
        </Button>
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-semibold">Dibayar pakai</legend>
        <div className="grid grid-cols-2 gap-2">
          {([['OTHER', 'Bukan dari laci', 'Uang pribadi / transfer'], ['CASH_DRAWER', 'Uang laci kasir', 'Dicatat sebagai kas keluar']] as const).map(([v, label, hint]) => (
            <button key={v} type="button" aria-pressed={from === v} onClick={() => setFrom(v)} className={`rounded-xl border-2 p-3 text-left ${from === v ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
              <span className="block text-base font-bold">{label}</span>
              <span className="block text-sm text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {unknown && (
        <UnknownBarcode
          code={unknown}
          items={items}
          storeId={storeId}
          onClose={() => setUnknown(null)}
          onLinked={(id) => {
            setCodes((c) => [...c, { code: unknown, ingredient_id: id }])
            addOne(id)
            setUnknown(null)
          }}
          onCreateNew={() => {
            const code = unknown
            setUnknown(null)
            onNeedNewIngredient(code)
          }}
        />
      )}
    </Panel>
  )
}

/** Bahan terbuang (basi, tumpah, rusak): stok berkurang dan tercatat alasannya. */
export function WastePanel({ item, onClose, onDone }: { item: Ingredient; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const n = Number(qty)
  const tooMuch = n > Math.max(item.stock, 0)

  const save = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await rpc('record_waste', { p_ingredient: item.id, p_qty: n, p_note: note.trim() })
    setBusy(false)
    if (err) return setError(err.message)
    toast.success(`${fmtQty(n)} ${item.unit} ${item.name} dicatat terbuang`)
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title={`Catat terbuang · ${item.name}`}
      description={`Stok sekarang ${fmtQty(item.stock)} ${item.unit}`}
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button size="lg" variant="destructive" className="h-12 w-full text-base font-bold" disabled={busy || !(n > 0) || tooMuch} onClick={save}>
            {busy ? 'Menyimpan…' : 'Simpan bahan terbuang'}
          </Button>
        </div>
      }
    >
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Jumlah terbuang ({item.unit})</span>
        <Input inputMode="decimal" value={qty} onChange={(e) => setQty(onlyNum(e.target.value))} placeholder="contoh: 200" className="h-12 text-base" aria-invalid={tooMuch} />
      </label>
      {tooMuch && <p className="text-base font-semibold text-destructive">Lebih banyak dari stok ({fmtQty(item.stock)} {item.unit}). Periksa lagi jumlahnya.</p>}
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Kenapa? <span className="font-normal text-muted-foreground">(boleh dikosongkan)</span></span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="contoh: basi, tumpah, rusak" maxLength={100} className="h-12 text-base" />
      </label>
    </Panel>
  )
}

const UNITS = ['gram', 'ml', 'pcs'] as const

/**
 * Bahan baru / ubah bahan: nama, satuan, batas minimum, harga beli, satuan beli, dan barcode kemasan.
 * Jumlah stok tidak diubah di sini: lewat Barang masuk atau Stock Opname supaya tercatat.
 */
export function IngredientPanel({
  item,
  storeId,
  barcodes,
  initialBarcode,
  onClose,
  onDone,
}: {
  item: Ingredient | null
  storeId: string
  barcodes: Barcode[]
  initialBarcode?: string
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [unit, setUnit] = useState(item?.unit ?? 'gram')
  const [min, setMin] = useState(item ? String(item.min_stock) : '')
  const [cost, setCost] = useState(item ? String(item.cost) : '')
  const [pu, setPu] = useState(item?.purchase_unit ?? '')
  const [pf, setPf] = useState(item ? String(item.purchase_factor || 1) : '1')
  const [codes, setCodes] = useState<string[]>(() => [...(item ? barcodes.filter((b) => b.ingredient_id === item.id).map((b) => b.code) : []), ...(initialBarcode ? [initialBarcode] : [])])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const custom = !UNITS.includes(unit as (typeof UNITS)[number])

  const save = async () => {
    if (!name.trim()) return setError('Nama bahan belum diisi. Contoh: Gula pasir.')
    if (!unit.trim()) return setError('Satuan belum diisi. Pilih gram, ml, atau pcs.')
    setBusy(true)
    setError('')
    const row = {
      name: name.trim(),
      unit: unit.trim(),
      min_stock: Number(min) || 0,
      cost: Number(cost) || 0,
      purchase_unit: pu.trim(),
      purchase_factor: Number(pf) > 0 ? Number(pf) : 1,
    }
    const res = item
      ? await supabase.from('ingredients').update(row).eq('id', item.id).select('id').single()
      : await supabase.from('ingredients').insert({ ...row, store_id: storeId }).select('id').single()
    if (res.error || !res.data) {
      setBusy(false)
      return setError(res.error?.message ?? 'Bahan gagal disimpan')
    }
    const id = res.data.id as string
    const before = item ? barcodes.filter((b) => b.ingredient_id === item.id).map((b) => b.code) : []
    const removed = before.filter((c) => !codes.includes(c))
    const added = codes.filter((c) => !before.includes(c))
    if (removed.length) await supabase.from('ingredient_barcodes').delete().eq('store_id', storeId).in('code', removed)
    if (added.length) {
      const { error: e } = await supabase.from('ingredient_barcodes').insert(added.map((code) => ({ store_id: storeId, code, ingredient_id: id })))
      if (e) {
        setBusy(false)
        return setError(e.message.includes('duplicate') ? 'Salah satu barcode sudah dipakai bahan lain. Hapus barcode itu lalu simpan lagi.' : e.message)
      }
    }
    setBusy(false)
    toast.success(item ? `${row.name} tersimpan` : `Bahan ${row.name} ditambahkan. Isi stoknya lewat Barang masuk.`)
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title={item ? `Ubah · ${item.name}` : 'Bahan baru'}
      description={item ? `Stok sekarang ${fmtQty(item.stock)} ${item.unit}. Ubah jumlah stok lewat Barang masuk atau Stock Opname.` : 'Setelah disimpan, isi stoknya lewat Barang masuk.'}
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button size="lg" className="h-12 w-full text-base font-bold" disabled={busy} onClick={save}>
            {busy ? 'Menyimpan…' : 'Simpan bahan'}
          </Button>
        </div>
      }
    >
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Nama bahan</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="contoh: Gula pasir" maxLength={60} className="h-12 text-base" />
      </label>

      <fieldset>
        <legend className="mb-2 text-base font-semibold">Satuan pakai <span className="font-normal text-muted-foreground">(dipakai di resep)</span></legend>
        {item ? (
          <p className="text-base">{item.unit} <span className="text-sm text-muted-foreground">· tidak bisa diubah agar stok & resep tetap benar</span></p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={`h-11 rounded-full border-2 px-5 text-base font-semibold ${unit === u ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted'}`}>{u}</button>
            ))}
            <Input aria-label="Satuan lain" placeholder="lainnya…" value={custom ? unit : ''} onChange={(e) => setUnit(e.target.value)} maxLength={12} className="h-11 w-32" />
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="block text-base font-semibold">Batas minimum</span>
          <span className="block text-sm text-muted-foreground">Peringatan muncul di bawah ini</span>
          <Input inputMode="decimal" value={min} onChange={(e) => setMin(onlyNum(e.target.value))} placeholder={`contoh: 500 ${unit}`} className="h-12 text-base" />
        </label>
        <label className="space-y-1">
          <span className="block text-base font-semibold">Harga per {unit || 'satuan'}</span>
          <span className="block text-sm text-muted-foreground">Untuk menghitung modal</span>
          <CurrencyInput decimals={2} value={cost} onValueChange={setCost} placeholder="contoh: 17" className="h-12 text-base" />
        </label>
      </div>

      <section className="space-y-2">
        <p className="text-base font-semibold">Satuan beli <span className="font-normal text-muted-foreground">(opsional)</span></p>
        <p className="text-sm text-muted-foreground">Contoh: dibeli per kg, dipakai dalam gram → isi “kg” dan 1000.</p>
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
          <Input aria-label="Satuan beli" placeholder="kg" value={pu} onChange={(e) => setPu(e.target.value)} maxLength={12} className="h-11" />
          <span>=</span>
          <Input aria-label={`Isi per satuan beli (${unit})`} inputMode="decimal" value={pf} onChange={(e) => setPf(onlyNum(e.target.value))} className="h-11" />
          <span>{unit}</span>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-base font-semibold">Barcode kemasan <span className="font-normal text-muted-foreground">(opsional, boleh lebih dari satu)</span></p>
        <BarcodeField onCode={(c) => setCodes((cs) => (cs.includes(c) ? cs : [...cs, c]))} placeholder="Scan atau ketik barcode lalu Enter" />
        {codes.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {codes.map((c) => (
              <li key={c} className="inline-flex items-center gap-1 rounded-full border-2 py-1 pr-1 pl-3 font-mono text-sm">
                {c}
                <Button variant="ghost" className="h-8 px-2 text-sm" aria-label={`Hapus barcode ${c}`} onClick={() => setCodes((cs) => cs.filter((x) => x !== c))}>
                  <X /> Hapus
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  )
}
