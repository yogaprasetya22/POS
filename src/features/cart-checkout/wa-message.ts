import type { OrderType } from '@shared/types/contracts'
import { rupiah } from '@shared/lib/utils'

type WaOrder = {
  queue_code: string
  customer_name: string
  order_type: OrderType
  table_no: string
  total: number
  subtotal?: number
  discount_amount?: number
  promo_name?: string | null
  items: { name: string; qty: number; unit_price: number; note: string; choices: { option: string }[] }[]
}

export function buildWaText(o: WaOrder) {
  const lines = o.items.map((i) => {
    const opts = i.choices.length ? ` (${i.choices.map((c) => c.option).join(', ')})` : ''
    const note = i.note ? `\n   Catatan: ${i.note}` : ''
    return `• ${i.qty}x ${i.name}${opts} — ${rupiah(i.unit_price * i.qty)}${note}`
  })

  const discountLines =
    (o.discount_amount ?? 0) > 0
      ? [
          `Subtotal: ${rupiah(o.subtotal ?? o.total + (o.discount_amount ?? 0))}`,
          `Promo (${o.promo_name ?? 'Diskon'}): -${rupiah(o.discount_amount!)}`,
        ]
      : []

  return [
    `*PESANAN ${o.queue_code}*`,
    `Nama: ${o.customer_name}`,
    o.order_type === 'DINE_IN' ? `Makan di tempat, Meja ${o.table_no}` : 'Bawa pulang',
    '',
    ...lines,
    '',
    ...discountLines,
    `*Total: ${rupiah(o.total)}*`,
    '',
    `Sebutkan kode *${o.queue_code}* di kasir untuk membayar.`,
  ].join('\n')
}

export const waUrl = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`
