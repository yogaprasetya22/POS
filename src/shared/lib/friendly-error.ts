/**
 * Ubah pesan teknis (jaringan, database, sesi) jadi bahasa sehari-hari yang menyebut cara memperbaikinya.
 * Pesan yang sudah ramah (mis. dari `raise exception` berbahasa Indonesia) dikembalikan apa adanya.
 */
const RULES: [RegExp, string][] = [
  [/failed to fetch|networkerror|network request failed|load failed|fetch failed/i, 'Tidak tersambung ke internet. Periksa wifi atau paket data, lalu coba lagi.'],
  [/jwt|refresh token|not authenticated|session.*(expired|missing)/i, 'Waktu masuk sudah habis. Keluar dari akun, masuk lagi, lalu ulangi.'],
  [/^forbidden$|permission denied|row-level security|not allowed|unauthorized/i, 'Akunmu tidak bisa melakukan ini. Minta pemilik toko untuk melakukannya.'],
  [/duplicate key|already exists|unique constraint/i, 'Data ini sudah ada. Pakai nama lain, atau ubah data yang sudah ada.'],
  [/foreign key/i, 'Data ini masih dipakai di tempat lain, jadi belum bisa dihapus. Ubah atau hapus dulu yang memakainya.'],
  [/^table required$/i, 'Nomor meja belum diisi. Isi nomor meja, lalu coba lagi.'],
  [/^invalid name$/i, 'Nama belum diisi dengan benar. Isi nama, lalu coba lagi.'],
  [/check constraint|not-null|invalid input|violates/i, 'Ada isian yang belum benar. Periksa lagi isiannya, lalu simpan ulang.'],
  [/timeout|timed out|internal server|bad gateway|service unavailable|\b50\d\b/i, 'Ada masalah di server. Tunggu sebentar, lalu coba lagi. Kalau masih gagal, hubungi bantuan.'],
]

export function friendlyError(message: string): string {
  const m = message.trim()
  if (!m) return ''
  for (const [re, text] of RULES) if (re.test(m)) return text
  return m
}
