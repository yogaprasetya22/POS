import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

/**
 * Dengarkan kabar langsung (Supabase Realtime Broadcast) yang dikirim trigger database.
 * Dipakai untuk hal yang harus berubah tanpa refresh tetapi tidak bisa memakai postgres_changes
 * (pembeli tidak login, atau baris yang berubah tidak boleh dibaca semua peran).
 */
export function useBroadcast<T = unknown>(topic: string | null, event: string, onMessage: (payload: T) => void) {
  const cb = useRef(onMessage)
  cb.current = onMessage
  useEffect(() => {
    if (!topic) return
    const channel = supabase
      .channel(topic, { config: { broadcast: { self: false } } })
      .on('broadcast', { event }, (m) => cb.current(m.payload as T))
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [topic, event])
}
