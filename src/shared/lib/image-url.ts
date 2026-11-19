/**
 * Alamat gambar dengan ukuran yang pas, supaya yang diunduh tidak lebih besar dari yang ditampilkan.
 * - Unsplash (data contoh): parameter w/q + auto=format (AVIF/WebP bila browser mendukung).
 * - Google Drive (lh3.googleusercontent.com/d/ID): akhiran =wN.
 * - Lainnya (mis. Supabase Storage): alamat asli, tidak diubah.
 */
export function sizedImage(url: string, width: number, quality = 70): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('w', String(width))
      u.searchParams.set('q', String(quality))
      u.searchParams.set('auto', 'format')
      u.searchParams.set('fit', 'crop')
      return u.toString()
    }
    if (u.hostname === 'lh3.googleusercontent.com') {
      return url.replace(/=[swh]\d+(-[a-z0-9-]+)?$/i, '') + `=w${width}`
    }
  } catch {
    /* bukan URL lengkap: pakai apa adanya */
  }
  return url
}

/** Bisakah alamat ini diminta versi kecil? (untuk gambar buram sementara) */
export const canResize = (url: string) => /^https:\/\/(images\.unsplash\.com|lh3\.googleusercontent\.com)\//.test(url)

/** srcset 1x/2x dari lebar tampil (piksel CSS). */
export const srcSetFor = (url: string, width: number) =>
  canResize(url) ? `${sizedImage(url, width)} 1x, ${sizedImage(url, width * 2, 60)} 2x` : undefined
