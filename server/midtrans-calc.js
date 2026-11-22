import crypto from 'node:crypto'

/**
 * Logika murni Midtrans yang dipakai api/midtrans.js dan DIUJI di midtrans-calc.test.js.
 * Rumus potongan HARUS sama dengan fungsi SQL pay_order_midtrans / get_store_financial_summary.
 */

/** Status transaksi Midtrans yang berarti uang benar-benar diterima. */
export function isPaidStatus(transactionStatus, fraudStatus) {
  return transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept')
}

/** Status yang membuat pesanan UNPAID harus dibatalkan. */
export function isFailedStatus(transactionStatus) {
  return ['expire', 'cancel', 'deny', 'failure'].includes(transactionStatus)
}

/** Nominal Midtrans (string "20000.00") wajib sama persis dengan total pesanan POS. */
export function amountMatches(midtransGross, orderTotal) {
  if (midtransGross === undefined || midtransGross === null || midtransGross === '') return false
  return Math.round(Number(midtransGross)) === Math.round(Number(orderTotal))
}

/** SHA512(order_id + status_code + gross_amount + server_key) sesuai dokumentasi Midtrans. */
export function midtransSignature(orderId, statusCode, grossAmount, serverKey) {
  return crypto.createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${serverKey}`).digest('hex')
}

export function verifySignature(notif, serverKeys) {
  const keys = serverKeys.filter(Boolean)
  if (keys.length === 0 || !notif?.signature_key) return false
  return keys.some(
    (k) => midtransSignature(notif.order_id, notif.status_code, notif.gross_amount, k) === notif.signature_key,
  )
}

/**
 * Potongan QRIS: MDR (default 0,7%) lalu PPN (default 11%) DARI nilai MDR.
 * Pembulatan sama dengan SQL: round() per langkah.
 */
export function calcQrisSettlement(gross, mdrPercent = 0.7, taxPercent = 11) {
  const fee = Math.round(gross * (mdrPercent / 100))
  const tax = Math.round(fee * (taxPercent / 100))
  return { gross, fee, tax, net: Math.max(0, gross - fee - tax) }
}

/**
 * Saldo siap tarik versi POS, dihitung dari pesanan. Hanya pesanan yang lunas DI MIDTRANS
 * (settlement/capture) yang dihitung. Simulasi lokal ('simulated') tidak ada di Midtrans,
 * jadi tidak boleh menambah saldo.
 */
export function calcAvailableBalance(orders, withdrawals = [], mdrPercent = 0.7, taxPercent = 11) {
  let gross = 0
  let fee = 0
  let tax = 0
  for (const o of orders) {
    const paid = ['IN_KITCHEN', 'READY', 'COMPLETED'].includes(o.status)
    if (!paid || o.payment_method !== 'MIDTRANS' || !o.midtrans_transaction_id) continue
    if (!['settlement', 'capture'].includes(o.midtrans_status ?? 'settlement')) continue
    const s = calcQrisSettlement(o.total, mdrPercent, taxPercent)
    gross += o.total
    fee += o.midtrans_fee > 0 ? o.midtrans_fee : s.fee
    tax += o.midtrans_tax > 0 ? o.midtrans_tax : s.tax
  }
  const net = Math.max(0, gross - fee - tax)
  const withdrawn = withdrawals
    .filter((w) => w.channel === 'MIDTRANS' && ['COMPLETED', 'PROCESSING', 'PENDING'].includes(w.status))
    .reduce((a, w) => a + w.amount, 0)
  return { gross, fee, tax, net, withdrawn, available: Math.max(0, net - withdrawn) }
}
