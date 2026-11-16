import { CheckCircle2, CircleDashed, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import type { Product } from '@shared/types/contracts'
import { fmtQty, onlyNum, type Ingredient, type Recipe } from './data'

/** Takaran satu bahan; tersimpan saat kotak ditinggalkan (blur) atau Enter. */
function QtyCell({ value, unit, onSave }: { value: number; unit: string; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(value))
  useEffect(() => setV(String(value)), [value])
  const commit = () => {
    const n = Number(v)
    if (n > 0 && n !== value) onSave(n)
    else setV(String(value))
  }
  return (
    <span className="flex items-center gap-2">
      <Input
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(onlyNum(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        aria-label={`Takaran (${unit})`}
        className="h-11 w-24 text-right text-base tabular-nums"
      />
      <span className="w-12 text-sm text-muted-foreground">{unit}</span>
    </span>
  )
}

/**
 * Tab Resep menu: pilih menu di kiri, atur bahannya di kanan. Satu bahan bisa dipakai banyak menu;
 * stoknya satu, jadi sisa porsi semua menu yang memakainya ikut berubah otomatis.
 */
export function RecipeEditor({
  products,
  items,
  recipes,
  storeId,
  onChanged,
  onNewIngredient,
}: {
  products: Product[]
  items: Ingredient[]
  recipes: Recipe[]
  storeId: string
  onChanged: () => void
  onNewIngredient: () => void
}) {
  const [q, setQ] = useState('')
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [ing, setIng] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')

  const byId = new Map(items.map((i) => [i.id, i]))
  const countOf = (pid: string) => recipes.filter((r) => r.product_id === pid).length
  const term = q.trim().toLowerCase()
  const menu = products.filter((p) => !term || p.name.toLowerCase().includes(term))
  const product = products.find((p) => p.id === productId)
  const rows = recipes.filter((r) => r.product_id === productId).map((r) => ({ ...r, ing: byId.get(r.ingredient_id) }))
  const modal = rows.reduce((n, r) => n + r.qty * (r.ing?.cost ?? 0), 0)
  const portions = rows.length ? Math.floor(Math.min(...rows.map((r) => Math.max(r.ing?.stock ?? 0, 0) / r.qty))) : null
  const unused = items.filter((i) => i.is_active && !rows.some((r) => r.ingredient_id === i.id))
  const usedBy = (iid: string) => recipes.filter((r) => r.ingredient_id === iid).length

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    const { error: err } = await p
    setError(err?.message ?? '')
    if (!err) {
      if (ok) toast.success(ok)
      onChanged()
    }
    return !err
  }
  const add = async () => {
    const n = Number(qty)
    if (!ing || !(n > 0)) return setError('Pilih bahan dan isi takarannya. Contoh: Telur, 1.')
    if (await run(supabase.from('recipes').upsert({ product_id: productId, ingredient_id: ing, store_id: storeId, qty: n }), `${byId.get(ing)?.name} ditambahkan ke resep`)) {
      setIng('')
      setQty('')
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      {/* tablet & desktop: daftar menu menempel di samping dan setinggi layar (gulir sendiri) */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start">
        <div className="relative shrink-0">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu…" aria-label="Cari menu" className="h-12 pl-11 text-base" />
        </div>
        <ul className="max-h-72 min-h-0 space-y-1 overflow-y-auto overscroll-contain rounded-2xl border-2 bg-card p-2 lg:max-h-none lg:flex-1" aria-label="Daftar menu">
          {menu.map((p) => {
            const n = countOf(p.id)
            const on = p.id === productId
            return (
              <li key={p.id}>
                <button type="button" aria-current={on} onClick={() => setProductId(p.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left ${on ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                  {n > 0 ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden /> : <CircleDashed className="size-5 shrink-0 text-amber-600" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-base ${on ? 'font-bold' : 'font-semibold'}`}>{p.name}</span>
                    <span className="block text-sm text-muted-foreground">{n > 0 ? `${n} bahan` : 'Belum ada resep'}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {product ? (
        <section className="space-y-4 rounded-2xl border-2 bg-card p-4 md:p-5">
          <div>
            <h3 className="text-2xl font-extrabold">{product.name}</h3>
            <p className="text-base text-muted-foreground">Bahan yang terpakai untuk <strong className="text-foreground">1 porsi</strong>. Stok berkurang otomatis saat menu ini dibayar.</p>
          </div>

          <ErrorAlert message={error} />

          {rows.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed px-4 py-6 text-center text-base text-muted-foreground">Menu ini belum punya resep. Tambahkan bahan pertamanya di bawah.</p>
          ) : (
            <ul className="divide-y rounded-xl border-2">
              {rows.map((r) => (
                <li key={r.ingredient_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{r.ing?.name ?? '—'}</span>
                    <span className="block text-sm text-muted-foreground">
                      Stok {fmtQty(r.ing?.stock ?? 0)} {r.ing?.unit}
                      {usedBy(r.ingredient_id) > 1 && ` · dipakai ${usedBy(r.ingredient_id)} menu`}
                    </span>
                  </span>
                  <QtyCell value={r.qty} unit={r.ing?.unit ?? ''} onSave={(n) => void run(supabase.from('recipes').update({ qty: n }).eq('product_id', r.product_id).eq('ingredient_id', r.ingredient_id), 'Takaran tersimpan')} />
                  <span className="w-24 text-right text-base tabular-nums">{rupiah(Math.round(r.qty * (r.ing?.cost ?? 0)))}</span>
                  <Button variant="ghost" className="h-11 px-3 text-destructive" aria-label={`Hapus ${r.ing?.name} dari resep`} onClick={() => void run(supabase.from('recipes').delete().eq('product_id', r.product_id).eq('ingredient_id', r.ingredient_id), `${r.ing?.name} dihapus dari resep`)}>
                    <Trash2 /> Hapus
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 rounded-xl bg-muted/50 p-3">
            <p className="text-base font-semibold">Tambah bahan</p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <Select value={ing} onValueChange={(v) => setIng(v ?? '')} items={unused.map((i) => ({ value: i.id, label: i.name }))}>
                <SelectTrigger aria-label="Pilih bahan" className="h-12 w-full bg-background text-base"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                <SelectContent>{unused.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}</SelectContent>
              </Select>
              <Input inputMode="decimal" value={qty} onChange={(e) => setQty(onlyNum(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && void add()} placeholder={ing ? `takaran (${byId.get(ing)?.unit})` : 'takaran'} aria-label="Takaran per porsi" className="h-12 bg-background text-base" />
              <Button className="h-12 px-5 text-base font-bold" onClick={() => void add()}><Plus /> Tambah</Button>
            </div>
            <button type="button" className="min-h-10 text-base font-semibold text-primary underline-offset-4 hover:underline" onClick={onNewIngredient}>
              Bahannya belum ada? Buat bahan baru
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border-2 p-3"><dt className="text-sm font-semibold text-muted-foreground">Modal / porsi</dt><dd className="text-xl font-extrabold tabular-nums">{rupiah(Math.round(modal))}</dd></div>
            <div className="rounded-xl border-2 p-3"><dt className="text-sm font-semibold text-muted-foreground">Harga jual</dt><dd className="text-xl font-extrabold tabular-nums">{rupiah(product.price)}</dd></div>
            <div className="rounded-xl border-2 p-3">
              <dt className="text-sm font-semibold text-muted-foreground">Untung / porsi</dt>
              <dd className={`text-xl font-extrabold tabular-nums ${product.price - modal < 0 ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {rupiah(Math.round(product.price - modal))}
                {product.price > 0 && <span className="ml-1 text-sm font-semibold">({Math.round(((product.price - modal) / product.price) * 100)}%)</span>}
              </dd>
            </div>
            <div className="rounded-xl border-2 p-3"><dt className="text-sm font-semibold text-muted-foreground">Bisa dibuat</dt><dd className="text-xl font-extrabold tabular-nums">{portions === null ? '—' : `${fmtQty(portions)} porsi`}</dd></div>
          </dl>
        </section>
      ) : (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-base text-muted-foreground">Belum ada menu. Tambahkan menu dulu di halaman Menu.</p>
      )}
    </div>
  )
}
