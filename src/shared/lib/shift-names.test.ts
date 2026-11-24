import { describe, expect, it } from 'vitest'
import { inShift, lateMinutes, minutesToEnd, shiftLength, suggestShift, type ShiftName } from './shift-names'

const mk = (name: string, start_time: string | null, end_time: string | null, is_active = true): ShiftName => ({ id: name, name, sort_order: 0, is_active, start_time, end_time })
const names = [mk('Pagi', '06:00', '14:00'), mk('Sore', '14:00', '22:00'), mk('Malam', '22:00', '06:00')]
const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
// waktu Jakarta (UTC+7) → Date
const wib = (iso: string) => new Date(`${iso}+07:00`)

describe('jam shift', () => {
  it('lama shift, termasuk lewat tengah malam', () => {
    expect(shiftLength('07:00', '15:00')).toBe(480)
    expect(shiftLength('22:00', '06:00')).toBe(480)
  })

  it('inShift mengenali shift malam', () => {
    expect(inShift('22:00', '06:00', m('23:30'))).toBe(true)
    expect(inShift('22:00', '06:00', m('03:00'))).toBe(true)
    expect(inShift('22:00', '06:00', m('06:00'))).toBe(false)
  })

  it('suggestShift: yang sedang berjalan, atau yang paling dekat mulai', () => {
    expect(suggestShift(names, m('09:15'))?.name).toBe('Pagi')
    expect(suggestShift(names, m('14:00'))?.name).toBe('Sore')
    expect(suggestShift(names, m('01:00'))?.name).toBe('Malam')
    const dua = [mk('Pagi', '07:00', '15:00'), mk('Sore', '15:00', '23:00')]
    expect(suggestShift(dua, m('06:40'))?.name).toBe('Pagi') // datang lebih awal
    expect(suggestShift([mk('Bebas', null, null)], m('10:00'))).toBeNull()
  })

  it('lateMinutes: telat dihitung, datang lebih awal = 0', () => {
    expect(lateMinutes('07:00', wib('2026-11-23T07:25:00'))).toBe(25)
    expect(lateMinutes('07:00', wib('2026-11-23T06:40:00'))).toBe(0)
    expect(lateMinutes('22:00', wib('2026-11-24T00:10:00'))).toBe(130)
  })

  it('minutesToEnd: sisa waktu dan lewat jadwal, termasuk shift malam', () => {
    const opened = wib('2026-11-23T07:05:00')
    expect(minutesToEnd('07:00', '15:00', opened, wib('2026-11-23T14:50:00'))).toBe(10)
    expect(minutesToEnd('07:00', '15:00', opened, wib('2026-11-23T15:30:00'))).toBe(-30)
    // dibuka 20 menit lebih awal: jam selesai tetap 15:00
    expect(minutesToEnd('07:00', '15:00', wib('2026-11-23T06:40:00'), wib('2026-11-23T14:00:00'))).toBe(60)
    // shift malam 22:00–06:00, dibuka 22:10, sekarang 05:50 besoknya
    expect(minutesToEnd('22:00', '06:00', wib('2026-11-23T22:10:00'), wib('2026-11-24T05:50:00'))).toBe(10)
  })
})
