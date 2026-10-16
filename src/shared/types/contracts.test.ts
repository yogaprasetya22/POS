import { describe, expect, it } from 'vitest'
import { RegisterSchema, StoreInputSchema } from './contracts'

describe('RegisterSchema', () => {
  it('menolak password pendek dan konfirmasi berbeda', () => {
    expect(RegisterSchema.safeParse({ email: 'a@b.co', password: 'pendek', confirm: 'pendek' }).success).toBe(false)
    expect(RegisterSchema.safeParse({ email: 'a@b.co', password: 'rahasia123', confirm: 'rahasia124' }).success).toBe(false)
    expect(RegisterSchema.safeParse({ email: 'a@b.co', password: 'rahasia123', confirm: 'rahasia123' }).success).toBe(true)
  })
})

describe('StoreInputSchema', () => {
  const base = { name: 'Toko A', wa_number: '6281234567890', is_active: true, owner_email: '' }
  it('slug dinormalisasi dan divalidasi', () => {
    expect(StoreInputSchema.parse({ ...base, slug: '  Warkop-Baru ' }).slug).toBe('warkop-baru')
    expect(StoreInputSchema.safeParse({ ...base, slug: 'ab' }).success).toBe(false)
    expect(StoreInputSchema.safeParse({ ...base, slug: 'pakai spasi' }).success).toBe(false)
    expect(StoreInputSchema.safeParse({ ...base, slug: '-awal' }).success).toBe(false)
  })
  it('nomor WA harus berawalan 62 dan owner_email opsional tapi valid', () => {
    expect(StoreInputSchema.safeParse({ ...base, slug: 'toko-a', wa_number: '0812345' }).success).toBe(false)
    expect(StoreInputSchema.safeParse({ ...base, slug: 'toko-a', owner_email: 'bukan-email' }).success).toBe(false)
    expect(StoreInputSchema.safeParse({ ...base, slug: 'toko-a', owner_email: 'o@x.co' }).success).toBe(true)
  })
})
