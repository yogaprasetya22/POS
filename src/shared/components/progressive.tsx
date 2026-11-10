import type { ReactNode } from 'react'
import { useProgressive } from '@shared/lib/use-progressive'

/** Gambar daftar bertahap (24 item per tahap) dan muat sisanya saat pengguna menggulir ke dasar. Isi `children` = fungsi penggambar. */
export function Progressive<T>({ items, resetKey, step = 24, children }: { items: T[]; resetKey?: string; step?: number; children: (rows: T[]) => ReactNode }) {
  const p = useProgressive(items, { step, resetKey })
  return (
    <>
      {children(p.rows)}
      {p.hasMore && <div ref={p.sentinel} aria-hidden className="col-span-full h-px" />}
    </>
  )
}
