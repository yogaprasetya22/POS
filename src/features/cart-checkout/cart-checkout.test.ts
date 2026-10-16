import { describe, expect, it } from 'vitest'
import { CheckoutSchema, type Product } from '@shared/types/contracts'
import { addItem, itemKey, setItemQty, unitPrice, type CartItem } from './cart'
import { buildWaText, waUrl } from './wa-message'

const product: Product = {
  id: '6f1c2b8e-3d4a-4b5c-9d6e-7f8091a2b3c4',
  category_id: null,
  name: 'Es Kopi',
  sku: null,
  price: 18000,
  is_available: true,
  modifiers: [
    { name: 'Gula', required: true, multiple: false, options: [{ name: 'Normal', price: 0 }, { name: 'Less', price: 0 }] },
    { name: 'Topping', required: false, multiple: true, options: [{ name: 'Boba', price: 5000 }, { name: 'Jelly', price: 3000 }] },
  ],
  image_url: null,
  images: [],
  video_url: null,
  sort: 0,
}

describe('cart', () => {
  it('menjumlahkan harga modifier', () => {
    expect(unitPrice(product, [{ group: 'Topping', option: 'Boba' }, { group: 'Topping', option: 'Jelly' }])).toBe(26000)
  })

  it('menggabungkan item identik tanpa peduli urutan pilihan, dan batas qty 99', () => {
    const a = itemKey(product.id, [{ group: 'A', option: '1' }, { group: 'B', option: '2' }], 'x')
    const b = itemKey(product.id, [{ group: 'B', option: '2' }, { group: 'A', option: '1' }], ' x ')
    expect(a).toBe(b)
    const item: CartItem = { key: a, product_id: product.id, qty: 60, choices: [], note: '', name: 'x', unit_price: 1 }
    const items = addItem(addItem([], item), item)
    expect(items).toHaveLength(1)
    expect(items[0].qty).toBe(99)
    expect(setItemQty(items, a, 0)).toHaveLength(0)
  })
})

describe('checkout', () => {
  const base = { customer_name: 'Budi', table_no: '', lines: [{ product_id: product.id, qty: 1, choices: [], note: '' }] }
  it('dine-in wajib nomor meja', () => {
    expect(CheckoutSchema.safeParse({ ...base, order_type: 'DINE_IN' }).success).toBe(false)
    expect(CheckoutSchema.safeParse({ ...base, order_type: 'TAKEAWAY' }).success).toBe(true)
  })
})

describe('wa message', () => {
  it('memuat kode antrean, item, dan total', () => {
    const text = buildWaText({
      queue_code: 'A-042',
      customer_name: 'Budi',
      order_type: 'DINE_IN',
      table_no: '5',
      total: 46000,
      items: [{ name: 'Es Kopi', qty: 2, unit_price: 23000, note: 'tanpa es', choices: [{ option: 'Boba' }] }],
    })
    expect(text).toContain('*PESANAN A-042*')
    expect(text).toContain('Meja 5')
    expect(text).toContain('2x Es Kopi (Boba) — Rp46.000')
    expect(text).toContain('Catatan: tanpa es')
    expect(waUrl('628123', text)).toMatch(/^https:\/\/wa\.me\/628123\?text=\*PESANAN%20A-042/)
  })
})
