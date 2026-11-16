/*
 * Hitungan data grafik (tanpa React) supaya bisa diuji: per jam (zona Asia/Jakarta) dan per hari,
 * masing-masing dengan periode pembanding (kemarin / periode sebelumnya).
 */

export type Paid = { paid_at: string; total: number }
/** `future`: jam yang belum terjadi (hanya untuk hari ini) — tidak digambar dan tidak ikut dibandingkan. */
export type HourRow = { hour: number; net: number; orders: number; prevNet: number; prevOrders: number; future?: boolean }
export type DayRow = { date: string; net: number; orders: number; prevDate: string; prevNet: number; prevOrders: number }

/** Jam (0–23) di Jakarta dari waktu ISO. */
export const jakartaHour = (iso: string) => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date(iso)))
  return h % 24 // beberapa browser menulis tengah malam sebagai "24"
}

/** Tanggal (YYYY-MM-DD) di Jakarta dari waktu ISO. */
export const jakartaDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

const MIN_SPAN = 8

/**
 * Penjualan per jam hari ini vs pembanding. Jam yang ditampilkan dipotong ke jam buka
 * (jam pertama–terakhir yang ada penjualan di salah satu hari), minimal 8 jam supaya grafik tetap terbaca.
 * Kosong bila kedua hari tanpa penjualan.
 */
export function hourlySeries(cur: Paid[], prev: Paid[] = [], nowHour?: number): HourRow[] {
  const rows: HourRow[] = Array.from({ length: 24 }, (_, hour) => ({ hour, net: 0, orders: 0, prevNet: 0, prevOrders: 0 }))
  for (const o of cur) {
    const r = rows[jakartaHour(o.paid_at)]
    r.net += o.total
    r.orders += 1
  }
  for (const o of prev) {
    const r = rows[jakartaHour(o.paid_at)]
    r.prevNet += o.total
    r.prevOrders += 1
  }
  const used = rows.filter((r) => r.orders > 0 || r.prevOrders > 0).map((r) => r.hour)
  if (used.length === 0) return []
  let start = Math.min(...used)
  let end = Math.max(...used)
  // lebarkan ke dua sisi sampai minimal 8 jam, tanpa keluar dari 0–23
  while (end - start + 1 < MIN_SPAN) {
    if (start > 0) start--
    if (end - start + 1 < MIN_SPAN && end < 23) end++
  }
  const out = rows.slice(start, end + 1)
  return nowHour === undefined ? out : out.map((r) => ({ ...r, future: r.hour > nowHour }))
}

/** Jumlah hari ini dan pembanding yang adil: pembanding hanya sampai jam yang sama (jam yang belum terjadi dilewati). */
export function hourTotals(rows: HourRow[]) {
  const past = rows.filter((r) => !r.future)
  return {
    net: past.reduce((a, r) => a + r.net, 0),
    orders: past.reduce((a, r) => a + r.orders, 0),
    prevNet: past.reduce((a, r) => a + r.prevNet, 0),
    prevOrders: past.reduce((a, r) => a + r.prevOrders, 0),
  }
}

/** Jam teramai (paling banyak penjualan; seri → uang terbanyak). Null bila tidak ada penjualan. */
export function busiestHour(rows: HourRow[]): HourRow | null {
  return rows.reduce<HourRow | null>((b, r) => (r.orders === 0 ? b : !b || r.orders > b.orders || (r.orders === b.orders && r.net > b.net) ? r : b), null)
}

export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}.00`
export const hourRange = (h: number) => `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Penjualan per hari dari `from` sampai `to`, dipasangkan dengan hari yang sama urutannya di periode sebelumnya
 * (hari ke-1 dengan hari ke-1 periode lalu, dst.). Hari tanpa penjualan bernilai 0.
 */
export function dailySeries(
  from: string,
  to: string,
  daily: { day: string; net: number; orders: number }[],
  prevDaily: { day: string; net: number; orders: number }[] = [],
): DayRow[] {
  const n = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  if (!(n > 0)) return []
  const cur = new Map(daily.map((d) => [d.day, d]))
  const old = new Map(prevDaily.map((d) => [d.day, d]))
  const prevFrom = addDays(from, -n)
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i)
    const prevDate = addDays(prevFrom, i)
    return {
      date,
      net: cur.get(date)?.net ?? 0,
      orders: cur.get(date)?.orders ?? 0,
      prevDate,
      prevNet: old.get(prevDate)?.net ?? 0,
      prevOrders: old.get(prevDate)?.orders ?? 0,
    }
  })
}
