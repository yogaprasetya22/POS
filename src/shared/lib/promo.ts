import type { CartItem } from '@features/cart-checkout/cart'
import type { Product, Promotion } from '@shared/types/contracts'

export type PromoCalculation = {
  discount: number
  appliedPromo: Promotion | null
  hints: string[]
}

/**
 * Kalkulasi diskon promo terbaik secara deterministik di client-side.
 * Logika ini 100% selaras dengan RPC `calculate_order_promo` di database Postgres.
 */
export function calculatePromo(
  items: CartItem[],
  promotions: Promotion[] = [],
  products: Product[] = []
): PromoCalculation {
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  if (items.length === 0 || promotions.length === 0) {
    return { discount: 0, appliedPromo: null, hints: [] }
  }

  let bestDiscount = 0
  let bestPromo: Promotion | null = null
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
      const remainder = totalQty % bundleSize
      if (remainder === p.buy_qty && totalQty > 0) {
        hints.push(`Tambah ${p.get_qty} lagi untuk gratis ${p.get_qty} (${p.name})!`)
      }

      if (totalQty >= bundleSize && subtotal >= (p.min_spend ?? 0)) {
        const minPrice = Math.min(...matchingItems.map((i) => i.unit_price))
        const freeSets = Math.floor(totalQty / bundleSize)
        const disc = freeSets * p.get_qty * minPrice
        if (disc > bestDiscount) {
          bestDiscount = disc
          bestPromo = p
        }
      }
    } else if (p.type === 'PERCENTAGE') {
      if (subtotal >= (p.min_spend ?? 0)) {
        const base = p.scope === 'CART_TOTAL' ? subtotal : matchingSubtotal
        const disc = Math.floor((base * p.discount_percent) / 100)
        if (disc > bestDiscount) {
          bestDiscount = disc
          bestPromo = p
        }
      }
    } else if (p.type === 'FIXED_AMOUNT') {
      if (subtotal >= (p.min_spend ?? 0)) {
        const disc = p.scope === 'CART_TOTAL' ? p.discount_amount : matchingItems.length > 0 ? p.discount_amount : 0
        if (disc > bestDiscount) {
          bestDiscount = disc
          bestPromo = p
        }
      }
    }
  }

  return {
    discount: Math.min(bestDiscount, subtotal),
    appliedPromo: bestPromo,
    hints: Array.from(new Set(hints)),
  }
}
