import { ListPlus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CurrencyInput } from '@shared/components/currency-input'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Switch } from '@shared/components/ui/switch'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import { buyUnit, fmtQty, levelOf, onlyNum, type Ingredient } from '../inventory/data'
import { remaining, type Purchase, type PurchaseItem, type Supplier } from './data'

type Line = { key: number; ingredient: string; qty: string; price: string }
let seq = 0
const line = (ingredient = '', qty = '', price = ''): Line => ({ key: ++seq, ingredient, qty, price })

/** Saran belanja: bahan hampir habis/habis, dibeli sampai dua kali batas minimum, harga terakhir. */
const suggest = (items: Ingredient[]): Line[] =>
  items
    .filter((i) => i.is_active && i.min_stock > 0 && levelOf(i) !== 'ok')
    .map((i) => line(i.id, String(Math.max(1, Math.ceil((i.min_stock * 2 - Math.max(i.stock, 0)) / i.purchase_factor))), String(Math.round(i.cost * i.purchase_factor))))

function Choice<T extends string>({ value, onChange, options, legend }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string, string])[]; legend: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-base font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map(([v, label, hint]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`rounded-xl border-2 p-3 text-left ${value === v ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
            <span className="block text-base font-bold">{label}</span>
            <span className="block text-sm text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Buat/ubah daftar belanja. "Simpan dulu" = belum dipesan; "Sudah dipesan" = menunggu barang datang. */
export function OrderPanel({ po, poItems, ingredients, suppliers, onClose, onDone, onNewSupplier }: { po: Purchase | null; poItems: PurchaseItem[]; ingredients: Ingredient[]; suppliers: Supplier[]; onClose: () => void; onDone: () => void; onNewSupplier: () => void }) {
  const active = ingredients.filter((i) => i.is_active)
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const [supplier, setSupplier] = useState(po?.supplier_id ?? '')
  const [lines, setLines] = useState<Line[]>(() => (po ? poItems.map((i) => line(i.ingredient_id, String(i.qty), String(i.unit_price))) : suggest(ingredients).length ? suggest(ingredients) : [line()]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const filled = lines.filter((l) => l.ingredient && Number(l.qty) > 0)
  const total = filled.reduce((n, l) => n + Math.round(Number(l.qty) * (Number(l.price) || 0)), 0)
  const shops = suppliers.filter((s) => s.is_active || s.id === supplier)

  const save = async (ordered: boolean) => {
    if (filled.length === 0) return setError('Pilih bahan dan isi jumlahnya dulu. Contoh: Gula pasir, 2 kg.')
    if (ordered && !supplier) return setError('Pilih pemasok dulu. Belum ada? Tekan “Pemasok baru”.')
    setBusy(true)
    const { error: err } = await rpc('save_purchase_order', {
      p_id: po?.id ?? null,
      p_supplier_id: supplier || null,
      p_items: filled.map((l) => ({ ingredient_id: l.ingredient, qty: Number(l.qty), unit_price: Math.round(Number(l.price) || 0) })),
      p_note: '',
      p_ordered: ordered,
    })
    setBusy(false)
    if (err) return setError(err.message)
    toast.success(ordered ? 'Ditandai sudah dipesan. Tekan “Terima barang” saat barang datang.' : 'Daftar belanja tersimpan')
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title={po ? 'Ubah daftar belanja' : 'Daftar belanja baru'}
      description="Tulis yang mau dibeli. Stok baru bertambah saat barang diterima."
      maxWidth="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button className="h-12 w-full text-base font-bold" disabled={busy || filled.length === 0} onClick={() => void save(true)}>
            {busy ? 'Menyimpan…' : `Sudah dipesan ke pemasok${total > 0 ? ` · ${rupiah(total)}` : ''}`}
          </Button>
          <Button variant="outline" className="h-12 w-full border-2 text-base" disabled={busy || filled.length === 0} onClick={() => void save(false)}>
            Simpan dulu, pesan nanti
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <p className="text-base font-semibold">Pemasok</p>
        <div className="flex gap-2">
          <Select value={supplier} onValueChange={(v) => setSupplier(v ?? '')} items={shops.map((s) => ({ value: s.id, label: s.name }))}>
            <SelectTrigger aria-label="Pilih pemasok" className="h-12 flex-1 text-base"><SelectValue placeholder="Pilih pemasok" /></SelectTrigger>
            <SelectContent>{shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="h-12 border-2 px-4 text-base" onClick={onNewSupplier}><Plus /> Pemasok baru</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold">Yang mau dibeli</p>
          <Button variant="outline" className="h-11 border-2 text-base" onClick={() => setLines(suggest(ingredients).length ? suggest(ingredients) : lines)} disabled={suggest(ingredients).length === 0}>
            <ListPlus /> Isi dari bahan hampir habis
          </Button>
        </div>
        {lines.map((l) => {
          const ing = byId.get(l.ingredient)
          const unit = ing ? buyUnit(ing) : 'satuan'
          return (
            <div key={l.key} className="space-y-2 rounded-xl border-2 p-3">
              <div className="flex gap-2">
                <Select value={l.ingredient} onValueChange={(v) => set(l.key, { ingredient: v ?? '' })} items={active.map((i) => ({ value: i.id, label: i.name }))}>
                  <SelectTrigger aria-label="Pilih bahan" className="h-12 flex-1 text-base"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                  <SelectContent>{active.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                {lines.length > 1 && (
                  <Button variant="ghost" className="h-12 px-3 text-destructive" aria-label={`Hapus ${ing?.name ?? 'baris ini'}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 /> Hapus</Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="block text-sm font-semibold">Jumlah ({unit})</span>
                  <Input inputMode="decimal" value={l.qty} onChange={(e) => set(l.key, { qty: onlyNum(e.target.value) })} placeholder="contoh: 2" className="h-12 text-base" />
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-semibold">Perkiraan harga per {unit}</span>
                  <CurrencyInput value={l.price} onValueChange={(raw) => set(l.key, { price: raw })} placeholder="contoh: 15.000" className="h-12 text-base" />
                </label>
              </div>
              {ing && <p className="text-sm text-muted-foreground">Stok sekarang {fmtQty(ing.stock)} {ing.unit} · batas minimum {fmtQty(ing.min_stock)} {ing.unit}</p>}
            </div>
          )
        })}
        <Button variant="outline" className="h-12 w-full border-2 text-base" onClick={() => setLines((ls) => [...ls, line()])}><Plus /> Tambah bahan lain</Button>
      </div>
    </Panel>
  )
}

/** Terima barang: isi yang datang sekarang (boleh sebagian), lalu pilih cara bayar. */
export function ReceivePanel({ po, poItems, ingredients, onClose, onDone }: { po: Purchase; poItems: PurchaseItem[]; ingredients: Ingredient[]; onClose: () => void; onDone: () => void }) {
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const open = poItems.filter((i) => remaining(i) > 0)
  const [qty, setQty] = useState<Record<number, string>>(() => Object.fromEntries(open.map((i) => [i.id, String(remaining(i))])))
  const [pay, setPay] = useState<'OTHER' | 'CASH_DRAWER' | 'LATER'>('OTHER')
  const [close, setClose] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const value = open.reduce((n, i) => n + Math.round((Number(qty[i.id]) || 0) * i.unit_price), 0)
  const partial = open.some((i) => (Number(qty[i.id]) || 0) < remaining(i))

  const save = async () => {
    const over = open.find((i) => (Number(qty[i.id]) || 0) > remaining(i))
    if (over) return setError(`${byId.get(over.ingredient_id)?.name ?? 'Bahan'} melebihi sisa pesanan (${fmtQty(remaining(over))}). Kurangi jumlahnya.`)
    setBusy(true)
    const { data, error: err } = await rpc('receive_purchase_order', { p_id: po.id, p_items: open.map((i) => ({ item_id: i.id, qty: Number(qty[i.id]) || 0 })), p_pay: pay, p_close: close })
    setBusy(false)
    if (err) return setError(err.message)
    const r = data as { done?: boolean } | null
    toast.success(`Barang diterima, stok bertambah${pay === 'LATER' ? ` · utang ${rupiah(value)} dicatat` : pay === 'CASH_DRAWER' ? ' · dicatat sebagai kas keluar laci' : ''}${r?.done ? '' : ' · sisanya masih ditunggu'}`)
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title="Terima barang"
      description={`${po.supplier || 'Tanpa pemasok'} · isi jumlah yang benar-benar datang.`}
      maxWidth="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button className="h-12 w-full text-base font-bold" disabled={busy || (value === 0 && !close && open.every((i) => !(Number(qty[i.id]) > 0)))} onClick={() => void save()}>
            {busy ? 'Menyimpan…' : `Simpan penerimaan · ${rupiah(value)}`}
          </Button>
        </div>
      }
    >
      <ul className="space-y-2">
        {open.map((i) => {
          const ing = byId.get(i.ingredient_id)
          const unit = ing ? buyUnit(ing) : ''
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{ing?.name ?? 'Bahan'}</p>
                <p className="text-sm text-muted-foreground">Dipesan {fmtQty(i.qty)} {unit} · belum datang {fmtQty(remaining(i))} {unit} · {rupiah(i.unit_price)}/{unit}</p>
              </div>
              <label className="flex items-center gap-2 text-base font-semibold">
                Datang
                <Input inputMode="decimal" value={qty[i.id] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [i.id]: onlyNum(e.target.value) }))} aria-label={`Jumlah ${ing?.name ?? ''} yang datang`} className="h-12 w-24 text-center text-base" />
                {unit}
              </label>
            </li>
          )
        })}
      </ul>
      {partial && (
        <label className="flex items-center gap-3 rounded-xl border-2 p-3 text-base">
          <Switch checked={close} onCheckedChange={setClose} aria-label="Sisanya tidak jadi datang" />
          <span><span className="font-bold">Sisanya tidak jadi datang</span><span className="block text-sm text-muted-foreground">Matikan bila sisanya masih ditunggu.</span></span>
        </label>
      )}
      <Choice
        legend="Barang yang datang ini dibayar pakai"
        value={pay}
        onChange={setPay}
        options={[['OTHER', 'Bukan dari laci', 'Uang pribadi / transfer'], ['CASH_DRAWER', 'Uang laci kasir', 'Dicatat sebagai kas keluar'], ['LATER', 'Bayar nanti', 'Dicatat sebagai utang']] as const}
      />
    </Panel>
  )
}

/** Bayar utang ke pemasok; boleh sebagian. */
export function PayPanel({ po, onClose, onDone }: { po: Purchase; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(po.unpaid))
  const [from, setFrom] = useState<'OTHER' | 'CASH_DRAWER'>('OTHER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const n = Number(amount) || 0

  const save = async () => {
    if (n <= 0 || n > po.unpaid) return setError(`Isi antara Rp1 dan ${rupiah(po.unpaid)} (sisa utang).`)
    setBusy(true)
    const { error: err } = await rpc('pay_purchase', { p_id: po.id, p_amount: n, p_paid_from: from })
    setBusy(false)
    if (err) return setError(err.message)
    toast.success(n === po.unpaid ? `Utang ke ${po.supplier || 'pemasok'} lunas` : `Dibayar ${rupiah(n)} · sisa utang ${rupiah(po.unpaid - n)}`)
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title="Bayar utang"
      description={`${po.supplier || 'Tanpa pemasok'} · sisa utang ${rupiah(po.unpaid)}`}
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button className="h-12 w-full text-base font-bold" disabled={busy || n <= 0} onClick={() => void save()}>{busy ? 'Menyimpan…' : `Bayar ${rupiah(n)}`}</Button>
        </div>
      }
    >
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Jumlah yang dibayar sekarang</span>
        <CurrencyInput value={amount} onValueChange={setAmount} className="h-12 text-base" />
      </label>
      <Choice legend="Uangnya dari" value={from} onChange={setFrom} options={[['OTHER', 'Bukan dari laci', 'Uang pribadi / transfer'], ['CASH_DRAWER', 'Uang laci kasir', 'Dicatat sebagai kas keluar']] as const} />
    </Panel>
  )
}

/** Tambah/ubah pemasok. */
export function SupplierPanel({ supplier, onClose, onDone }: { supplier: Supplier | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [note, setNote] = useState(supplier?.note ?? '')
  const [active, setActive] = useState(supplier?.is_active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) return setError('Isi nama pemasok dulu. Contoh: Toko Makmur.')
    setBusy(true)
    const { error: err } = await rpc('save_supplier', { p_id: supplier?.id ?? null, p_name: name, p_phone: phone, p_note: note, p_active: active })
    setBusy(false)
    if (err) return setError(err.message)
    toast.success('Pemasok tersimpan')
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title={supplier ? 'Ubah pemasok' : 'Pemasok baru'}
      description="Tempat kamu biasa membeli bahan."
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button className="h-12 w-full text-base font-bold" disabled={busy} onClick={() => void save()}>{busy ? 'Menyimpan…' : 'Simpan pemasok'}</Button>
        </div>
      }
    >
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Nama</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="contoh: Toko Makmur" className="h-12 text-base" />
      </label>
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Nomor HP / WhatsApp <span className="font-normal text-muted-foreground">(boleh kosong)</span></span>
        <Input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 20))} placeholder="contoh: 081234567890" className="h-12 text-base" />
      </label>
      <label className="block space-y-1">
        <span className="block text-base font-semibold">Catatan <span className="font-normal text-muted-foreground">(boleh kosong)</span></span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="contoh: antar tiap Senin" className="h-12 text-base" />
      </label>
      {supplier && (
        <label className="flex items-center gap-3 text-base">
          <Switch checked={active} onCheckedChange={setActive} aria-label="Pemasok masih dipakai" /> {active ? 'Masih dipakai' : 'Tidak dipakai lagi'}
        </label>
      )}
    </Panel>
  )
}
