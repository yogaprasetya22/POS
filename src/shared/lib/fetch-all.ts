type Page<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Ambil semua baris per 1.000 (batas bawaan PostgREST). Tanpa ini, tabel yang lebih besar terpotong diam-diam.
 * `build` harus memakai urutan yang stabil (mis. .order('sort').order('id')) supaya halaman tidak bertukar baris.
 */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<Page<T>>, size = 1000): Promise<Page<T>> {
  const all: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1)
    if (error) return { data: null, error }
    all.push(...(data ?? []))
    if (!data || data.length < size) return { data: all, error: null }
  }
}
