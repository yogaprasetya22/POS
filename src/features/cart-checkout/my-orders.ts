import { z } from 'zod'

/** Pesanan pembeli disimpan di HP-nya sendiri supaya kode antrean tidak hilang saat halaman di-refresh. */
const Saved = z.object({
  id: z.string(),
  queue_code: z.string(),
  total: z.number(),
  at: z.number(),
  pay_method: z.enum(['QRIS', 'CASHIER']).optional(),
  table_no: z.string().nullable().optional(),
  order_type: z.enum(['DINE_IN', 'TAKEAWAY']).optional(),
  is_unpaid: z.boolean().optional(),
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

export const saveMyOrder = (storeId: string, o: Omit<SavedOrder, 'at'>) => {
  const currentList = loadMyOrders(storeId)
  const normNewTable = o.table_no?.trim().toUpperCase()
  // Jika pesanan baru berstatus belum dibayar di meja yang sama (atau sesama takeaway),
  // gantikan pesanan belum dibayar sebelumnya di meja tersebut agar tidak menumpuk.
  const filtered = currentList.filter((x) => {
    if (x.id === o.id) return false
    const normXTable = x.table_no?.trim().toUpperCase()
    const sameTable = normNewTable ? normXTable === normNewTable : (x.order_type === 'TAKEAWAY' || !normXTable)
    // Jika meja sama dan pesanan lama belum dibayar, gantikan dengan pesanan baru
    if (sameTable && x.is_unpaid) return false
    return true
  })
  write(storeId, [{ ...o, at: Date.now() }, ...filtered])
}

export const updateMyOrder = (storeId: string, id: string, patch: Partial<Omit<SavedOrder, 'id'>>) => {
  const list = loadMyOrders(storeId)
  const idx = list.findIndex((x) => x.id === id)
  if (idx === -1) return
  list[idx] = { ...list[idx], ...patch }
  write(storeId, list)
}

export const forgetMyOrder = (storeId: string, id: string) => write(storeId, loadMyOrders(storeId).filter((x) => x.id !== id))
