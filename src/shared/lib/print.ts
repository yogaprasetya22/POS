import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import { PAYMENT_LABEL, type Order } from '@shared/types/contracts'
import { toPreview } from './print-preview'
import { logoPixels } from './receipt-logo'
import { rupiah, timeJakarta } from './utils'

/** Info toko untuk kepala/kaki struk. */
/** logo: data URL dari pengaturan toko; dicetak bila pikselnya sudah dimuat (loadLogo). */
export type ReceiptStore = { name: string; address?: string; footer?: string; logo?: string }

const num = (key: string, fallback: number, min: number, max: number) => {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) && n >= min && n <= max && localStorage.getItem(key) !== null ? Math.round(n) : fallback
  } catch {
    return fallback
  }
}
const save = (key: string, n: number) => {
  try {
    localStorage.setItem(key, String(n))
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

/** Kalibrasi per perangkat (disimpan di browser ini, bukan di server). */
/** Lebar baris yang didukung encoder ESC/POS. */
export const CHAR_WIDTHS = [32, 35, 42, 44, 48] as const
export const PRINTER_LIMITS = { baud: [1200, 921600], feed: [0, 12] } as const
export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const

/** Lebar kertas dalam karakter per baris: 32 = 58 mm, 48 = 80 mm (pilihan: 32, 35, 42, 44, 48). */
export const getPaperChars = () => {
  const n = num('pos_paper_chars', 32, 32, 48)
  return (CHAR_WIDTHS as readonly number[]).includes(n) ? n : 32
}
export const setPaperChars = (n: number) => save('pos_paper_chars', n)
export const getBaudRate = () => num('pos_printer_baud', 9600, ...PRINTER_LIMITS.baud)
export const setBaudRate = (n: number) => save('pos_printer_baud', n)
/** Baris kosong sebelum pisau memotong; naikkan jika potongan mengenai teks terakhir. */
export const getFeedBeforeCut = () => num('pos_printer_feed', 4, ...PRINTER_LIMITS.feed)
export const setFeedBeforeCut = (n: number) => save('pos_printer_feed', n)

// --- ESC/POS lewat ReceiptPrinterEncoder (penerus esc-pos-encoder; MIT, teruji komunitas) ---
const where = (o: Order) => (o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang')

function encoder(columns: number) {
  // autoFlush:false supaya hasil bisa dibaca sebagai byte (kirim ke printer) maupun baris (pratinjau)
  return new ReceiptPrinterEncoder({ columns, language: 'esc-pos', autoFlush: false, feedBeforeCut: getFeedBeforeCut(), errors: 'relaxed' })
}

/** Dua kolom: label di kiri (boleh membungkus), nilai rata kanan. */
function rows(e: ReceiptPrinterEncoder, columns: number, data: [string, string][]) {
  e.table([{ width: 'auto', overflow: 'wrap' }, { width: columns >= 48 ? 14 : 12, align: 'right' }], data)
}

const dash = (e: ReceiptPrinterEncoder, columns: number) => e.line('-'.repeat(columns))

function buildReceipt(order: Order, store: ReceiptStore, columns: number) {
  const e = encoder(columns).initialize()
  const logo = logoPixels(store.logo)
  if (logo) e.align('center').image(logo, logo.width, logo.height, 'threshold')
  e.align('center').bold(true).line(store.name).bold(false)
  if (store.address) e.line(store.address)
  e.align('left')
  dash(e, columns)
  rows(e, columns, [
    ['Antrean', order.queue_code],
    ['Nama', order.customer_name],
    ['Meja', where(order)],
    ['Tanggal', order.business_day],
    ...(order.paid_at ? ([['Jam', timeJakarta(order.paid_at)]] as [string, string][]) : []),
  ])
  dash(e, columns)
  for (const i of order.items) {
    rows(e, columns, [[`${i.qty}x ${i.name}`, rupiah(i.subtotal)]])
    if (i.choices.length) e.line('  ' + i.choices.map((c) => c.option).join(', '))
  }
  dash(e, columns)
  const money: [string, string][] = [['Subtotal', rupiah(order.subtotal || order.total + order.discount_amount)]]
  if (order.discount_amount > 0) money.push([order.promo_name || 'Diskon', '-' + rupiah(order.discount_amount)])
  if (order.voucher_discount > 0) money.push(['Voucher', '-' + rupiah(order.voucher_discount)])
  if (order.points_discount > 0) money.push([`Poin (${order.points_redeemed})`, '-' + rupiah(order.points_discount)])
  if (order.service_amount > 0) money.push(['Service', rupiah(order.service_amount)])
  if (order.tax_amount > 0) money.push(['Pajak', rupiah(order.tax_amount)])
  if (order.rounding_amount !== 0) money.push(['Pembulatan', (order.rounding_amount < 0 ? '-' : '') + rupiah(Math.abs(order.rounding_amount))])
  rows(e, columns, money)
  e.bold(true)
  rows(e, columns, [['TOTAL', rupiah(order.total)]])
  e.bold(false)
  const pay: [string, string][] = []
  if (order.payment_method) pay.push(['Bayar', PAYMENT_LABEL[order.payment_method]])
  if (order.payment_method === 'CASH' && order.cash_received != null) {
    pay.push(['Tunai', rupiah(order.cash_received)], ['Kembali', rupiah(order.cash_received - order.total)])
  }
  if (pay.length) rows(e, columns, pay)
  if (order.points_earned > 0) e.line(`Poin didapat: +${order.points_earned}`)
  dash(e, columns)
  e.align('center').line(store.footer || 'Terima kasih!')
  return e.cut('partial')
}

function buildKitchenTicket(order: Order, columns: number) {
  const e = encoder(columns).initialize()
  e.align('center').bold(true).size(2).line(order.queue_code).size(1).bold(false)
  e.line(where(order)).line(order.customer_name)
  e.align('left')
  dash(e, columns)
  for (const i of order.items) {
    e.bold(true).line(`${i.qty}x ${i.name}`).bold(false)
    if (i.choices.length) e.line('  ' + i.choices.map((c) => c.option).join(', '))
    if (i.note) e.line('  Catatan: ' + i.note)
  }
  dash(e, columns)
  if (order.paid_at) e.line(timeJakarta(order.paid_at))
  return e.cut('partial')
}

/** Lembar uji kalibrasi: penggaris lebar, rata kanan, gaya huruf, aksen, dan pemotong. */
function buildTestPage(columns: number) {
  const e = encoder(columns).initialize()
  const ruler = (n: number) => Array.from({ length: n }, (_, i) => ((i + 1) % 10 === 0 ? String(((i + 1) / 10) % 10) : '.')).join('')
  e.align('center').bold(true).line('CETAK TES PRINTER').bold(false)
  e.line(`${columns} karakter per baris`).align('left')
  e.line(ruler(columns))
  e.line('1234567890'.repeat(5).slice(0, columns))
  e.line('Jika dua baris di atas utuh,').line('lebar kertas sudah cocok.')
  dash(e, columns)
  rows(e, columns, [['Kopi Susu', 'Rp18.000'], ['Total', 'Rp1.234.500']])
  e.bold(true).line('Teks tebal').bold(false)
  e.size(2).line('BESAR').size(1)
  e.line('Aksen: Café Ñandú é ü')
  dash(e, columns)
  e.align('center').line('Potong di bawah garis ini')
  return e.cut('partial')
}
export const escposTestPage = (width: number = getPaperChars()) => buildTestPage(width).encode()
export const previewTestPage = (width: number = getPaperChars()) => toPreview(buildTestPage(width).encode('lines'))

/** Byte ESC/POS siap kirim ke printer. */
export const escposReceipt = (order: Order, store: ReceiptStore, width: number = getPaperChars()) => buildReceipt(order, store, width).encode()
export const escposKitchenTicket = (order: Order, width: number = getPaperChars()) => buildKitchenTicket(order, width).encode()

/** Pratinjau dari isi perintah yang sama persis dengan yang dikirim ke printer (dibangun ulang, bukan tiruan terpisah). */
export const previewReceipt = (order: Order, store: ReceiptStore, width: number = getPaperChars()) => toPreview(buildReceipt(order, store, width).encode('lines'))
export const previewKitchenTicket = (order: Order, width: number = getPaperChars()) => toPreview(buildKitchenTicket(order, width).encode('lines'))

// --- Pengiriman ke printer ---
type SerialPortLike = { open(o: { baudRate: number }): Promise<void>; close(): Promise<void>; writable: WritableStream<Uint8Array> | null }
type SerialLike = { getPorts(): Promise<SerialPortLike[]>; requestPort(): Promise<SerialPortLike> }

export type PrintResult = { ok: true; via: 'serial' | 'rawbt' } | { ok: false; error: string }

/** Kirim byte ESC/POS: Web Serial (Chrome/Edge desktop & Android) lalu RawBT (Android). Safari/iPad tidak mendukung keduanya. */
export async function sendToPrinter(data: Uint8Array, opts: { auto?: boolean } = {}): Promise<PrintResult> {
  const serial = (navigator as unknown as { serial?: SerialLike }).serial
  if (serial) {
    try {
      const granted = (await serial.getPorts())[0]
      // mode otomatis tanpa klik pengguna: hanya boleh memakai printer yang sudah dipasangkan
      if (!granted && opts.auto) return { ok: false, error: 'Printer belum dipasangkan. Tekan "Pasangkan printer" sekali.' }
      const port = granted ?? (await serial.requestPort())
      await port.open({ baudRate: getBaudRate() })
      const w = port.writable!.getWriter()
      await w.write(data)
      w.releaseLock()
      await port.close()
      return { ok: true, via: 'serial' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Printer serial gagal' }
    }
  }
  if (opts.auto) return { ok: false, error: 'Cetak otomatis butuh Chrome/Edge (Web Serial). Browser ini tidak mendukung.' }
  if (/android/i.test(navigator.userAgent)) {
    let bin = ''
    data.forEach((b) => (bin += String.fromCharCode(b)))
    window.location.href = `rawbt:base64,${btoa(bin)}`
    return { ok: true, via: 'rawbt' }
  }
  return { ok: false, error: 'Browser ini tidak mendukung printer thermal langsung. Gunakan Chrome/Edge atau Android + RawBT, atau tombol Cetak.' }
}

/** Pasangkan printer sekali (wajib dari klik). Setelahnya cetak otomatis jalan tanpa dialog. */
export async function pairPrinter(): Promise<PrintResult> {
  const serial = (navigator as unknown as { serial?: SerialLike }).serial
  if (!serial) return { ok: false, error: 'Browser ini tidak mendukung Web Serial. Pakai Chrome/Edge di komputer atau Android.' }
  try {
    await serial.requestPort()
    return { ok: true, via: 'serial' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Pemasangan dibatalkan' }
  }
}

export const hasPairedPrinter = async () => {
  const serial = (navigator as unknown as { serial?: SerialLike }).serial
  return !!serial && (await serial.getPorts()).length > 0
}
