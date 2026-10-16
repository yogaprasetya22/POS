export { cn } from 'cn'
export const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`

/** Tanggal bisnis (YYYY-MM-DD) zona Asia/Jakarta, sama dengan orders.business_day. */
export const todayJakarta = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

export const timeJakarta = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
