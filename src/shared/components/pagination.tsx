import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'

type Props = { page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void; loading?: boolean }

/** Daftar nomor halaman ringkas: 1 … 4 [5] 6 … 20 */
function pages(page: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const set = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

/** Footer daftar: "Menampilkan 26–50 dari 1.240" + tombol halaman (target sentuh 44px). Tersembunyi bila hanya satu halaman. */
export function Pagination({ page, pageCount, total, pageSize, onPage, loading }: Props) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <nav aria-label="Halaman" className={`flex flex-wrap items-center justify-between gap-3 pt-3 ${loading ? 'opacity-60' : ''}`}>
      <p className="text-sm text-muted-foreground">
        Menampilkan {from.toLocaleString('id-ID')}–{to.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-11" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft />
          </Button>
          <span className="px-2 text-sm text-muted-foreground sm:hidden">{page} / {pageCount}</span>
          <div className="hidden items-center gap-1 sm:flex">
            {pages(page, pageCount).map((p, i) =>
              p === '…' ? (
                <span key={`gap${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button key={p} variant={p === page ? 'default' : 'ghost'} className="size-11 px-0" aria-label={`Halaman ${p}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
                  {p}
                </Button>
              ),
            )}
          </div>
          <Button variant="outline" size="icon" className="size-11" aria-label="Halaman berikutnya" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  )
}

/** Kotak pencarian standar daftar. */
export function SearchBox({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-11 pl-9 pr-10" />
      {value && (
        <button type="button" aria-label="Hapus pencarian" className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-muted-foreground" onClick={() => onChange('')}>
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Keadaan kosong standar: pesan + (opsional) aksi. */
export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  )
}
