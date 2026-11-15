import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { Order, OrderStatus, StoreConfig } from '@shared/types/contracts'
import { rpc } from './api'
import { useLiveOrders } from './orders'

const WATCH: OrderStatus[] = ['IN_KITCHEN', 'READY']
const SNOOZE_MS = 5 * 60_000

const place = (o: Order) => (o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang')
/** Menit sejak pesanan masuk dapur (dibayar). */
export const cookingMinutes = (o: Order, now: number) => Math.floor((now - new Date(o.paid_at ?? o.created_at).getTime()) / 60_000)

/** Sudah dibayar tapi belum sampai ke pelanggan, lebih lama dari perkiraan masak: perlu dicek. */
export const isOverdue = (o: Order, now: number, cook: number) => (o.status === 'IN_KITCHEN' || o.status === 'READY') && cookingMinutes(o, now) >= cook

/**
 * Peringatan dapur untuk kasir/pelayan:
 * - Layar dapur NYALA: toast "A-009 siap diambil" saat dapur menandai siap.
 * - Layar dapur MATI: pengingat bila pesanan dimasak lebih lama dari `cook_minutes`,
 *   dengan pilihan "Sudah siap" atau "Ingatkan 5 menit lagi".
 */
export function useKitchenAlerts(enabled: boolean, config: StoreConfig | null) {
  const navigate = useNavigate()
  const { orders, loading } = useLiveOrders(enabled ? WATCH : [])
  const prev = useRef<Map<string, OrderStatus> | null>(null)
  const nextRemind = useRef(new Map<string, number>())
  const useScreen = config?.use_kitchen_screen ?? true
  const cook = config?.cook_minutes ?? 15
  // jam berjalan: jumlah "perlu dicek" di navigasi ikut naik tanpa menunggu pesanan berubah
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Pesanan berubah menjadi "Siap diambil" (layar dapur nyala)
  useEffect(() => {
    if (!enabled || loading) return
    const before = prev.current
    prev.current = new Map(orders.map((o) => [o.id, o.status]))
    if (!before || !useScreen) return // muatan pertama: jangan bunyikan pesanan lama
    for (const o of orders) {
      if (o.status === 'READY' && before.get(o.id) === 'IN_KITCHEN') {
        toast.success(`${o.queue_code} siap diambil`, {
          id: `ready-${o.id}`,
          description: `${o.customer_name} · ${place(o)}`,
          duration: 10_000,
          action: { label: 'Lihat', onClick: () => navigate('/antrean') },
        })
      }
    }
  }, [enabled, loading, orders, useScreen, navigate])

  // Pengingat masak (layar dapur mati)
  useEffect(() => {
    if (!enabled || useScreen) return
    const check = () => {
      const now = Date.now()
      for (const o of orders) {
        if (o.status !== 'IN_KITCHEN') continue
        const mins = cookingMinutes(o, now)
        if (mins < cook || now < (nextRemind.current.get(o.id) ?? 0)) continue
        nextRemind.current.set(o.id, now + SNOOZE_MS) // ditutup tanpa memilih: ingatkan lagi 5 menit kemudian
        toast.warning(`${o.queue_code} dibayar ${mins} menit lalu, sudah siap?`, {
          id: `cook-${o.id}`,
          description: `${o.customer_name} · ${place(o)}. Cek ke dapur.`,
          duration: Infinity,
          action: {
            label: 'Sudah siap',
            onClick: async () => {
              const { error } = await rpc('advance_order', { p_order_id: o.id, p_to: 'READY' })
              if (error) toast.error(`${o.queue_code} belum bisa ditandai siap`, { description: `${error.message} Coba lagi dari halaman Antrean.` })
            },
          },
          cancel: { label: 'Ingatkan 5 mnt lagi', onClick: () => nextRemind.current.set(o.id, Date.now() + SNOOZE_MS) },
        })
      }
      // bersihkan pesanan yang sudah tidak dimasak
      for (const id of nextRemind.current.keys()) if (!orders.some((o) => o.id === id && o.status === 'IN_KITCHEN')) {
        nextRemind.current.delete(id)
        toast.dismiss(`cook-${id}`)
      }
    }
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [enabled, useScreen, cook, orders])
  /** Jumlah pesanan lewat waktu: tetap tampil di tombol Antrean setelah notifikasi ditutup. */
  return enabled ? orders.filter((o) => isOverdue(o, now, cook)).length : 0
}
