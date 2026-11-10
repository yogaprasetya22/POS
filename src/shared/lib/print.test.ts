import { describe, expect, it } from 'vitest'
import { OrderSchema } from '@shared/types/contracts'
import { escposKitchenTicket, escposReceipt, escposTestPage, previewKitchenTicket, previewReceipt, previewTestPage } from './print'
import { previewToText } from './print-preview'

const ID = '00000000-0000-4000-8000-000000000001'
const base = {
  id: ID,
  queue_code: 'A-007',
  business_day: '2026-11-09',
  customer_name: 'Budi Santoso',
  order_type: 'DINE_IN',
  table_no: 'T3',
  items: [
    { product_id: ID, name: 'Kopi Susu Gula Aren', qty: 2, unit_price: 18000, subtotal: 36000, choices: [{ group: 'Suhu', option: 'Es', price: 0 }], note: 'tanpa gula' },
    { product_id: ID, name: 'Nasi Goreng Spesial Seafood Pedas Level Tiga', qty: 1, unit_price: 28000, subtotal: 28000, choices: [], note: '' },
  ],
  subtotal: 64000,
  discount_amount: 6400,
  promo_name: 'Diskon 10%',
  service_amount: 2880,
  tax_amount: 6336,
  rounding_amount: -16,
  total: 66800,
  status: 'IN_KITCHEN',
  payment_method: 'CASH',
  cash_received: 100000,
  points_earned: 6,
  created_at: '2026-11-09T05:00:00Z',
  paid_at: '2026-11-09T05:01:00Z',
}
const order = OrderSchema.parse(base)
const store = { name: 'Warkop Contoh', address: 'Jl. Contoh No. 1, Jakarta', footer: 'Makasih ya!' }

describe('struk ESC/POS (ReceiptPrinterEncoder)', () => {
  it('byte diawali inisialisasi printer dan diakhiri perintah potong kertas', () => {
    const b = escposReceipt(order, store, 32)
    expect(Array.from(b.slice(0, 2))).toEqual([0x1b, 0x40]) // ESC @
    const tail = Array.from(b.slice(-6))
    expect(tail.join(',')).toContain('29,86') // GS V (potong)
  })

  it('struk memuat rincian uang dan teks toko', () => {
    const t = previewToText(previewReceipt(order, store, 32))
    for (const s of ['Warkop Contoh', 'A-007', 'Rp66.800', 'Pajak', 'Service', 'Pembulatan', 'Kembali', 'Rp33.200', 'Makasih ya!', 'Poin didapat: +6']) expect(t).toContain(s)
  })

  it('tiap baris tidak melebihi lebar kertas 58 mm dan 80 mm', () => {
    for (const w of [32, 48] as const) for (const l of previewReceipt(order, store, w)) expect(l.text.length * (l.kind === 'text' ? 1 : 0)).toBeLessThanOrEqual(w)
  })

  it('nama item panjang membungkus, tidak terpotong', () => {
    const t = previewToText(previewReceipt(order, store, 32))
    // kata tidak hilang walau dibungkus ke beberapa baris
    for (const w of ['Nasi', 'Goreng', 'Spesial', 'Seafood', 'Pedas', 'Level', 'Tiga']) expect(t).toContain(w)
    expect(t.split('\n').filter((l) => l.includes('Rp28.000'))).toHaveLength(1)
  })

  it('huruf beraksen tampil benar dan karakter yang tak didukung jadi "?" tanpa error', () => {
    const o = { ...order, customer_name: 'Café Ñandú ☕ “x”' }
    const t = previewToText(previewReceipt(o, store, 32))
    expect(t).toContain('Café Ñandú')
    expect(t).toContain('?')
    expect(() => escposReceipt(o, store, 32)).not.toThrow()
  })

  it('struk bertanda tebal pada TOTAL dan nama toko', () => {
    const lines = previewReceipt(order, store, 32)
    expect(lines.find((l) => l.text.includes('Warkop Contoh'))?.bold).toBe(true)
    expect(lines.find((l) => l.text.startsWith('TOTAL'))?.bold).toBe(true)
    expect(lines.find((l) => l.text.startsWith('Subtotal'))?.bold).toBe(false)
  })

  it('tiket dapur: kode antrean besar, catatan tampil, tanpa harga', () => {
    const lines = previewKitchenTicket(order, 32)
    expect(lines.find((l) => l.text.includes('A-007'))?.scale).toBe(2)
    const t = previewToText(lines)
    expect(t).toContain('2x Kopi Susu Gula Aren')
    expect(t).toContain('Catatan: tanpa gula')
    expect(t).not.toContain('Rp')
    expect(escposKitchenTicket(order, 32).length).toBeGreaterThan(50)
  })

  it('pembayaran non-tunai tidak menampilkan kembalian', () => {
    const o = OrderSchema.parse({ ...base, payment_method: 'QRIS_STATIC', cash_received: null })
    const t = previewToText(previewReceipt(o, store, 32))
    expect(t).toContain('QRIS')
    expect(t).not.toContain('Kembali')
  })
})

// Golden file: tampilan struk contoh dikunci. Kalau sengaja mengubah format struk, jalankan `bun run test -u` dan tinjau selisihnya.
describe('golden struk', () => {
  it('struk 58 mm', () => expect(previewToText(previewReceipt(order, store, 32))).toMatchSnapshot())
  it('struk 80 mm', () => expect(previewToText(previewReceipt(order, store, 48))).toMatchSnapshot())
  it('tiket dapur 58 mm', () => expect(previewToText(previewKitchenTicket(order, 32))).toMatchSnapshot())
})


describe('lembar uji kalibrasi', () => {
  it('menghasilkan byte dan pratinjau yang cocok dengan lebar yang dipilih', () => {
    for (const cols of [32, 35, 42, 44, 48]) {
      const text = previewToText(previewTestPage(cols))
      expect(text).toContain('CETAK TES PRINTER')
      expect(escposTestPage(cols).length).toBeGreaterThan(50)
      for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(cols)
    }
  })
})
