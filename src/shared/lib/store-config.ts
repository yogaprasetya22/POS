import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@shared/lib/supabase'
import { StoreConfigSchema, type StoreConfig } from '@shared/types/contracts'

// '*': kolom baru (mis. use_kitchen_screen) ikut terbaca tanpa merusak bila migrasinya belum dijalankan; schema mengisi default.
const COLUMNS = '*'
const cache = new Map<string, StoreConfig>()

/** Pengaturan uang/struk/langganan toko. Cache in-memory; `reload` setelah owner mengubah pengaturan. */
export function useStoreConfig(storeId: string | null) {
  const [config, setConfig] = useState<StoreConfig | null>(storeId ? (cache.get(storeId) ?? null) : null)

  const reload = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase.from('stores').select(COLUMNS).eq('id', storeId).maybeSingle()
    const parsed = StoreConfigSchema.safeParse(data)
    if (parsed.success) {
      cache.set(storeId, parsed.data)
      setConfig(parsed.data)
    }
  }, [storeId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { config, reload }
}

export const loyaltyOn = (c: StoreConfig | null) => !!c && c.points_earn_per > 0

/** Sisa hari langganan; null = tanpa batas. Negatif = sudah berakhir. */
export function planDaysLeft(c: StoreConfig | null): number | null {
  if (!c?.plan_expires_at) return null
  return Math.ceil((new Date(c.plan_expires_at).getTime() - Date.now()) / 86_400_000)
}
