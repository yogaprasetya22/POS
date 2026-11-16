import { useCallback, useEffect, useState } from 'react'
import { fetchAll } from '@shared/lib/fetch-all'
import { z } from 'zod'
import { supabase } from '@shared/lib/supabase'
import { fetchCatalogBySlug } from '@shared/lib/api'
import { useBroadcast } from '@shared/lib/live'
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
          supabase.from('stores').select('id, slug, name, wa_number, is_active, theme, buyer_template, logo_url, tagline').eq('id', value).maybeSingle(),
          supabase.from('categories').select('*').eq('store_id', value).order('sort'),
          fetchAll((a, b) => supabase.from('products').select('*').eq('store_id', value).order('sort').order('id').range(a, b)),
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
        // Slug publik: satu panggilan /api/catalog (cache CDN)
        const viaApi = await fetchCatalogBySlug(value)
        if (!active.current) return
        store = StoreSchema.parse(viaApi.store)
        catData = viaApi.categories
        prodData = viaApi.products
        promoData = viaApi.promotions
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

  // Menu habis/tersedia & sisa porsi berubah langsung, tanpa refresh (pembeli dan layar Jualan)
  useBroadcast<{ id: string; is_available: boolean; portions: number | null }>(data ? `store:${data.store.id}` : null, 'product', (p) => {
    setData((d) => {
      if (!d || !d.products.some((x) => x.id === p.id)) return d
      const next = { ...d, products: d.products.map((x) => (x.id === p.id ? { ...x, is_available: p.is_available, portions: p.portions } : x)) }
      setCatalogCache(next)
      return next
    })
  })

  return { data, error, reload }
}
