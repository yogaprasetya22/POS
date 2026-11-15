import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ShiftName = { id: string; name: string; sort_order: number; is_active: boolean }

/** Daftar nama shift toko (diatur pemilik di Pengaturan toko → Shift). */
export function useShiftNames() {
  const [names, setNames] = useState<ShiftName[]>([])
  const [loaded, setLoaded] = useState(false)
  const reload = useCallback(async () => {
    const { data } = await supabase.from('shift_names').select('id,name,sort_order,is_active').order('sort_order')
    setNames((data ?? []) as ShiftName[])
    setLoaded(true)
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { names, active: names.filter((n) => n.is_active), loaded, reload }
}
