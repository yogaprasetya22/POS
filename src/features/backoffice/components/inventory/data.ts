import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { supabase } from '@shared/lib/supabase'

export const IngredientSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  unit: z.string(),
  stock: z.coerce.number(),
  min_stock: z.coerce.number(),
  cost: z.coerce.number(),
  is_active: z.boolean(),
  purchase_unit: z.string().default(''),
  purchase_factor: z.coerce.number().default(1),
})
export type Ingredient = z.infer<typeof IngredientSchema>

const RecipeSchema = z.object({ product_id: z.uuid(), ingredient_id: z.uuid(), qty: z.coerce.number() })
export type Recipe = z.infer<typeof RecipeSchema>

const BarcodeSchema = z.object({ code: z.string(), ingredient_id: z.uuid() })
export type Barcode = z.infer<typeof BarcodeSchema>

export type Level = 'ok' | 'low' | 'out'
/** Status stok dalam bahasa sehari-hari. */
export const levelOf = (i: Ingredient): Level => (i.stock <= 0 ? 'out' : i.stock <= i.min_stock ? 'low' : 'ok')
export const LEVEL: Record<Level, { label: string; pill: string }> = {
  ok: { label: 'Aman', pill: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200' },
  low: { label: 'Hampir habis', pill: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' },
  out: { label: 'Habis', pill: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200' },
}

export const fmtQty = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 3 })
/** Satuan saat membeli; tanpa satuan beli = satuan pakai. */
export const buyUnit = (i: Ingredient) => i.purchase_unit || i.unit
/** Isi satu kemasan (untuk 1 kali scan): satuan beli bila ada, selain itu 1 satuan pakai. */
export const packQty = (i: Ingredient) => (i.purchase_unit ? i.purchase_factor : 1)
export const onlyNum = (v: string) => v.replace(/[^\d.]/g, '')

/** Bahan, resep, dan barcode toko. Dimuat sekali untuk keempat tab Inventory Stock. */
export function useInventory() {
  const [items, setItems] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [barcodes, setBarcodes] = useState<Barcode[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const [i, r, b] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('recipes').select('product_id,ingredient_id,qty'),
      supabase.from('ingredient_barcodes').select('code,ingredient_id'),
    ])
    const pi = z.array(IngredientSchema).safeParse(i.data ?? [])
    const pr = z.array(RecipeSchema).safeParse(r.data ?? [])
    const pb = z.array(BarcodeSchema).safeParse(b.data ?? [])
    if (pi.success) setItems(pi.data)
    if (pr.success) setRecipes(pr.data)
    if (pb.success) setBarcodes(pb.data)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, recipes, barcodes, loaded, reload: load }
}
