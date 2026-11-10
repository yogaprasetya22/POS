import { SkeletonContainer } from '@shared/components/ui/skeleton-container'
import { cn } from '@shared/lib/utils'

/**
 * Blok skeleton siap pakai di atas SkeletonContainer. Isinya elemen p/span/div sungguhan dengan teks
 * contoh; SkeletonContainer yang mengubahnya jadi balok abu berdenyut, jadi bentuknya mengikuti UI asli.
 */

/** Baris daftar/tabel: avatar bulat, dua baris teks, angka di kanan. */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <SkeletonContainer isLoading className={cn('divide-y', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className="block size-8 shrink-0 rounded-full">A</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="w-40 max-w-full text-sm">Nama pelanggan</p>
            <p className="w-64 max-w-full text-xs">Keterangan singkat transaksi</p>
          </div>
          <span className="block w-20 text-sm">Rp000.000</span>
        </div>
      ))}
    </SkeletonContainer>
  )
}

/** Ubin angka ringkas (StatTile / kartu ringkasan). */
export function StatTilesSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <SkeletonContainer isLoading className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <p className="w-24 text-sm">Label ringkas</p>
          <p className="mt-1 w-32 text-2xl">Rp0.000.000</p>
          <p className="mt-0.5 w-28 text-xs">keterangan angka</p>
        </div>
      ))}
    </SkeletonContainer>
  )
}

/** Grid kartu (meja, bahan, voucher). */
export function CardGridSkeleton({ count = 8, minWidth = '11.5rem', tall = false }: { count?: number; minWidth?: string; tall?: boolean }) {
  return (
    <SkeletonContainer isLoading>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))` }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-3 rounded-xl border bg-card p-4">
            {tall && <span className="block size-32 rounded-lg">QR</span>}
            <p className="w-20 text-xl">Meja T1</p>
            <p className="w-28 text-sm">Keterangan kartu</p>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  )
}

/** Area grafik. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonContainer isLoading className={className}>
      <span className="block h-[250px] w-full rounded-md">grafik</span>
    </SkeletonContainer>
  )
}

/** Satu bar status setinggi bar shift kasir. */
export function BarSkeleton() {
  return (
    <SkeletonContainer isLoading>
      <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
        <p className="w-72 max-w-full">Shift terbuka sejak 00.00 kas diharapkan Rp0</p>
        <span className="block h-9 w-40 rounded-full">Kas dan tutup shift</span>
      </div>
    </SkeletonContainer>
  )
}
