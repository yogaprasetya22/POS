import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { supabase } from '@shared/lib/supabase'
import { CategorySchema, ProductSchema, PromotionSchema, StoreSchema, type Category, type Product, type Promotion, type Store } from '@shared/types/contracts'

type Catalog = { store: Store; categories: Category[]; products: Product[]; promotions: Promotion[] }

/** 
 * Katalog satu toko, dicari lewat slug (halaman publik) atau id (halaman staf). value null = belum siap.
 * // ponytail: proteksi race condition menggunakan closure lokal standar tanpa hook useIsMounted berlebih.
 */
export function useCatalog(by: 'slug' | 'id', value: string | null) {
  const [data, setData] = useState<Catalog | null>(null)
  const [error, setError] = useState('')

  const fetchCatalog = useCallback(async (active: { current: boolean }) => {
    if (!value) return
    const s = await supabase.from('stores').select('id, slug, name, wa_number, is_active').eq(by, value).maybeSingle()
    if (!active.current) return
    if (s.error) return setError(s.error.message)
    if (!s.data) return setError('Toko tidak ditemukan')
    const store = StoreSchema.parse(s.data)

    const [c, p, pr] = await Promise.all([
      supabase.from('categories').select('*').eq('store_id', store.id).order('sort'),
      supabase.from('products').select('*').eq('store_id', store.id).order('sort'),
      supabase.from('promotions').select('*').eq('store_id', store.id).eq('is_active', true),
    ])
    if (!active.current) return
    const err = c.error ?? p.error ?? pr.error
    if (err) return setError(err.message)
    setError('')
    setData({
      store,
      categories: z.array(CategorySchema).parse(c.data),
      products: z.array(ProductSchema).parse(p.data),
      promotions: z.array(PromotionSchema).parse(pr.data ?? []),
    })
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
