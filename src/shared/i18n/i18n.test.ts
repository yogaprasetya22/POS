import { beforeEach, describe, expect, it } from 'vitest'
import { ERROR_CODES, MESSAGES } from './catalog'
import { msg, setLocale, setOverrides, t } from './index'

beforeEach(() => {
  setOverrides([])
  setLocale('id')
})

describe('i18n', () => {
  it('setiap kunci punya tiga bahasa dan semua {parameter} di tiap bahasa sama dengan versi Indonesia', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    for (const [k, m] of Object.entries(MESSAGES)) {
      for (const l of ['id', 'jaksel', 'en'] as const) expect(m[l].length, `${k}/${l}`).toBeGreaterThan(2)
      expect(vars(m.jaksel), k).toBe(vars(m.id))
      expect(vars(m.en), k).toBe(vars(m.id))
    }
  })

  it('kode galat dari database menunjuk kunci yang ada', () => {
    for (const key of Object.values(ERROR_CODES)) expect(key in MESSAGES).toBe(true)
  })

  it('merakit kode berparameter dan memformat uang sebagai Rupiah', () => {
    const raw = 'E:SHIFT_HANDOVER_DIFF:{"opening":175000,"expected":170000}'
    expect(msg(raw)).toBe('Modal awal Rp175.000 berbeda dari uang serah terima Rp170.000. Tulis catatan penyebabnya.')
    setLocale('jaksel')
    expect(msg(raw)).toContain('Rp175.000 kok beda')
    setLocale('en')
    expect(msg('E:SHIFT_DIFF_NEEDS_NOTE:{"diff":-5000}')).toBe('There is a difference of Rp5.000. Please write the reason first.')
  })

  it('teks Indonesia lama dari SQL dipetakan, selain itu dibiarkan apa adanya', () => {
    setLocale('jaksel')
    expect(msg('PIN salah')).toBe('PIN-nya salah, coba lagi ya.')
    expect(msg('Pembayaran gagal (sudah dibayar, dibatalkan, atau uang kurang)')).toContain('gagal nih')
    expect(msg('duplicate key value violates unique constraint')).toBe('duplicate key value violates unique constraint')
  })

  it('timpaan admin mengalahkan kamus bawaan hanya untuk bahasa yang disunting', () => {
    setOverrides([{ locale: 'jaksel', key: 'shift.taken', text: 'Lacinya udah dipake orang lain bestie' }])
    setLocale('jaksel')
    expect(t('shift.taken')).toBe('Lacinya udah dipake orang lain bestie')
    setLocale('id')
    expect(t('shift.taken')).toBe('Shift baru saja dibuka oleh kasir lain.')
  })

  it('parameter yang tidak diberikan dibiarkan sebagai {nama}', () => {
    expect(t('shift.held', { who: 'Sari' })).toContain('{at}')
  })
})
