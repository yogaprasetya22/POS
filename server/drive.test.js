import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDriveUrl, publicUrl, uploadBytes } from './drive.js'

describe('server/drive', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('alamat publik: gambar lewat CDN Google, video lewat tautan unduh', () => {
    expect(publicUrl('A1', 'image/webp')).toBe('https://lh3.googleusercontent.com/d/A1')
    expect(publicUrl('A1', 'video/mp4')).toBe('https://drive.google.com/uc?export=download&id=A1')
  })

  it('mengenali alamat Drive dan bukan Drive', () => {
    expect(isDriveUrl('https://lh3.googleusercontent.com/d/A1')).toBe(true)
    expect(isDriveUrl('https://drive.google.com/uc?export=download&id=A1')).toBe(true)
    expect(isDriveUrl('https://images.unsplash.com/photo-1')).toBe(false)
    expect(isDriveUrl('https://x.supabase.co/storage/v1/object/public/product-images/a.png')).toBe(false)
    expect(isDriveUrl(null)).toBe(false)
  })

  it('uploadBytes: unggah ke folder media lalu membuka akses publik', async () => {
    process.env.GDRIVE_FOLDER_ID = 'FOLDER'
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      calls.push({ url: String(url), init })
      return { ok: true, status: 200, json: async () => ({ id: 'NEW' }) }
    }))
    const out = await uploadBytes('TOKEN', 'a.png', 'image/png', Buffer.from('xyz'))
    expect(out).toEqual({ id: 'NEW', url: 'https://lh3.googleusercontent.com/d/NEW' })
    expect(calls[0].url).toContain('uploadType=multipart')
    expect(calls[0].init.body.toString()).toContain('"parents":["FOLDER"]')
    expect(calls[1].url).toContain('/files/NEW/permissions')
    expect(JSON.parse(calls[1].init.body)).toEqual({ role: 'reader', type: 'anyone' })
  })

  it('uploadBytes: gagal unggah melempar pesan dengan kode status', async () => {
    process.env.GDRIVE_FOLDER_ID = 'FOLDER'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })))
    await expect(uploadBytes('TOKEN', 'a.png', 'image/png', Buffer.from('x'))).rejects.toThrow('403')
  })
})
