/**
 * Alamat video/audio yang bisa diputar di halaman kita.
 * Google Drive memblokir pemutaran lintas situs (Cross-Origin-Resource-Policy: same-site),
 * jadi file Drive diputar lewat perantara /api/media?id=...
 */
export function playableUrl(url: string | null | undefined): string {
  const u = String(url || '').trim()
  if (!u) return ''
  const id =
    u.match(/drive\.google\.com\/(?:uc|open)\?(?:[^#]*&)?id=([\w-]{10,})/)?.[1] ||
    u.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1] ||
    u.match(/drive\.usercontent\.google\.com\/download\?(?:[^#]*&)?id=([\w-]{10,})/)?.[1]
  return id ? `/api/media?id=${id}` : u
}
