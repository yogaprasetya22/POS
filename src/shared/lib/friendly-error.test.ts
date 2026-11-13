import { describe, expect, it } from 'vitest'
import { friendlyError } from './friendly-error'

describe('friendlyError', () => {
  it('menerjemahkan pesan teknis dan menyebut cara memperbaikinya', () => {
    expect(friendlyError('TypeError: Failed to fetch')).toMatch(/internet.*coba lagi/)
    expect(friendlyError('forbidden')).toMatch(/pemilik toko/)
    expect(friendlyError('duplicate key value violates unique constraint "products_name_key"')).toMatch(/sudah ada/)
    expect(friendlyError('update or delete on table "categories" violates foreign key constraint')).toMatch(/masih dipakai/)
    expect(friendlyError('JWT expired')).toMatch(/masuk lagi/)
  })

  it('membiarkan pesan yang sudah ramah', () => {
    expect(friendlyError('Tidak ada shift yang terbuka')).toBe('Tidak ada shift yang terbuka')
    expect(friendlyError('')).toBe('')
  })
})
