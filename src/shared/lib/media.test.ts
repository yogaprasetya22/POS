import { beforeEach, describe, expect, it, vi } from 'vitest'

const drive = vi.hoisted(() => ({ uploadToGDrive: vi.fn(), importFromStorage: vi.fn() }))
const storage = vi.hoisted(() => ({ upload: vi.fn(), getPublicUrl: vi.fn((p: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/product-images/${p}` } })) }))
vi.mock('./gdrive', () => drive)
vi.mock('./supabase', () => ({ supabase: { storage: { from: () => storage } } }))

import { uploadMedia } from './media'

const file = new File(['abc'], 'nasi goreng.png', { type: 'image/png' })
const DRIVE = 'https://lh3.googleusercontent.com/d/FILE1'

describe('uploadMedia: tujuan akhir Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.upload.mockResolvedValue({ error: null })
  })

  it('langsung ke Drive bila bisa; Supabase Storage tidak disentuh', async () => {
    drive.uploadToGDrive.mockResolvedValue({ url: DRIVE })
    expect(await uploadMedia(file, 'toko1')).toEqual({ url: DRIVE, via: 'drive' })
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('unggah langsung gagal: lewat Supabase Storage lalu dipindah server ke Drive', async () => {
    drive.uploadToGDrive.mockRejectedValue(new Error('Upload gagal (403)'))
    drive.importFromStorage.mockResolvedValue(DRIVE)
    const r = await uploadMedia(file, 'toko1', 'logo')
    expect(r).toEqual({ url: DRIVE, via: 'relay' })
    const path = storage.upload.mock.calls[0][0] as string
    expect(path).toMatch(/^toko1\/logo-[0-9a-f-]{36}-nasi_goreng\.png$/) // folder toko sendiri, nama file aman
    expect(drive.importFromStorage).toHaveBeenCalledWith(path, 'image/png')
  })

  it('Drive tidak bisa dihubungi sama sekali: file tetap aman di Supabase Storage', async () => {
    drive.uploadToGDrive.mockRejectedValue(new Error('down'))
    drive.importFromStorage.mockRejectedValue(new Error('down'))
    const r = await uploadMedia(file, 'toko1')
    expect(r.via).toBe('storage')
    expect(r.url).toContain('/storage/v1/object/public/product-images/toko1/')
  })

  it('dua-duanya gagal: pesan menyebut kedua penyebab', async () => {
    drive.uploadToGDrive.mockRejectedValue(new Error('Drive penuh'))
    storage.upload.mockResolvedValue({ error: { message: 'bucket tidak ada' } })
    await expect(uploadMedia(file, 'toko1')).rejects.toThrow(/Drive penuh.*bucket tidak ada/)
  })
})
