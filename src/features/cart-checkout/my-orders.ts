import { z } from 'zod'

/** Pesanan pembeli disimpan di HP-nya sendiri supaya kode antrean tidak hilang saat halaman di-refresh. */
const Saved = z.object({
  id: z.string(),
  queue_code: z.string(),
  total: z.number(),
  at: z.number(),
  pay_method: z.enum(['QRIS', 'CASHIER']).optional(),
})
export type SavedOrder = z.infer<typeof Saved>

const KEEP_MS = 12 * 60 * 60_000 // 12 jam: cukup untuk satu kunjungan
const key = (storeId: string) => `pos:pesanan-saya:${storeId}`

export function loadMyOrders(storeId: string): SavedOrder[] {
  try {
    const parsed = z.array(Saved).safeParse(JSON.parse(localStorage.getItem(key(storeId)) ?? '[]'))
    return parsed.success ? parsed.data.filter((o) => Date.now() - o.at < KEEP_MS) : []
  } catch {
    return []
  }
}

function write(storeId: string, list: SavedOrder[]) {
  try {
    localStorage.setItem(key(storeId), JSON.stringify(list.slice(0, 5)))
    window.dispatchEvent(new Event('pos:pesanan-saya'))
  } catch {
    /* penyimpanan penuh / mode privat: kartu tetap tampil selama halaman terbuka */
  }
}

export const saveMyOrder = (storeId: string, o: Omit<SavedOrder, 'at'>) =>
  write(storeId, [{ ...o, at: Date.now() }, ...loadMyOrders(storeId).filter((x) => x.id !== o.id)])

export const forgetMyOrder = (storeId: string, id: string) => write(storeId, loadMyOrders(storeId).filter((x) => x.id !== id))
