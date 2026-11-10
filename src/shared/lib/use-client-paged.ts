import { useEffect, useMemo, useState } from 'react'

/**
 * Pagination di sisi klien untuk data yang memang sudah ada di memori (katalog, promo, daftar toko):
 * hanya satu halaman yang digambar, sehingga DOM tetap kecil walau datanya ratusan.
 * Halaman kembali ke 1 saat `resetKey` berubah (filter/pencarian) dan mundur otomatis bila data menyusut.
 */
export function useClientPaged<T>(items: T[], { pageSize = 24, resetKey = '' }: { pageSize?: number; resetKey?: string } = {}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => setPage(1), [resetKey])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const rows = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize])
  return { rows, page, setPage, pageCount, total: items.length, pageSize }
}
