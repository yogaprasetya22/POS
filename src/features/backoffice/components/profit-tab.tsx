import { useEffect, useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { RowsSkeleton } from '@shared/components/skeletons'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'

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
  const tiles: [string, string, string][] = [
    ['Penjualan menu', rupiah(data.revenue), ''],
    ['Modal bahan', rupiah(data.cogs), ''],
    ['Untung kotor', `${rupiah(profit)}${data.revenue > 0 ? ` (${Math.round((profit / data.revenue) * 100)}%)` : ''}`, 'text-emerald-700 dark:text-emerald-400'],
    ['Bahan terbuang', rupiah(data.waste_value), data.waste_value > 0 ? 'text-red-700 dark:text-red-400' : ''],
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border-2 bg-card px-4 py-3">
            <p className="text-base font-semibold text-muted-foreground">{label}</p>
            <p className={`text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>
      <p className="text-base text-muted-foreground">
        Modal dihitung dari resep tiap menu dikali harga beli bahan saat ini. Belum termasuk diskon, pajak, gaji, dan sewa.
        {noRecipe > 0 && ` ${noRecipe} menu belum punya resep, jadi modalnya terhitung Rp0. Isi resepnya di Stok bahan.`}
      </p>
      {data.items.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed p-6 text-center text-base text-muted-foreground">Belum ada penjualan di rentang tanggal ini. Coba pilih rentang yang lebih panjang.</p>
      ) : (
        <ul className="divide-y rounded-2xl border-2 bg-card">
          {data.items.map((i) => {
            const u = i.revenue - i.cogs
            return (
              <li key={i.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{i.name}</p>
                  <p className="text-base text-muted-foreground">
                    {i.qty} terjual · jual {rupiah(i.revenue)} · {i.has_recipe ? `modal ${rupiah(i.cogs)}` : 'belum ada resep'}
                  </p>
                </div>
                <p className={`shrink-0 text-right text-lg font-extrabold tabular-nums ${u < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {u < 0 ? '−' : ''}{rupiah(Math.abs(u))}
                  {i.revenue > 0 && <span className="block text-sm font-semibold text-muted-foreground">{Math.round((u / i.revenue) * 100)}% untung</span>}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
