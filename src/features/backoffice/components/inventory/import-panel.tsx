import { FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { rpc } from '@shared/lib/api'
import type { Product } from '@shared/types/contracts'
import type { Ingredient } from './data'
import { parseWorkbook, type ImportResult } from './excel'

/** Import Excel: pilih file → pratinjau (berapa baru/diperbarui, baris yang salah) → Simpan. Semua atau batal semua. */
export function ImportPanel({ items, products, onClose, onDone }: { items: Ingredient[]; products: Product[]; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setError('')
    setReading(true)
    try {
      setResult(await parseWorkbook(f, items, products))
    } catch {
      setError('File tidak bisa dibaca. Pastikan file berformat .xlsx dari tombol "Unduh template Excel".')
    }
    setReading(false)
  }

  const added = result?.ingredients.filter((i) => result.isNew(i.name)).length ?? 0
  const updated = (result?.ingredients.length ?? 0) - added
  const ok = !!result && result.issues.length === 0 && (result.ingredients.length > 0 || result.recipes.length > 0)

  const save = async () => {
    if (!result) return
    setBusy(true)
    setError('')
    const { data, error: err } = await rpc('import_inventory', { p_ingredients: result.ingredients, p_recipes: result.recipes })
    setBusy(false)
    if (err) return setError(err.message)
    const r = data as { added: number; updated: number; recipes: number; barcodes: number }
    toast.success(`Import selesai · ${r.added} bahan baru · ${r.updated} diperbarui · ${r.recipes} baris resep${r.barcodes ? ` · ${r.barcodes} barcode` : ''}`)
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title="Import Excel"
      description="Tambah atau perbarui bahan dan resep sekaligus dari file template."
      maxWidth="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button size="lg" className="h-12 w-full text-base font-bold" disabled={!ok || busy} onClick={save}>
            {busy ? 'Menyimpan…' : 'Simpan hasil import'}
          </Button>
        </div>
      }
    >
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center hover:bg-muted">
        <FileSpreadsheet className="size-8 text-primary" aria-hidden />
        <span className="text-base font-bold">{file ? file.name : 'Pilih file Excel (.xlsx)'}</span>
        <span className="text-sm text-muted-foreground">{file ? 'Ketuk untuk ganti file' : 'Belum punya? Tutup ini lalu tekan “Unduh template Excel”.'}</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>

      {reading && <p className="text-base text-muted-foreground">Membaca file…</p>}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Bahan baru', added],
              ['Bahan diperbarui', updated],
              ['Baris resep', result.recipes.length],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl border-2 p-3">
                <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                <p className="text-2xl font-extrabold tabular-nums">{n}</p>
              </div>
            ))}
          </div>

          {result.issues.length > 0 ? (
            <div className="space-y-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-2 text-base font-bold text-destructive">
                <TriangleAlert className="size-5" aria-hidden /> {result.issues.length} baris perlu diperbaiki di file, lalu pilih ulang filenya
              </p>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-base">
                {result.issues.map((i, n) => (
                  <li key={n}>
                    <span className="font-semibold">Sheet {i.sheet}, baris {i.row}:</span> {i.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : ok ? (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-base font-semibold text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
              <Upload className="size-5" aria-hidden /> Semua baris benar. Tekan “Simpan hasil import”.
            </p>
          ) : (
            <p className="text-base text-muted-foreground">File tidak berisi bahan atau resep. Isi sheet Bahan atau Resep terlebih dahulu.</p>
          )}
          <p className="text-sm text-muted-foreground">Stok bahan yang sudah ada tidak diubah. Bahan dan resep yang tidak ada di file tetap seperti sekarang.</p>
        </div>
      )}
    </Panel>
  )
}
