/**
 * Menu toko + meja terakhir yang dibuka pembeli di HP ini (mis. /s/warkop-nusantara?meja=T3).
 * Dipakai tombol "kembali" di halaman 404/error/legal supaya pembeli tidak tersesat ke landing page.
 */
const KEY = 'pos:menu-terakhir'
const KEEP_MS = 12 * 60 * 60_000 // satu kunjungan, sama dengan kartu pesanan

export function rememberMenu(path: string, table: string | null) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, table, at: Date.now() }))
  } catch {
    /* mode privat: abaikan */
  }
}

export function lastMenu(): { path: string; label: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { path?: unknown; table?: unknown; at?: unknown } | null
    if (!v || typeof v.path !== 'string' || !v.path.startsWith('/s/') || typeof v.at !== 'number' || Date.now() - v.at > KEEP_MS) return null
    return { path: v.path, label: typeof v.table === 'string' && v.table ? `Kembali ke menu · Meja ${v.table}` : 'Kembali ke menu' }
  } catch {
    return null
  }
}
