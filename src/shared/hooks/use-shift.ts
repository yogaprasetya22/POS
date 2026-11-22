import { useCallback, useEffect, useState } from 'react'
import { rpc } from '@shared/lib/api'
import { useStaff } from '@shared/lib/auth'
import { useBroadcast } from '@shared/lib/live'
import { ShiftStatusSchema, ShiftSummarySchema, type ShiftStatus, type ShiftSummary } from '@shared/types/contracts'

/**
 * Shift kasir: `shift` = shift terbuka milik user ini; `status` = siapa yang memegang laci toko saat ini
 * dan uang serah terima dari shift sebelumnya (untuk modal awal & pesan "serahkan dulu").
 */
export function useShift(enabled = true) {
  const [shift, setShift] = useState<ShiftSummary | null>(null)
  const [status, setStatus] = useState<ShiftStatus | null>(null)
  const [loading, setLoading] = useState(enabled)

  const reload = useCallback(async () => {
    if (!enabled) return setLoading(false)
    const [mine, st] = await Promise.all([rpc('shift_summary'), rpc('shift_status')])
    const m = ShiftSummarySchema.safeParse(mine.data)
    const s = ShiftStatusSchema.safeParse(st.data)
    setShift(m.success ? m.data : null)
    setStatus(s.success ? s.data : null)
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  // laci dibuka/ditutup dari perangkat lain: status ikut berubah tanpa refresh
  const { storeId } = useStaff()
  useBroadcast(enabled && storeId ? `store:${storeId}` : null, 'shift', () => void reload())

  return { shift, status, loading, reload }
}
