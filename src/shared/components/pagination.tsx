import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
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
/** Nomor halaman untuk tabel (laporan, transaksi, catatan): tombol berlabel, teks besar, posisi jelas. */
export function Pagination({ page, pageCount, total, pageSize, onPage, loading }: Props) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <nav aria-label="Halaman" className={`flex flex-wrap items-center justify-between gap-3 pt-3 ${loading ? 'opacity-60' : ''}`}>
      <p className="text-base text-muted-foreground">
        {from.toLocaleString('id-ID')}–{to.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')}
        {pageCount > 1 && <span className="font-semibold text-foreground"> · Halaman {page} dari {pageCount}</span>}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-12 border-2 px-4 text-base" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft /> Sebelumnya
          </Button>
          <div className="hidden items-center gap-1 lg:flex">
            {pages(page, pageCount).map((p, i) =>
              p === '…' ? (
                <span key={`gap${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button key={p} variant={p === page ? 'default' : 'ghost'} className="size-12 px-0 text-base" aria-label={`Halaman ${p}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
                  {p}
                </Button>
              ),
            )}
          </div>
          <Button variant="outline" className="h-12 border-2 px-4 text-base" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            Berikutnya <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  )
}

/**
 * Tombol "Tampilkan lebih banyak" untuk daftar kartu/baris (bukan tabel): lebih mudah dari nomor halaman
 * dan daftar yang sudah terbuka tetap terlihat. `shown` = jumlah yang sudah tampil.
 */
export function LoadMore({ shown, total, pageSize, onMore, loading, noun = 'data' }: { shown: number; total: number; pageSize: number; onMore: () => void; loading?: boolean; noun?: string }) {
  if (total === 0 || shown === 0) return null
  const left = Math.max(0, total - shown)
  return (
    <div className="space-y-2 pt-3 text-center">
      <p className="text-base text-muted-foreground">
        {left > 0 ? `Menampilkan ${shown.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} ${noun}` : `Semua ${total.toLocaleString('id-ID')} ${noun} sudah tampil`}
      </p>
      {left > 0 && (
        <Button variant="outline" disabled={loading} className="h-12 w-full border-2 text-base font-bold sm:w-auto sm:px-10" onClick={onMore}>
          <ChevronDown /> {loading ? 'Memuat…' : `Tampilkan ${Math.min(pageSize, left).toLocaleString('id-ID')} ${noun} lagi`}
        </Button>
      )}
    </div>
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
