import { describe, expect, it } from 'vitest'
import { CheckoutSchema, type Product } from '@shared/types/contracts'
import { addItem, itemKey, setItemQty, toLines, unitPrice, type CartItem } from './cart'

const product: Product = {
  id: '6f1c2b8e-3d4a-4b5c-9d6e-7f8091a2b3c4',
  category_id: null,
  name: 'Es Kopi',
  sku: null,
  price: 18000,
  is_available: true,
  portions: null,
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

  it('toLines menyertakan bonus item gratis ke dalam baris pesanan', () => {
    const item: CartItem = { key: '1', product_id: product.id, qty: 2, choices: [], note: '', name: 'Es Kopi', unit_price: 18000 }
    const linesWithoutBonus = toLines([item])
    expect(linesWithoutBonus).toHaveLength(1)

    const linesWithBonus = toLines([item], {
      productId: product.id,
      name: 'Es Kopi',
      qty: 1,
      unitPrice: 18000,
      promoName: 'Beli 2 Gratis 1',
    })
    expect(linesWithBonus).toHaveLength(2)
    expect(linesWithBonus[1].product_id).toBe(product.id)
    expect(linesWithBonus[1].qty).toBe(1)
    expect(linesWithBonus[1].note).toContain('[BONUS GRATIS]')
  })
})

describe('checkout', () => {
  const base = { customer_name: 'Budi', table_no: '', lines: [{ product_id: product.id, qty: 1, choices: [], note: '' }] }
  it('dine-in wajib nomor meja', () => {
    expect(CheckoutSchema.safeParse({ ...base, order_type: 'DINE_IN' }).success).toBe(false)
    expect(CheckoutSchema.safeParse({ ...base, order_type: 'TAKEAWAY' }).success).toBe(true)
  })
})
