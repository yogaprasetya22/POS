import { useEffect, useState } from 'react'
import { z } from 'zod'
import { OrderSchema, type Order, type OrderStatus } from '@shared/types/contracts'
import { supabase } from './supabase'

/** Daftar order live untuk status tertentu (Kasir & KDS). */
export function useLiveOrders(statuses: OrderStatus[]) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const key = statuses.join(',')

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data, error } = await supabase.from('orders').select('*').in('status', key.split(',')).order('created_at')
      if (error) {
        console.error(error)
        if (alive) setLoading(false)
        return
      }
      if (alive) {
        setOrders(z.array(OrderSchema).parse(data))
        setLoading(false)
      }
    }
    load()
    // shortcut: refetch penuh tiap perubahan, cukup untuk 1 outlet; ganti ke patch payload jika order/hari ribuan
    const channel = supabase
      .channel(`orders:${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [key])

  return { orders, loading }
}

