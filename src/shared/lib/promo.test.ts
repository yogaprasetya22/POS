import { describe, expect, it } from 'vitest'
import type { CartItem } from '@features/cart-checkout/cart'
import type { Product, Promotion } from '@shared/types/contracts'
import { calculatePromo } from './promo'

describe('calculatePromo', () => {
  const dummyProduct: Product = {
    id: '11111111-1111-1111-1111-111111111111',
    category_id: 'cat-1',
    name: 'Kopi Susu Gula Aren',
    sku: 'KOP-01',
    price: 15000,
    is_available: true,
    modifiers: [],
    image_url: null,
    images: [],
    video_url: null,
    sort: 1,
  }

  const dummyItem: CartItem = {
    key: 'item-1',
    product_id: dummyProduct.id,
    name: dummyProduct.name,
    unit_price: 15000,
    qty: 2,
    choices: [],
    note: '',
  }

  it('memberikan diskon Beli 2 Gratis 1 (BUY 2 GET 1) jika memesan 3 item', () => {
    const promo: Promotion = {
      id: 'promo-1',
      store_id: 'store-1',
      name: 'Beli 2 Gratis 1 Kopi Susu',
      type: 'BUY_X_GET_Y',
      scope: 'PRODUCT',
      target_id: dummyProduct.id,
      buy_qty: 2,
      get_qty: 1,
      discount_percent: 0,
      discount_amount: 0,
      min_spend: 0,
      is_active: true,
    }

    // 2 item: belum dapat gratis, tapi ada hint
    const res2 = calculatePromo([{ ...dummyItem, qty: 2 }], [promo], [dummyProduct])
    expect(res2.discount).toBe(0)
    expect(res2.hints.length).toBeGreaterThan(0)
    expect(res2.hints[0]).toContain('Tambah 1 lagi')

    // 3 item: dapat gratis 1 item (potongan Rp15.000)
    const res3 = calculatePromo([{ ...dummyItem, qty: 3 }], [promo], [dummyProduct])
    expect(res3.discount).toBe(15000)
    expect(res3.appliedPromo?.name).toBe('Beli 2 Gratis 1 Kopi Susu')

    // 6 item: dapat gratis 2 item (potongan Rp30.000)
    const res6 = calculatePromo([{ ...dummyItem, qty: 6 }], [promo], [dummyProduct])
    expect(res6.discount).toBe(30000)
  })

  it('menghitung diskon persentase dan diskon nominal dengan benar', () => {
    const percentPromo: Promotion = {
      id: 'promo-percent',
      store_id: 'store-1',
      name: 'Diskon 20%',
      type: 'PERCENTAGE',
      scope: 'CART_TOTAL',
      target_id: null,
      buy_qty: 1,
      get_qty: 1,
      discount_percent: 20,
      discount_amount: 0,
      min_spend: 20000,
      is_active: true,
    }

    // Subtotal 30.000 (2 item x 15.000) -> Diskon 20% = 6.000
    const res = calculatePromo([{ ...dummyItem, qty: 2 }], [percentPromo], [dummyProduct])
    expect(res.discount).toBe(6000)
    expect(res.appliedPromo?.name).toBe('Diskon 20%')
  })
})
