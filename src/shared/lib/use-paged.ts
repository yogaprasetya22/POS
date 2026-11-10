import { useCallback, useEffect, useRef, useState } from 'react'

type Result<T> = { data: T[] | null; count: number | null; error: { message: string } | null }
/** Ambil satu halaman (range 0-based, inklusif) dari server; `search` sudah dijeda 300 ms. */
export type PageFetcher<T> = (range: { from: number; to: number }, search: string) => PromiseLike<Result<T>>

/**
 * Pagination di server: hanya satu halaman yang diunduh, total dari `count: 'exact'`.
 * `deps` mengembalikan ke halaman 1 saat filter dari luar berubah.
 */
export function usePaged<T>(fetcher: PageFetcher<T>, { pageSize = 25, deps = [] }: { pageSize?: number; deps?: unknown[] } = {}) {
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const depKey = JSON.stringify(deps)
  useEffect(() => setPage(1), [depKey])

  useEffect(() => {
    const mine = ++seq.current
    setLoading(true)
    void Promise.resolve(fetchRef.current({ from: (page - 1) * pageSize, to: page * pageSize - 1 }, query)).then(({ data, count, error: err }) => {
      if (mine !== seq.current) return
      setLoading(false)
      if (err) return setError(err.message)
      setError('')
      setRows(data ?? [])
      setTotal(count ?? 0)
    })
  }, [page, query, pageSize, depKey, tick])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // data berkurang (mis. item terakhir dihapus): mundur ke halaman terakhir yang masih ada
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { rows, total, page, setPage, pageSize, pageCount, search, setSearch, loading, error, reload }
}
