import { describe, expect, it } from 'vitest'
import type { Order } from '@shared/types/contracts'
import { applyOrderChange } from './orders'

const row = (id: string, status: string, created_at: string) => ({
  id, queue_code: id, business_day: '2026-11-13', customer_name: 'X', order_type: 'TAKEAWAY', table_no: null,
  items: [], total: 1000, status, created_at, payment_method: null, cash_received: null, paid_at: null,
})
const ACTIVE = ['UNPAID', 'IN_KITCHEN', 'READY']
const ids = (l: Order[] | null) => l?.map((o) => o.id)
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('applyOrderChange', () => {
  const base = applyOrderChange([], { eventType: 'INSERT', new: row(A, 'UNPAID', '2026-11-13T10:00:00Z'), old: {} }, ACTIVE)!

  it('menambah pesanan baru sesuai urutan waktu', () => {
    const next = applyOrderChange(base, { eventType: 'INSERT', new: row(B, 'UNPAID', '2026-11-13T09:00:00Z'), old: {} }, ACTIVE)
    expect(ids(next)).toEqual([B, A])
  })

  it('mengganti pesanan yang berubah dan membuang yang statusnya keluar', () => {
    const upd = applyOrderChange(base, { eventType: 'UPDATE', new: row(A, 'READY', '2026-11-13T10:00:00Z'), old: { id: A } }, ACTIVE)
    expect(upd?.[0].status).toBe('READY')
    expect(applyOrderChange(base, { eventType: 'UPDATE', new: row(A, 'COMPLETED', '2026-11-13T10:00:00Z'), old: { id: A } }, ACTIVE)).toEqual([])
  })

  it('menghapus pesanan dan menandai baris rusak', () => {
    expect(applyOrderChange(base, { eventType: 'DELETE', new: {}, old: { id: A } }, ACTIVE)).toEqual([])
    expect(applyOrderChange(base, { eventType: 'UPDATE', new: { id: A }, old: { id: A } }, ACTIVE)).toBeNull()
  })
})
