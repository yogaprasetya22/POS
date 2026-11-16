import { describe, expect, it } from 'vitest'
import { busiestHour, dailySeries, hourRange, hourTotals, hourlySeries, jakartaDate, jakartaHour } from './series'

// Waktu ditulis dalam WIB (+07:00) supaya skenario mudah dibaca.
const at = (hhmm: string, total = 10_000, day = '2026-11-16') => ({ paid_at: `${day}T${hhmm}:00+07:00`, total })

describe('jam di zona Jakarta', () => {
  it('UTC sore = WIB malam, dan lewat tengah malam pindah hari', () => {
    expect(jakartaHour('2026-11-16T08:00:00Z')).toBe(15)
    expect(jakartaHour('2026-11-16T17:30:00Z')).toBe(0)
    expect(jakartaDate('2026-11-16T17:30:00Z')).toBe('2026-11-17')
  })
})

describe('Skenario: penjualan per jam (Hari ini)', () => {
  it('belum ada penjualan hari ini maupun kemarin → grafik kosong', () => {
    expect(hourlySeries([], [])).toEqual([])
  })

  it('satu penjualan pukul 15.xx → minimal 8 jam ditampilkan, penjualan di jam 15', () => {
    const rows = hourlySeries([at('15:20', 50_500)])
    expect(rows).toHaveLength(8)
    expect(rows.find((r) => r.hour === 15)).toMatchObject({ net: 50_500, orders: 1 })
    expect(rows.reduce((a, r) => a + r.net, 0)).toBe(50_500)
  })

  it('jam buka 07–21: grafik dipotong ke jam pertama–terakhir yang ada penjualan', () => {
    const rows = hourlySeries([at('07:05'), at('12:30'), at('12:45'), at('21:59')])
    expect(rows[0].hour).toBe(7)
    expect(rows.at(-1)!.hour).toBe(21)
    expect(rows.find((r) => r.hour === 12)!.orders).toBe(2)
  })

  it('jam kemarin ikut menentukan rentang, dan dihitung terpisah', () => {
    const rows = hourlySeries([at('10:00', 20_000)], [at('06:00', 5_000, '2026-11-15'), at('20:00', 7_000, '2026-11-15')])
    expect(rows[0].hour).toBe(6)
    expect(rows.at(-1)!.hour).toBe(20)
    expect(rows.find((r) => r.hour === 10)).toMatchObject({ net: 20_000, prevNet: 0 })
    expect(rows.find((r) => r.hour === 20)).toMatchObject({ net: 0, prevNet: 7_000, prevOrders: 1 })
  })

  it('penjualan dekat tengah malam tidak membuat jam di luar 0–23', () => {
    const rows = hourlySeries([at('23:10')])
    expect(rows[0].hour).toBe(16)
    expect(rows.at(-1)!.hour).toBe(23)
  })

  it('jam teramai: paling banyak penjualan, seri → uang terbanyak', () => {
    const rows = hourlySeries([at('09:00', 10_000), at('09:30', 10_000), at('13:00', 90_000), at('13:10', 5_000)])
    expect(busiestHour(rows)?.hour).toBe(13)
    expect(busiestHour(hourlySeries([], [at('10:00')]))).toBeNull()
    expect(hourRange(23)).toBe('23.00–00.00')
  })
})

describe('Skenario: hari ini belum selesai (sekarang pukul 15.xx)', () => {
  const today = [at('09:10', 20_000), at('15:05', 30_000)]
  const yesterday = [at('09:00', 10_000, '2026-11-15'), at('15:30', 15_000, '2026-11-15'), at('19:00', 90_000, '2026-11-15')]

  it('jam setelah 15 ditandai belum terjadi', () => {
    const rows = hourlySeries(today, yesterday, 15)
    expect(rows.find((r) => r.hour === 15)!.future).toBe(false)
    expect(rows.find((r) => r.hour === 19)!.future).toBe(true)
  })

  it('kemarin dibandingkan hanya sampai jam yang sama (penjualan kemarin pukul 19 tidak dihitung)', () => {
    expect(hourTotals(hourlySeries(today, yesterday, 15))).toEqual({ net: 50_000, orders: 2, prevNet: 25_000, prevOrders: 2 })
  })

  it('tanpa jam sekarang (hari yang sudah lewat): semua jam dibandingkan penuh', () => {
    expect(hourTotals(hourlySeries(today, yesterday))).toMatchObject({ prevNet: 115_000, prevOrders: 3 })
  })
})

describe('Skenario: penjualan per hari dengan periode pembanding (7 hari)', () => {
  const daily = [
    { day: '2026-11-10', net: 100_000, orders: 4 },
    { day: '2026-11-16', net: 50_500, orders: 1 },
  ]
  const prev = [
    { day: '2026-11-03', net: 80_000, orders: 3 },
    { day: '2026-11-09', net: 17_000, orders: 1 },
  ]

  it('7 baris, hari tanpa penjualan bernilai 0', () => {
    const rows = dailySeries('2026-11-10', '2026-11-16', daily, prev)
    expect(rows).toHaveLength(7)
    expect(rows[1]).toMatchObject({ date: '2026-11-11', net: 0, orders: 0 })
  })

  it('hari ke-n dipasangkan dengan hari ke-n periode sebelumnya', () => {
    const rows = dailySeries('2026-11-10', '2026-11-16', daily, prev)
    expect(rows[0]).toMatchObject({ date: '2026-11-10', prevDate: '2026-11-03', prevNet: 80_000 })
    expect(rows[6]).toMatchObject({ date: '2026-11-16', net: 50_500, prevDate: '2026-11-09', prevNet: 17_000 })
  })

  it('total kedua periode sama dengan jumlah data aslinya (tidak ada yang hilang atau dobel)', () => {
    const rows = dailySeries('2026-11-10', '2026-11-16', daily, prev)
    expect(rows.reduce((a, r) => a + r.net, 0)).toBe(150_500)
    expect(rows.reduce((a, r) => a + r.prevNet, 0)).toBe(97_000)
  })

  it('melewati akhir bulan dan rentang terbalik', () => {
    const rows = dailySeries('2026-10-30', '2026-11-02', [], [])
    expect(rows.map((r) => r.date)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(rows[0].prevDate).toBe('2026-10-26')
    expect(dailySeries('2026-11-05', '2026-11-01', [])).toEqual([])
  })
})
