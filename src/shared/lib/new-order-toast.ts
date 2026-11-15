import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { supabase } from './supabase'

const NewOrder = z.object({
  id: z.string(),
  queue_code: z.string(),
  customer_name: z.string(),
  order_type: z.string(),
  table_no: z.string().nullable(),
  created_by: z.string().nullable(),
})

/** Bunyi "ting" pendek supaya kasir sadar walau sedang tidak melihat layar. Diam saja bila browser menolak. */
export function ding() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => void ctx.close()
  } catch {
    /* audio tidak tersedia */
  }
}

/**
 * Toast "Pesanan masuk" untuk staf kasir/pelayan di layar mana pun.
 * Pesanan yang dibuat sendiri tidak diberi tahu (sudah tahu). RLS memastikan hanya pesanan toko sendiri yang sampai.
 */
export function useNewOrderToast(enabled: boolean, userId: string) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel(`orders:new-toast:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const o = NewOrder.safeParse(payload.new)
        if (!o.success || o.data.created_by === userId) return
        const { queue_code, customer_name, order_type, table_no, created_by } = o.data
        const where = order_type === 'DINE_IN' ? `Meja ${table_no}` : 'Bawa pulang'
        ding()
        toast(`Pesanan masuk · ${queue_code}`, {
          description: `${customer_name} · ${where} · ${created_by === null ? 'dari pelanggan' : 'dari kasir lain'}`,
          duration: 8000,
          action: { label: 'Lihat', onClick: () => navigate('/antrean') },
        })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, userId, navigate])
}
