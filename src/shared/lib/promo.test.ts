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

    // 1 item: belum dapat gratis, ada hint beli 1 lagi
    const res1 = calculatePromo([{ ...dummyItem, qty: 1 }], [promo], [dummyProduct])
    expect(res1.discount).toBe(0)
    expect(res1.hints.length).toBeGreaterThan(0)
    expect(res1.hints[0]).toContain('Beli 1 item lagi')

    // 2 item: otomatis dapat 1 item bonus gratis
    const res2 = calculatePromo([{ ...dummyItem, qty: 2 }], [promo], [dummyProduct])
    expect(res2.bonusItem).not.toBeNull()
    expect(res2.bonusItem?.qty).toBe(1)
    expect(res2.bonusItem?.name).toBe('Kopi Susu Gula Aren')

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

  it('mendukung validasi kode promo voucher', () => {
    const codePromo: Promotion = {
      id: 'promo-code-1',
      store_id: 'store-1',
      name: 'Voucher Gajian Hemat',
      code: 'GAJIAN10',
      type: 'PERCENTAGE',
      scope: 'CART_TOTAL',
      target_id: null,
      buy_qty: 1,
      get_qty: 1,
      discount_percent: 10,
      discount_amount: 0,
      min_spend: 0,
      is_active: true,
    }

    // Tanpa kode promo: diskon tidak terpasang
    const resNoCode = calculatePromo([{ ...dummyItem, qty: 2 }], [codePromo], [dummyProduct])
    expect(resNoCode.discount).toBe(0)
    expect(resNoCode.appliedPromo).toBeNull()

    // Kode salah: invalid
    const resWrongCode = calculatePromo([{ ...dummyItem, qty: 2 }], [codePromo], [dummyProduct], 'SALAHKODE')
    expect(resWrongCode.discount).toBe(0)
    expect(resWrongCode.codeStatus).toBe('INVALID')

    // Kode benar: valid dan diskon terpasang (10% dari 30.000 = 3.000)
    const resValidCode = calculatePromo([{ ...dummyItem, qty: 2 }], [codePromo], [dummyProduct], 'gajian10')
    expect(resValidCode.discount).toBe(3000)
    expect(resValidCode.codeStatus).toBe('VALID')
    expect(resValidCode.appliedPromo?.name).toBe('Voucher Gajian Hemat')
  })

  it('memfilter promo berdasarkan batas periode kampanye', () => {
    const periodPromo: Promotion = {
      id: 'promo-period-1',
      store_id: 'store-1',
      name: 'Promo Akhir Pekan',
      type: 'FIXED_AMOUNT',
      scope: 'CART_TOTAL',
      target_id: null,
      buy_qty: 1,
      get_qty: 1,
      discount_percent: 0,
      discount_amount: 5000,
      min_spend: 0,
      start_at: '2026-10-15T00:00:00.000Z',
      end_at: '2026-10-17T23:59:59.000Z',
      is_active: true,
    }

    // Di dalam periode kampanye (16 Oktober 2026)
    const activeDate = new Date('2026-10-16T12:00:00.000Z')
    const resActive = calculatePromo([{ ...dummyItem, qty: 2 }], [periodPromo], [dummyProduct], null, activeDate)
    expect(resActive.discount).toBe(5000)

    // Sebelum kampanye dimulai (14 Oktober 2026)
    const earlyDate = new Date('2026-10-14T12:00:00.000Z')
    const resEarly = calculatePromo([{ ...dummyItem, qty: 2 }], [periodPromo], [dummyProduct], null, earlyDate)
    expect(resEarly.discount).toBe(0)

    // Setelah kampanye berakhir (18 Oktober 2026)
    const lateDate = new Date('2026-10-18T12:00:00.000Z')
    const resLate = calculatePromo([{ ...dummyItem, qty: 2 }], [periodPromo], [dummyProduct], null, lateDate)
    expect(resLate.discount).toBe(0)
  })
})
