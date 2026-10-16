import type { BonusItem } from '@shared/lib/promo'
import type { CartLine, Choice, Product } from '@shared/types/contracts'

/** Baris keranjang + data tampilan. Harga di sini hanya preview; server menghitung ulang. */
export type CartItem = CartLine & { key: string; name: string; unit_price: number; image?: string | null }

export const itemKey = (productId: string, choices: Choice[], note: string) =>
  [productId, ...choices.map((c) => `${c.group}:${c.option}`).sort(), note.trim()].join('|')

export const unitPrice = (p: Product, choices: Choice[]) =>
  p.price +
  choices.reduce(
    (sum, c) => sum + (p.modifiers.find((g) => g.name === c.group)?.options.find((o) => o.name === c.option)?.price ?? 0),
    0,
  )

export const addItem = (items: CartItem[], item: CartItem) =>
  items.some((x) => x.key === item.key)
    ? items.map((x) => (x.key === item.key ? { ...x, qty: Math.min(99, x.qty + item.qty) } : x))
    : [...items, item]

export const setItemQty = (items: CartItem[], key: string, qty: number) =>
  qty < 1 ? items.filter((x) => x.key !== key) : items.map((x) => (x.key === key ? { ...x, qty: Math.min(99, qty) } : x))

export const cartTotal = (items: CartItem[]) => items.reduce((s, x) => s + x.unit_price * x.qty, 0)

export const toLines = (items: CartItem[], bonusItem?: BonusItem | null): CartLine[] => {
  const lines: CartLine[] = items.map(({ product_id, qty, choices, note }) => ({ product_id, qty, choices, note }))
  if (bonusItem && bonusItem.qty > 0) {
    lines.push({
      product_id: bonusItem.productId,
      qty: bonusItem.qty,
      choices: bonusItem.choices ?? [],
      note: `[BONUS GRATIS] Promo: ${bonusItem.promoName}`,
    })
  }
  return lines
}
