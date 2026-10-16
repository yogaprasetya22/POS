import type { CartItem } from '@features/cart-checkout/cart'
import type { Product, Promotion } from '@shared/types/contracts'

export type BonusItem = {
  productId: string
  name: string
  qty: number
  unitPrice: number
  promoName: string
  choices?: { group: string; option: string }[]
}

export type PromoCalculation = {
  discount: number
  appliedPromo: Promotion | null
  bonusItem: BonusItem | null
  hints: string[]
}

/**
 * Kalkulasi diskon promo terbaik secara deterministik di client-side.
 * Mendukung B2G1 (baik auto-bonus saat beli 2 maupun potongan harga saat memesan paket 3),
 * diskon persentase, dan potongan nominal.
 */
export function calculatePromo(
  items: CartItem[],
  promotions: Promotion[] = [],
  products: Product[] = []
): PromoCalculation {
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  if (items.length === 0 || promotions.length === 0) {
    return { discount: 0, appliedPromo: null, bonusItem: null, hints: [] }
  }

  let bestDiscount = 0
  let bestPromo: Promotion | null = null
  let bestBonus: BonusItem | null = null
  const hints: string[] = []

  const prodMap = new Map(products.map((p) => [p.id, p]))

  for (const p of promotions) {
    if (!p.is_active) continue

    const matchingItems = items.filter((item) => {
      if (p.scope === 'CART_TOTAL') return true
      if (p.scope === 'PRODUCT') return item.product_id === p.target_id
      if (p.scope === 'CATEGORY') {
        const prod = prodMap.get(item.product_id)
        return prod?.category_id === p.target_id
      }
      return false
    })

    const totalQty = matchingItems.reduce((n, i) => n + i.qty, 0)
    const matchingSubtotal = matchingItems.reduce((n, i) => n + i.unit_price * i.qty, 0)

    if (p.type === 'BUY_X_GET_Y') {
      const bundleSize = p.buy_qty + p.get_qty

      // Kasus A: Pelanggan memesan paket lengkap (misal 3 item di keranjang untuk B2G1)
      if (totalQty >= bundleSize && subtotal >= (p.min_spend ?? 0)) {
        const minPrice = Math.min(...matchingItems.map((i) => i.unit_price))
        const freeSets = Math.floor(totalQty / bundleSize)
        const disc = freeSets * p.get_qty * minPrice
        if (disc > bestDiscount) {
          bestDiscount = disc
          bestPromo = p
          bestBonus = null
        }
      }
      // Kasus B: Pelanggan memesan kelipatan buy_qty (misal 2 item di keranjang untuk B2G1), otomatis dapat 1 menu bonus gratis!
      else if (totalQty >= p.buy_qty && subtotal >= (p.min_spend ?? 0)) {
        const freeSets = Math.floor(totalQty / p.buy_qty)
        const bonusQty = freeSets * p.get_qty
        const targetProd = matchingItems[0]
        if (targetProd) {
          bestPromo = p
          bestBonus = {
            productId: targetProd.product_id,
            name: targetProd.name,
            qty: bonusQty,
            unitPrice: targetProd.unit_price,
            promoName: p.name,
            choices: targetProd.choices,
          }
        }
      } else if (totalQty > 0 && totalQty < p.buy_qty) {
        hints.push(`Beli ${p.buy_qty - totalQty} item lagi untuk promo ${p.name}!`)
      }
    } else if (p.type === 'PERCENTAGE') {
      if (subtotal >= (p.min_spend ?? 0)) {
        const base = p.scope === 'CART_TOTAL' ? subtotal : matchingSubtotal
        const disc = Math.floor((base * p.discount_percent) / 100)
        if (disc > bestDiscount) {
          bestDiscount = disc
          bestPromo = p
          bestBonus = null
        }
      } else if (p.min_spend > 0 && (p.scope === 'CART_TOTAL' || matchingItems.length > 0)) {
        hints.push(`Tambah belanja Rp${(p.min_spend - subtotal).toLocaleString('id-ID')} lagi untuk promo ${p.name}!`)
      }
    } else if (p.type === 'FIXED_AMOUNT') {
      if (subtotal >= (p.min_spend ?? 0)) {
        const disc = p.scope === 'CART_TOTAL' ? p.discount_amount : matchingItems.length > 0 ? p.discount_amount : 0
        if (disc > bestDiscount) {
          bestDiscount = disc
          bestPromo = p
          bestBonus = null
        }
      } else if (p.min_spend > 0 && (p.scope === 'CART_TOTAL' || matchingItems.length > 0)) {
        hints.push(`Tambah belanja Rp${(p.min_spend - subtotal).toLocaleString('id-ID')} lagi untuk promo ${p.name}!`)
      }
    }
  }

  return {
    discount: Math.min(bestDiscount, subtotal),
    appliedPromo: bestPromo,
    bonusItem: bestBonus,
    hints: Array.from(new Set(hints)),
  }
}
