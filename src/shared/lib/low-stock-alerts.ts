import { useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { ding } from './new-order-toast'
import { supabase } from './supabase'

const Row = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  stock: z.coerce.number(),
  min_stock: z.coerce.number(),
  is_active: z.boolean(),
})

// Jumlah bahan hampir habis/habis, dibagikan ke tanda angka (badge) di navigasi dan halaman Lainnya.
let lowCount = 0
const subs = new Set<() => void>()
const setLow = (n: number) => {
  if (n === lowCount) return
  lowCount = n
  subs.forEach((f) => f())
}
/** Jumlah bahan aktif yang stoknya di/bawah batas minimum. 0 bila peringatan stok tidak aktif untuk pengguna ini. */
export const useLowStockCount = () =>
  useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => lowCount)

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 3 })

/**
 * Toast + bunyi saat sebuah bahan turun ke/di bawah stok minimum. Satu kali per bahan; muncul lagi hanya bila
 * stoknya sempat naik di atas minimum (mis. setelah barang masuk) lalu turun lagi.
 */
export function useLowStockAlerts(enabled: boolean, canOpenStock: boolean) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const last = new Map<string, number>() // stok terakhir yang diketahui per bahan
    const low = new Set<string>()
    const mark = (i: z.infer<typeof Row>) => {
      if (i.is_active && i.min_stock > 0 && i.stock <= i.min_stock) low.add(i.id)
      else low.delete(i.id)
      setLow(low.size)
    }

    void supabase.from('ingredients').select('id,name,unit,stock,min_stock,is_active').then(({ data }) => {
      const p = z.array(Row).safeParse(data ?? [])
      if (!alive || !p.success) return
      for (const i of p.data) {
        last.set(i.id, i.stock)
        mark(i)
      }
    })

    const channel = supabase
      .channel(`ingredients:low:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, (payload) => {
        const i = Row.safeParse(payload.new)
        if (!i.success) return
        mark(i.data)
        const prev = last.get(i.data.id)
        last.set(i.data.id, i.data.stock)
        const crossed = prev !== undefined && prev > i.data.min_stock && i.data.stock <= i.data.min_stock
        if (!crossed || !i.data.is_active || i.data.min_stock <= 0) return
        ding()
        toast.warning(i.data.stock <= 0 ? `${i.data.name} habis` : `${i.data.name} hampir habis`, {
          id: `low-${i.data.id}`,
          description: `Sisa ${fmt(Math.max(i.data.stock, 0))} ${i.data.unit} (batas minimum ${fmt(i.data.min_stock)} ${i.data.unit}). Segera belanja.`,
          duration: 15_000,
          ...(canOpenStock ? { action: { label: 'Lihat stok', onClick: () => navigate('/admin/stok') } } : {}),
        })
      })
      .subscribe()
    return () => {
      alive = false
      setLow(0)
      supabase.removeChannel(channel)
    }
  }, [enabled, canOpenStock, navigate])
}
