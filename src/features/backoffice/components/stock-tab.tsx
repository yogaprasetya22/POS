import { AlertTriangle, PackagePlus, Plus, Trash2 } from 'lucide-react'
import { useClientPaged } from '@shared/lib/use-client-paged'
import { Pagination } from '@shared/components/pagination'
import { CurrencyInput } from '@shared/components/currency-input'
import { RowsSkeleton } from '@shared/components/skeletons'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import type { Product, Store } from '@shared/types/contracts'

const IngredientSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  unit: z.string(),
  stock: z.coerce.number(),
  min_stock: z.coerce.number(),
  cost: z.coerce.number(),
  is_active: z.boolean(),
})
type Ingredient = z.infer<typeof IngredientSchema>
const RecipeSchema = z.object({ product_id: z.uuid(), ingredient_id: z.uuid(), qty: z.coerce.number() })
type Recipe = z.infer<typeof RecipeSchema>

const num = (v: string) => v.replace(/[^\d.]/g, '')
const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 3 })

/** Stok bahan baku, resep per menu (stok berkurang otomatis saat terjual), dan HPP. */
export function StockTab({ store, products }: { store: Store; products: Product[] }) {
  const [items, setItems] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({ name: '', unit: 'gram', min: '', cost: '' })
  const [adjusting, setAdjusting] = useState<Ingredient | null>(null)
  const [productId, setProductId] = useState<string>(products[0]?.id ?? '')
  const [rIng, setRIng] = useState('')
  const [rQty, setRQty] = useState('')

  const load = useCallback(async () => {
    const [i, r] = await Promise.all([supabase.from('ingredients').select('*').order('name'), supabase.from('recipes').select('*')])
    const pi = z.array(IngredientSchema).safeParse(i.data ?? [])
    const pr = z.array(RecipeSchema).safeParse(r.data ?? [])
    if (pi.success) setItems(pi.data)
    if (pr.success) setRecipes(pr.data)
    setLoaded(true)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const act = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: err } = await p
    setError(err?.message ?? '')
    if (!err) void load()
    return !err
  }

  const pagedItems = useClientPaged(items, { pageSize: 10 })
  const low = items.filter((i) => i.is_active && i.stock <= i.min_stock)
  const byId = new Map(items.map((i) => [i.id, i]))
  const product = products.find((p) => p.id === productId)
  const rows = recipes.filter((r) => r.product_id === productId)
  const hpp = rows.reduce((n, r) => n + r.qty * (byId.get(r.ingredient_id)?.cost ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Stok &amp; Resep</h2>
        <p className="text-sm text-muted-foreground">Catat bahan baku dan resep tiap menu. Stok berkurang otomatis saat pesanan dibayar dan kembali saat di-void.</p>
      </div>
      <ErrorAlert message={error} />
      {low.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-500/20 dark:text-amber-100">
          <AlertTriangle className="size-4 shrink-0" /> Stok menipis: {low.map((i) => i.name).join(', ')}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bahan baku ({items.length})</CardTitle>
            <CardDescription>Harga beli per satuan dipakai untuk menghitung HPP menu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_5.5rem_5.5rem_9rem] gap-2">
              <Input aria-label="Nama bahan" placeholder="Nama bahan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" maxLength={60} />
              <Input aria-label="Satuan" placeholder="Satuan" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-11" maxLength={12} />
              <Input aria-label="Stok minimum" placeholder="Min." inputMode="decimal" value={form.min} onChange={(e) => setForm({ ...form, min: num(e.target.value) })} className="h-11" />
              <CurrencyInput aria-label="Harga beli per satuan" placeholder="Per satuan" decimals={2} value={form.cost} onValueChange={(raw) => setForm({ ...form, cost: raw })} className="h-11" />
            </div>
            <Button
              className="h-11 w-full"
              disabled={!form.name.trim() || !form.unit.trim()}
              onClick={async () => {
                const ok = await act(supabase.from('ingredients').insert({ store_id: store.id, name: form.name.trim(), unit: form.unit.trim(), min_stock: Number(form.min) || 0, cost: Number(form.cost) || 0 }))
                if (ok) setForm({ ...form, name: '', min: '', cost: '' })
              }}
            >
              <Plus /> Tambah bahan
            </Button>
            <ul className="divide-y">
              {pagedItems.rows.map((i) => {
                const isLow = i.is_active && i.stock <= i.min_stock
                return (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.name}</p>
                      <p className="text-sm text-muted-foreground">min {fmt(i.min_stock)} {i.unit} · {rupiah(i.cost)}/{i.unit}</p>
                    </div>
                    <Badge variant={isLow ? 'destructive' : 'secondary'} className="tabular-nums">{fmt(i.stock)} {i.unit}</Badge>
                    <Button variant="outline" size="icon" aria-label={`Ubah stok ${i.name}`} className="size-11" onClick={() => setAdjusting(i)}>
                      <PackagePlus />
                    </Button>
                  </li>
                )
              })}
              {loaded && items.length === 0 && <li className="py-8 text-center text-muted-foreground">Belum ada bahan baku.</li>}
            </ul>
            {!loaded && <RowsSkeleton rows={5} className="-mx-4" />}
            <Pagination page={pagedItems.page} pageCount={pagedItems.pageCount} total={pagedItems.total} pageSize={pagedItems.pageSize} onPage={pagedItems.setPage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resep menu</CardTitle>
            <CardDescription>Bahan yang terpakai untuk 1 porsi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={productId} onValueChange={(v) => setProductId(v ?? '')} items={products.map((p) => ({ value: p.id, label: p.name }))}>
              <SelectTrigger aria-label="Pilih menu" className="h-11 w-full"><SelectValue placeholder="Pilih menu" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <ul className="divide-y">
              {rows.map((r) => {
                const ing = byId.get(r.ingredient_id)
                return (
                  <li key={r.ingredient_id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate">{ing?.name ?? '—'}</span>
                    <span className="tabular-nums text-muted-foreground">{fmt(r.qty)} {ing?.unit}</span>
                    <span className="w-20 text-right tabular-nums">{rupiah(Math.round(r.qty * (ing?.cost ?? 0)))}</span>
                    <Button variant="ghost" size="icon" aria-label="Hapus dari resep" className="text-destructive" onClick={() => act(supabase.from('recipes').delete().eq('product_id', r.product_id).eq('ingredient_id', r.ingredient_id))}>
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
              {loaded && rows.length === 0 && <li className="py-6 text-center text-muted-foreground">Belum ada resep untuk menu ini.</li>}
            </ul>
            <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
              <Select value={rIng} onValueChange={(v) => setRIng(v ?? '')} items={items.map((i) => ({ value: i.id, label: i.name }))}>
                <SelectTrigger aria-label="Pilih bahan" className="h-11 w-full"><SelectValue placeholder="Bahan" /></SelectTrigger>
                <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}</SelectContent>
              </Select>
              <Input aria-label="Jumlah per porsi" placeholder="Jumlah" inputMode="decimal" value={rQty} onChange={(e) => setRQty(num(e.target.value))} className="h-11" />
              <Button
                className="h-11"
                disabled={!productId || !rIng || !(Number(rQty) > 0)}
                onClick={async () => {
                  const ok = await act(supabase.from('recipes').upsert({ product_id: productId, ingredient_id: rIng, store_id: store.id, qty: Number(rQty) }))
                  if (ok) setRQty('')
                }}
              >
                Simpan
              </Button>
            </div>
            {product && rows.length > 0 && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                HPP {rupiah(Math.round(hpp))} · harga jual {rupiah(product.price)} · margin{' '}
                <span className="font-semibold">{product.price > 0 ? Math.round(((product.price - hpp) / product.price) * 100) : 0}%</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {adjusting && (
        <AdjustStock
          ingredient={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={async (delta, reason, note) => {
            const ok = await act(rpc('stock_adjust', { p_ingredient: adjusting.id, p_delta: delta, p_reason: reason, p_note: note }).then((r) => ({ error: r.error })))
            if (ok) setAdjusting(null)
          }}
        />
      )}
    </div>
  )
}

function AdjustStock({ ingredient, onClose, onSave }: { ingredient: Ingredient; onClose: () => void; onSave: (delta: number, reason: 'RESTOCK' | 'ADJUST', note: string) => void }) {
  const [mode, setMode] = useState<'RESTOCK' | 'ADJUST'>('RESTOCK')
  const [qty, setQty] = useState('')
  const [sign, setSign] = useState<1 | -1>(1)
  const [note, setNote] = useState('')
  const delta = (Number(qty) || 0) * (mode === 'RESTOCK' ? 1 : sign)
  return (
    <Panel
      onClose={onClose}
      title={ingredient.name}
      description={`Stok sekarang ${fmt(ingredient.stock)} ${ingredient.unit}`}
      footer={<Button size="lg" className="h-12 w-full" disabled={delta === 0} onClick={() => onSave(delta, mode, note)}>Simpan</Button>}
    >
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={mode === 'RESTOCK' ? 'default' : 'outline'} className="h-11" onClick={() => setMode('RESTOCK')}>Tambah stok (beli)</Button>
        <Button type="button" variant={mode === 'ADJUST' ? 'default' : 'outline'} className="h-11" onClick={() => setMode('ADJUST')}>Koreksi (opname)</Button>
      </div>
      {mode === 'ADJUST' && (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={sign === 1 ? 'default' : 'outline'} className="h-11" onClick={() => setSign(1)}>Lebih</Button>
          <Button type="button" variant={sign === -1 ? 'default' : 'outline'} className="h-11" onClick={() => setSign(-1)}>Kurang</Button>
        </div>
      )}
      <Input aria-label={`Jumlah (${ingredient.unit})`} placeholder={`Jumlah (${ingredient.unit})`} inputMode="decimal" value={qty} onChange={(e) => setQty(num(e.target.value))} className="h-12 text-lg" />
      <Input aria-label="Catatan" placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-11" maxLength={100} />
    </Panel>
  )
}
