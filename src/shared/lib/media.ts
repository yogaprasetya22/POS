import { importFromStorage, uploadToGDrive } from './gdrive'
import { supabase } from './supabase'

const BUCKET = 'product-images'

export type MediaResult = {
  url: string
  /** drive: langsung ke Google Drive · relay: lewat Supabase Storage lalu dipindah server ke Drive · storage: masih di Supabase (Drive belum bisa dihubungi) */
  via: 'drive' | 'relay' | 'storage'
}

/**
 * Unggah media toko. Tujuan akhirnya selalu Google Drive:
 *  1. langsung dari browser ke Drive;
 *  2. bila gagal, simpan dulu ke Supabase Storage (perantara) lalu server memindahkannya ke Drive;
 *  3. bila Drive tetap tidak bisa dihubungi, file tetap aman di Supabase Storage dan dipindahkan belakangan
 *     dengan `make media-to-drive`.
 */
export async function uploadMedia(file: File, storeId: string, label = ''): Promise<MediaResult> {
  try {
    return { url: (await uploadToGDrive(file, `${storeId}${label ? `-${label}` : ''}`)).url, via: 'drive' }
  } catch (driveError) {
    const path = `${storeId}/${label ? `${label}-` : ''}${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
    if (error) throw new Error(`${driveError instanceof Error ? driveError.message : 'Google Drive gagal'}; cadangan juga gagal: ${error.message}`)
    try {
      return { url: await importFromStorage(path, file.type), via: 'relay' }
    } catch {
      return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, via: 'storage' }
    }
  }
}
