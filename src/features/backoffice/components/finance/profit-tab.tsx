import { m } from 'motion/react'
import { useEffect, useState } from 'react'
import { rowMotion } from '@shared/components/motion'
import { ErrorAlert } from '@shared/components/error-alert'
import { RowsSkeleton } from '@shared/components/skeletons'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import { KpiCard, KpiGrid, Panel } from '../analytics/kit'

type Item = { name: string; qty: number; revenue: number; cogs: number; has_recipe: boolean }
type Profit = { revenue: number; cogs: number; waste_value: number; items: Item[] }

/** Tab Untung: penjualan menu − modal bahan (resep × harga beli sekarang), per menu. */
export function ProfitTab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Profit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setData(null)
    void rpc('profit_report', { p_from: from, p_to: to }).then(({ data: d, error: err }) => {
      if (!alive) return
      if (err) return setError(`${err.message} Coba ganti rentang tanggal atau muat ulang.`)
      setError('')
      setData(d as Profit)
    })
    return () => {
      alive = false
    }
  }, [from, to])

  if (error) return <ErrorAlert message={error} />
  if (!data) return <RowsSkeleton rows={6} />
  const profit = data.revenue - data.cogs
  const noRecipe = data.items.filter((i) => !i.has_recipe).length
  const margin = data.revenue > 0 ? Math.round((profit / data.revenue) * 100) : 0
  const best = Math.max(1, ...data.items.map((i) => Math.abs(i.revenue - i.cogs)))

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard index={0} label="Penjualan menu" value={rupiah(data.revenue)} title={`${data.items.reduce((n, i) => n + i.qty, 0).toLocaleString('id-ID')} porsi terjual`} hint={`${data.items.length} menu`} />
        <KpiCard index={1} label="Modal bahan" value={rupiah(data.cogs)} title={data.revenue > 0 ? `${100 - margin}% dari penjualan` : 'Belum ada penjualan'} hint="Resep × harga beli bahan" />
        <KpiCard
          index={2}
          label="Untung kotor"
          value={rupiah(profit)}
          tone={profit < 0 ? 'bad' : 'good'}
          badge={data.revenue > 0 ? <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${profit < 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{margin}%</span> : undefined}
          title="Penjualan − modal bahan"
          hint="Belum dikurangi gaji & sewa"
        />
        <KpiCard index={3} label="Bahan terbuang" value={rupiah(data.waste_value)} tone={data.waste_value > 0 ? 'bad' : undefined} title={data.waste_value > 0 ? 'Bahan rusak / basi / tumpah' : 'Tidak ada bahan terbuang'} hint="Dicatat di Stok bahan" />
      </KpiGrid>
      <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        Modal dihitung dari resep tiap menu dikali harga beli bahan saat ini. Belum termasuk diskon, pajak, gaji, dan sewa.
        {noRecipe > 0 && ` ${noRecipe} menu belum punya resep, jadi modalnya terhitung Rp0. Isi resepnya di Stok bahan.`}
      </p>
      {data.items.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed p-6 text-center text-base text-muted-foreground">Belum ada penjualan di rentang tanggal ini. Coba pilih rentang yang lebih panjang.</p>
      ) : (
        <Panel title="Untung per menu" description="Diurutkan dari untung terbesar" flush>
          <ol className="divide-y">
            {[...data.items].sort((x, y) => y.revenue - y.cogs - (x.revenue - x.cogs)).map((i, idx) => {
              const u = i.revenue - i.cogs
              const pct = i.revenue > 0 ? Math.round((u / i.revenue) * 100) : 0
              const bad = u < 0
              return (
                <m.li key={i.name} {...rowMotion} transition={{ ...rowMotion.transition, delay: Math.min(idx, 12) * 0.02 }} className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
                  <span className={`grid size-8 place-items-center rounded-full text-sm font-bold tabular-nums ${idx < 3 && !bad ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold">{i.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {i.qty.toLocaleString('id-ID')} terjual · jual {rupiah(i.revenue)} · {i.has_recipe ? `modal ${rupiah(i.cogs)}` : 'belum ada resep'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-extrabold tabular-nums ${bad ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{bad ? '−' : ''}{rupiah(Math.abs(u))}</p>
                    {i.revenue > 0 && <p className="text-sm font-semibold text-muted-foreground tabular-nums">{pct}% untung</p>}
                  </div>
                  {/* batang: besar untung dibanding menu teratas */}
                  <div className="col-start-2 col-end-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <m.div
                      className={`h-full origin-left rounded-full ${bad ? 'bg-red-500' : 'bg-emerald-500'}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: Math.abs(u) / best }}
                      transition={{ type: 'spring', stiffness: 160, damping: 26, delay: Math.min(idx, 12) * 0.03 }}
                    />
                  </div>
                </m.li>
              )
            })}
          </ol>
        </Panel>
      )}
    </div>
  )
}
