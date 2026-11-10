import { describe, expect, it } from 'vitest'
import { formatRupiahInput, parseRupiahInput } from './currency-input'

describe('format rupiah input', () => {
  it('240000 tampil 240.000 dan kembali jadi angka bersih', () => {
    expect(formatRupiahInput('240000')).toBe('240.000')
    expect(formatRupiahInput(1234567)).toBe('1.234.567')
    expect(parseRupiahInput('240.000')).toBe('240000')
  })
  it('mengabaikan huruf, titik liar, dan nol di depan', () => {
    expect(parseRupiahInput('Rp 0012a.5b00')).toBe('12500')
    expect(formatRupiahInput('000')).toBe('0')
    expect(formatRupiahInput('')).toBe('')
  })
  it('desimal memakai koma dan dibatasi jumlahnya', () => {
    expect(formatRupiahInput('0.25', 2)).toBe('0,25')
    expect(parseRupiahInput('1.200,505', 2)).toBe('1200.50')
    expect(parseRupiahInput('3,5', 0)).toBe('3')
  })
  it('membatasi panjang bilangan bulat', () => {
    expect(parseRupiahInput('1'.repeat(20)).length).toBe(12)
  })
})
