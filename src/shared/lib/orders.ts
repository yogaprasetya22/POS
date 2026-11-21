import { useEffect, useState } from 'react'
import { z } from 'zod'
import { OrderSchema, type Order, type OrderStatus } from '@shared/types/contracts'
import { supabase } from './supabase'

type Change = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: unknown; old: { id?: string } }

/**
 * Terapkan satu perubahan realtime ke daftar: tambah/ganti pesanan yang berubah, buang yang statusnya
 * keluar dari `statuses` atau dihapus. Mengembalikan null bila baris tidak bisa dibaca (pemanggil memuat ulang penuh).
 */
export function applyOrderChange(list: Order[], change: Change, statuses: string[]): Order[] | null {
  if (change.eventType === 'DELETE') return change.old.id ? list.filter((o) => o.id !== change.old.id) : null
  const parsed = OrderSchema.safeParse(change.new)
  if (!parsed.success) return null
  const row = parsed.data
  const rest = list.filter((o) => o.id !== row.id)
  if (!statuses.includes(row.status)) return rest
  const next = [...rest, row]
  next.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return next
}

// ponytail: In-memory cache daftar pesanan aktif agar transisi antar layar kasir/dapur/antrean instan (0ms).
const memoryOrderCache = new Map<string, Order[]>()

/**
 * Daftar order live untuk status tertentu (Kasir & KDS).
 * Dimuat penuh sekali, lalu tiap perubahan hanya memperbarui satu pesanan, jadi tetap ringan saat ramai.
 * Muat ulang penuh hanya setelah koneksi realtime sempat putus, supaya perubahan yang terlewat selama putus tetap masuk.
 */
export function useLiveOrders(statuses: OrderStatus[]) {
  const key = statuses.join(',')
  const [orders, setOrders] = useState<Order[]>(() => memoryOrderCache.get(key) ?? [])
  const [loading, setLoading] = useState(() => !memoryOrderCache.has(key))

  useEffect(() => {
    if (!key) {
      setOrders([])
      setLoading(false)
      return
    }
    let alive = true
    const wanted = key.split(',')
    const load = async () => {
      const { data, error } = await supabase.from('orders').select('*').in('status', wanted).order('created_at')
      if (!alive) return
      if (error) {
        console.error(error)
        setLoading(false)
        return
      }
      const parsed = z.array(OrderSchema).parse(data)
      memoryOrderCache.set(key, parsed)
      setOrders(parsed)
      setLoading(false)
    }

    void load()
    let dropped = false
    const channel = supabase
      // nama unik per pemakai: dua layar dengan status sama (mis. Dapur + pengingat di layout) tidak boleh berbagi channel
      .channel(`orders:${key}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const change = payload as unknown as Change
        // Baris yang tidak bisa dibaca: muat ulang penuh daripada menampilkan data setengah.
        if (change.eventType !== 'DELETE' && !OrderSchema.safeParse(change.new).success) return void load()
        setOrders((list) => {
          const next = applyOrderChange(list, change, wanted) ?? list
          memoryOrderCache.set(key, next)
          return next
        })
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') dropped = true
        else if (status === 'SUBSCRIBED' && dropped) {
          dropped = false
          void load()
        }
      })
    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [key])

  return { orders, loading }
}
