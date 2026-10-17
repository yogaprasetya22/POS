import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { supabase } from '@shared/lib/supabase'
import { CategorySchema, ProductSchema, PromotionSchema, StoreSchema, type Category, type Product, type Promotion, type Store } from '@shared/types/contracts'

type Catalog = { store: Store; categories: Category[]; products: Product[]; promotions: Promotion[] }

// ponytail: in-memory cache + sessionStorage agar transisi antar-halaman kasir/admin/dapur instan (0ms).
const memoryCatalogCache = new Map<string, Catalog>()
const SESSION_CACHE_PREFIX = 'pos_cat_'

function getCatalogCache(by: 'slug' | 'id', value: string): Catalog | null {
  const key = `${by}:${value}`
  const mem = memoryCatalogCache.get(key)
  if (mem) return mem
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key)
    if (raw) {
      const parsed = JSON.parse(raw) as Catalog
      memoryCatalogCache.set(key, parsed)
      return parsed
    }
  } catch {
    // Abaikan jika parse atau quota gagal
  }
  return null
}

function setCatalogCache(catalog: Catalog) {
  const idKey = `id:${catalog.store.id}`
  const slugKey = `slug:${catalog.store.slug}`
  memoryCatalogCache.set(idKey, catalog)
  memoryCatalogCache.set(slugKey, catalog)
  try {
    const str = JSON.stringify(catalog)
    sessionStorage.setItem(SESSION_CACHE_PREFIX + idKey, str)
    sessionStorage.setItem(SESSION_CACHE_PREFIX + slugKey, str)
  } catch {
    // Abaikan jika quota penyimpanan penuh
  }
}

/** 
 * Katalog satu toko, dicari lewat slug (halaman publik) atau id (halaman staf). value null = belum siap.
 * // ponytail: parallel fetching + SWR cache (0ms instant render, revalidasi di latar belakang tanpa skeleton).
 */
export function useCatalog(by: 'slug' | 'id', value: string | null) {
  const [data, setData] = useState<Catalog | null>(() => (value ? getCatalogCache(by, value) : null))
  const [error, setError] = useState('')

  useEffect(() => {
    if (value) {
      const cached = getCatalogCache(by, value)
      if (cached) setData(cached)
    }
  }, [by, value])

  const fetchCatalog = useCallback(async (active: { current: boolean }) => {
    if (!value) return

    try {
      let store: Store
      let catData: unknown[]
      let prodData: unknown[]
      let promoData: unknown[]

      if (by === 'id') {
        // Optimasi Ponytail: Jika by === 'id', storeId sudah diketahui!
        // Jalankan seluruh 4 query sekaligus secara PARALEL tanpa menunggu query store selesai lebih dulu.
        const [s, c, p, pr] = await Promise.all([
          supabase.from('stores').select('id, slug, name, wa_number, is_active').eq('id', value).maybeSingle(),
          supabase.from('categories').select('*').eq('store_id', value).order('sort'),
          supabase.from('products').select('*').eq('store_id', value).order('sort'),
          supabase.from('promotions').select('*').eq('store_id', value).eq('is_active', true),
        ])
        if (!active.current) return
        if (s.error) return setError(s.error.message)
        if (!s.data) return setError('Toko tidak ditemukan')
        const err = c.error ?? p.error ?? pr.error
        if (err) return setError(err.message)

        store = StoreSchema.parse(s.data)
        catData = c.data ?? []
        prodData = p.data ?? []
        promoData = pr.data ?? []
      } else {
        // Untuk slug publik: cari store dulu, lalu paralel categories, products, promotions
        const s = await supabase.from('stores').select('id, slug, name, wa_number, is_active').eq('slug', value).maybeSingle()
        if (!active.current) return
        if (s.error) return setError(s.error.message)
        if (!s.data) return setError('Toko tidak ditemukan')

        store = StoreSchema.parse(s.data)
        const [c, p, pr] = await Promise.all([
          supabase.from('categories').select('*').eq('store_id', store.id).order('sort'),
          supabase.from('products').select('*').eq('store_id', store.id).order('sort'),
          supabase.from('promotions').select('*').eq('store_id', store.id).eq('is_active', true),
        ])
        if (!active.current) return
        const err = c.error ?? p.error ?? pr.error
        if (err) return setError(err.message)

        catData = c.data ?? []
        prodData = p.data ?? []
        promoData = pr.data ?? []
      }

      const nextCatalog: Catalog = {
        store,
        categories: z.array(CategorySchema).parse(catData),
        products: z.array(ProductSchema).parse(prodData),
        promotions: z.array(PromotionSchema).parse(promoData),
      }

      setError('')
      setCatalogCache(nextCatalog)
      setData(nextCatalog)
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : 'Gagal memuat katalog')
    }
  }, [by, value])

  const reload = useCallback(() => {
    fetchCatalog({ current: true })
  }, [fetchCatalog])

  useEffect(() => {
    const active = { current: true }
    fetchCatalog(active)
    return () => {
      active.current = false
    }
  }, [fetchCatalog])

  return { data, error, reload }
}
