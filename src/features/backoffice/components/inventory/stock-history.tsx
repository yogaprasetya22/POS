import { useEffect, useState } from 'react'
import { z } from 'zod'
import { FilterChips } from '@shared/components/page'
import { EmptyState, LoadMore } from '@shared/components/pagination'
import { RowsSkeleton } from '@shared/components/skeletons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { supabase } from '@shared/lib/supabase'
import { usePaged } from '@shared/lib/use-paged'
import { todayJakarta } from '@shared/lib/utils'
import { fmtQty, type Ingredient } from './data'

const MoveSchema = z.object({
  id: z.number(),
  ingredient_id: z.uuid(),
  delta: z.coerce.number(),
  reason: z.string(),
  note: z.string(),
  user_id: z.string().nullable(),
  created_at: z.string(),
})
type Move = z.infer<typeof MoveSchema>

type Kind = 'all' | 'SALE' | 'PURCHASE' | 'WASTE' | 'COUNT' | 'ADJUST' | 'VOID'
const KIND: Record<string, { label: string; tone: string }> = {
  SALE: { label: 'Terjual', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200' },
  PURCHASE: { label: 'Barang masuk', tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200' },
  RESTOCK: { label: 'Barang masuk', tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200' },
  WASTE: { label: 'Terbuang', tone: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200' },
  COUNT: { label: 'Stock opname', tone: 'bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200' },
  ADJUST: { label: 'Koreksi', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' },
  VOID: { label: 'Batal / refund', tone: 'bg-muted text-foreground' },
}
// "Barang masuk" mencakup catatan lama (RESTOCK) dan yang baru (PURCHASE)
const REASONS: Record<Exclude<Kind, 'all'>, string[]> = {
  SALE: ['SALE'],
  PURCHASE: ['PURCHASE', 'RESTOCK'],
  WASTE: ['WASTE'],
  COUNT: ['COUNT'],
  ADJUST: ['ADJUST'],
  VOID: ['VOID'],
}

type Range = 'today' | '7d' | '30d'
const since = (r: Range) => {
  const d = new Date(`${todayJakarta()}T00:00:00+07:00`)
  if (r === '7d') d.setDate(d.getDate() - 6)
  if (r === '30d') d.setDate(d.getDate() - 29)
  return d.toISOString()
}
const when = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Tab Riwayat: semua pergerakan stok, siapa yang mencatat, dan kapan. */
export function StockHistory({ items }: { items: Ingredient[] }) {
  const [ing, setIng] = useState('all')
  const [kind, setKind] = useState<Kind>('all')
  const [range, setRange] = useState<Range>('7d')
  const [who, setWho] = useState<Map<string, string>>(new Map())
  const byId = new Map(items.map((i) => [i.id, i]))

  useEffect(() => {
    void supabase.from('profiles').select('user_id,email').then(({ data }) => {
      setWho(new Map(((data ?? []) as { user_id: string; email: string | null }[]).map((p) => [p.user_id, p.email ?? ''])))
    })
  }, [])

  const moves = usePaged<Move>(
    async ({ from, to }) => {
      let q = supabase.from('stock_movements').select('id,ingredient_id,delta,reason,note,user_id,created_at', { count: 'exact' }).gte('created_at', since(range)).order('id', { ascending: false }).range(from, to)
      if (ing !== 'all') q = q.eq('ingredient_id', ing)
      if (kind !== 'all') q = q.in('reason', REASONS[kind])
      const r = await q
      return { ...r, data: z.array(MoveSchema).safeParse(r.data ?? []).data ?? [] }
    },
    { pageSize: 20, deps: [ing, kind, range], append: true },
  )

  const options = [{ value: 'all', label: 'Semua bahan' }, ...items.map((i) => ({ value: i.id, label: i.name }))]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={ing} onValueChange={(v) => setIng(v ?? 'all')} items={options}>
          <SelectTrigger aria-label="Saring bahan" className="h-12 w-64 text-base"><SelectValue /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <FilterChips id="hist-range" label="Rentang waktu" value={range} onChange={setRange} options={[{ value: 'today', label: 'Hari ini' }, { value: '7d', label: '7 hari' }, { value: '30d', label: '30 hari' }]} />
      </div>
      <FilterChips
        id="hist-kind"
        label="Jenis"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'all', label: 'Semua' },
          { value: 'SALE', label: 'Terjual' },
          { value: 'PURCHASE', label: 'Barang masuk' },
          { value: 'WASTE', label: 'Terbuang' },
          { value: 'COUNT', label: 'Stock opname' },
          { value: 'ADJUST', label: 'Koreksi' },
          { value: 'VOID', label: 'Batal / refund' },
        ]}
      />

      <ul className="divide-y rounded-2xl border-2 bg-card">
        {moves.rows.map((m) => {
          const i = byId.get(m.ingredient_id)
          const k = KIND[m.reason] ?? { label: m.reason, tone: 'bg-muted' }
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="w-28 shrink-0 text-sm text-muted-foreground tabular-nums">{when(m.created_at)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold">{i?.name ?? 'Bahan terhapus'}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {m.note || k.label}
                  {m.user_id && who.get(m.user_id) ? ` · ${who.get(m.user_id)}` : ''}
                </span>
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${k.tone}`}>{k.label}</span>
              <span className={`w-28 text-right text-base font-bold tabular-nums ${m.delta < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {m.delta > 0 ? '+' : '−'}{fmtQty(Math.abs(m.delta))} {i?.unit}
              </span>
            </li>
          )
        })}
      </ul>
      {moves.loading && moves.rows.length === 0 && <RowsSkeleton rows={6} />}
      {!moves.loading && moves.rows.length === 0 && <EmptyState title="Belum ada catatan" hint="Coba ganti rentang waktu atau saringan di atas." />}
      <LoadMore shown={moves.rows.length} total={moves.total} pageSize={moves.pageSize} onMore={moves.more} loading={moves.loading} noun="catatan" />
    </div>
  )
}
