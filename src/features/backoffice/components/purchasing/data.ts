import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { supabase } from '@shared/lib/supabase'

export const SupplierSchema = z.object({ id: z.uuid(), name: z.string(), phone: z.string(), note: z.string(), is_active: z.boolean() })
export type Supplier = z.infer<typeof SupplierSchema>

export const PurchaseSchema = z.object({
  id: z.uuid(),
  supplier: z.string(),
  supplier_id: z.string().nullable(),
  total: z.number(),
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']),
  unpaid: z.number(),
  paid_from: z.string(),
  note: z.string(),
  created_at: z.string(),
  received_at: z.string().nullable(),
})
export type Purchase = z.infer<typeof PurchaseSchema>

export const ItemSchema = z.object({
  id: z.number(),
  purchase_id: z.uuid(),
  ingredient_id: z.uuid(),
  qty: z.coerce.number(),
  unit_price: z.number(),
  received_qty: z.coerce.number().nullable(),
})
export type PurchaseItem = z.infer<typeof ItemSchema>

/** Yang sudah datang; pembelian "Barang masuk" sederhana (null) dianggap datang semua. */
export const received = (i: PurchaseItem) => i.received_qty ?? i.qty
export const remaining = (i: PurchaseItem) => Math.max(0, i.qty - received(i))

export const STATUS: Record<Purchase['status'], { label: string; pill: string }> = {
  DRAFT: { label: 'Belum dipesan', pill: 'bg-muted text-foreground' },
  ORDERED: { label: 'Menunggu barang', pill: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' },
  RECEIVED: { label: 'Sudah diterima', pill: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200' },
  CANCELLED: { label: 'Dibatalkan', pill: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200' },
}

export const day = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' })

/** Pembelian (200 terbaru), barisnya, dan daftar pemasok. */
export function usePurchasing() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const [p, s] = await Promise.all([
      supabase.from('purchases').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('suppliers').select('*').order('name'),
    ])
    const pp = z.array(PurchaseSchema).safeParse(p.data ?? [])
    const ps = z.array(SupplierSchema).safeParse(s.data ?? [])
    if (ps.success) setSuppliers(ps.data)
    if (pp.success) {
      setPurchases(pp.data)
      const ids = pp.data.map((x) => x.id)
      const it = ids.length ? await supabase.from('purchase_items').select('id,purchase_id,ingredient_id,qty,unit_price,received_qty').in('purchase_id', ids) : { data: [] }
      const pi = z.array(ItemSchema).safeParse(it.data ?? [])
      if (pi.success) setItems(pi.data)
    }
    setLoaded(true)
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])

  return { purchases, items, suppliers, loaded, reload }
}
