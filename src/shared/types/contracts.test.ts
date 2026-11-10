import { describe, expect, it } from 'vitest'
import { QuoteSchema, ROLE_LABEL, StaffRoleSchema, can } from './contracts'

describe('izin per role (tampilan UI; database tetap penentu akhir)', () => {
  const roles = StaffRoleSchema.options
  it('semua role punya label', () => {
    for (const r of roles) expect(ROLE_LABEL[r]).toBeTruthy()
  })

  it('hanya owner/manager/kasir yang bisa menerima pembayaran', () => {
    expect(roles.filter((r) => can.pay(r))).toEqual(['owner', 'manager', 'cashier'])
    expect(can.pay(null)).toBe(false)
  })

  it('pelayan tidak bisa bayar tapi bisa mengelola pesanan; dapur hanya layar dapur', () => {
    expect(can.pay('waiter')).toBe(false)
    expect(can.floor('waiter')).toBe(true)
    expect(can.kitchen('kitchen')).toBe(true)
    expect(can.floor('kitchen')).toBe(false)
    expect(can.manage('kitchen')).toBe(false)
  })

  it('pengaturan toko & tim khusus owner; laporan untuk owner dan manager', () => {
    expect(roles.filter((r) => can.ownerOnly(r))).toEqual(['owner'])
    expect(roles.filter((r) => can.manage(r))).toEqual(['owner', 'manager'])
  })
})

describe('QuoteSchema', () => {
  it('menerima hasil quote_order dan menolak total negatif', () => {
    const ok = { subtotal: 50000, promo_discount: 0, promo_name: null, voucher_id: null, voucher_discount: 0, points_redeemed: 0, points_discount: 0, points_earned: 5, service: 0, tax: 5000, rounding: 0, total: 55000 }
    expect(QuoteSchema.safeParse(ok).success).toBe(true)
    expect(QuoteSchema.safeParse({ ...ok, total: -1 }).success).toBe(false)
  })
})
