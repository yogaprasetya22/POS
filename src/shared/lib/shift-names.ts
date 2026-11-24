import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/** start_time/end_time: "HH:MM" atau null (shift tanpa jam kerja). Boleh melewati tengah malam (22:00–06:00). */
export type ShiftName = { id: string; name: string; sort_order: number; is_active: boolean; start_time: string | null; end_time: string | null }

/** Daftar nama shift toko (diatur pemilik di Pengaturan toko → Shift). */
export function useShiftNames() {
  const [names, setNames] = useState<ShiftName[]>([])
  const [loaded, setLoaded] = useState(false)
  const reload = useCallback(async () => {
    const { data } = await supabase.from('shift_names').select('id,name,sort_order,is_active,start_time,end_time').order('sort_order')
    setNames(((data ?? []) as ShiftName[]).map((n) => ({ ...n, start_time: hhmm(n.start_time), end_time: hhmm(n.end_time) })))
    setLoaded(true)
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { names, active: names.filter((n) => n.is_active), loaded, reload }
}

/** "07:00:00" → "07:00"; null tetap null. */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null)

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Menit sejak tengah malam, waktu Jakarta. */
export function jakartaMinutes(d: Date = new Date()) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':').map(Number)
  return h * 60 + m
}

/** Lama shift dalam menit (mendukung lewat tengah malam). */
export const shiftLength = (start: string, end: string) => (toMin(end) - toMin(start) + 1440) % 1440 || 1440

/** Apakah `now` (menit) di dalam jam shift. */
export function inShift(start: string, end: string, now: number) {
  return (now - toMin(start) + 1440) % 1440 < shiftLength(start, end)
}

/**
 * Shift yang paling cocok dibuka sekarang: yang jamnya sedang berjalan; bila tidak ada, yang paling dekat akan mulai
 * (mis. kasir datang 06:45 untuk shift 07:00). Shift tanpa jam tidak ikut dipilih otomatis.
 */
export function suggestShift(names: ShiftName[], now = jakartaMinutes()) {
  const timed = names.filter((n): n is ShiftName & { start_time: string; end_time: string } => Boolean(n.is_active && n.start_time && n.end_time))
  const running = timed.find((n) => inShift(n.start_time, n.end_time, now))
  if (running) return running
  return timed.map((n) => ({ n, wait: (toMin(n.start_time) - now + 1440) % 1440 })).sort((a, b) => a.wait - b.wait)[0]?.n ?? null
}

/** Menit tersisa sampai jam selesai shift (negatif = sudah lewat), dihitung dari jam buka shift sebenarnya. */
export function minutesToEnd(plannedStart: string, plannedEnd: string, openedAt: Date, now: Date = new Date()) {
  const len = shiftLength(plannedStart, plannedEnd)
  // hitung jam selesai = tanggal jadwal mulai terdekat sebelum/saat shift dibuka + lama shift
  const openMin = jakartaMinutes(openedAt)
  const sinceStart = (openMin - toMin(plannedStart) + 1440) % 1440
  // dibuka lebih dari 3 jam sebelum jadwal mulai: anggap jadwal hari itu belum dimulai
  const startOffset = sinceStart > 1440 - 180 ? sinceStart - 1440 : sinceStart
  const endAt = openedAt.getTime() + (len - startOffset) * 60000
  return Math.round((endAt - now.getTime()) / 60000)
}

/** Berapa menit shift dibuka terlambat dari jadwal (0 bila tepat/lebih awal). */
export function lateMinutes(plannedStart: string, openedAt: Date) {
  const d = (jakartaMinutes(openedAt) - toMin(plannedStart) + 1440) % 1440
  return d > 1440 - 180 ? 0 : d // dibuka sampai 3 jam lebih awal = tidak telat
}

/** Jam kerja yang disarankan untuk tombol cepat di pengaturan. */
export const SHIFT_PRESETS: { label: string; rows: { name: string; start_time: string; end_time: string }[] }[] = [
  { label: 'Pagi & Sore', rows: [{ name: 'Pagi', start_time: '07:00', end_time: '15:00' }, { name: 'Sore', start_time: '15:00', end_time: '23:00' }] },
  {
    label: 'Pagi, Sore, Malam',
    rows: [
      { name: 'Pagi', start_time: '06:00', end_time: '14:00' },
      { name: 'Sore', start_time: '14:00', end_time: '22:00' },
      { name: 'Malam', start_time: '22:00', end_time: '06:00' },
    ],
  },
  { label: 'Satu shift (10–22)', rows: [{ name: 'Harian', start_time: '10:00', end_time: '22:00' }] },
]
