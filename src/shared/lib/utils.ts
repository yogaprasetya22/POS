export { cn } from 'cn'
export const rupiah = (n: number) => `${n < 0 ? '-' : ''}Rp${Math.abs(n).toLocaleString('id-ID')}`

/** Tanggal bisnis (YYYY-MM-DD) zona Asia/Jakarta, sama dengan orders.business_day. */
export const todayJakarta = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

export const timeJakarta = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })

/** 6281234567890 -> 0812-3456-7890 (tampilan nomor HP member) */
export const formatPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^62/, '0')
  return d.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3')
}
