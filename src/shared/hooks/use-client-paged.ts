import { useEffect, useMemo, useState } from 'react'

/**
 * Pagination di sisi klien untuk data yang memang sudah ada di memori (katalog, promo, daftar toko):
 * hanya satu halaman yang digambar, sehingga DOM tetap kecil walau datanya ratusan.
 * Halaman kembali ke 1 saat `resetKey` berubah (filter/pencarian) dan mundur otomatis bila data menyusut.
 */
export function useClientPaged<T>(items: T[], { pageSize = 24, resetKey = '', append = false }: { pageSize?: number; resetKey?: string; append?: boolean } = {}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => setPage(1), [resetKey])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  // append: daftar bertambah ke bawah ("Tampilkan lebih banyak"); tanpa append: satu halaman saja
  const rows = useMemo(() => items.slice(append ? 0 : (page - 1) * pageSize, page * pageSize), [items, page, pageSize, append])
  const more = () => setPage((p) => Math.min(p + 1, pageCount))
  return { rows, page, setPage, pageCount, total: items.length, pageSize, more, hasMore: page < pageCount }
}
