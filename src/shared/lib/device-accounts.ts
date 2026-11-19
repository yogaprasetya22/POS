import { rpc } from './api'
import { supabase } from './supabase'

/**
 * Akun yang pernah masuk di perangkat ini (tablet kasir bersama), untuk "Ganti orang" pakai PIN.
 * Yang disimpan sama dengan yang Supabase sendiri simpan untuk sesi aktif (refresh token di localStorage),
 * hanya untuk beberapa orang sekaligus. PIN tetap dicek di database (verify_my_pin, terkunci setelah 5x salah).
 */
export type DeviceAccount = { userId: string; email: string; name: string; role: string; refreshToken: string }

const KEY = 'pos-device-accounts'
const MAX = 12

export function listAccounts(): DeviceAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as DeviceAccount[]).filter((a) => a && a.userId && a.refreshToken) : []
  } catch {
    return []
  }
}

function write(list: DeviceAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* penyimpanan penuh/diblokir: fitur ganti orang tidak tersedia, aplikasi tetap jalan */
  }
}

export function rememberAccount(a: DeviceAccount) {
  write([a, ...listAccounts().filter((x) => x.userId !== a.userId)])
}

export function forgetAccount(userId: string) {
  write(listAccounts().filter((x) => x.userId !== userId))
}

function updateToken(userId: string, refreshToken: string) {
  const list = listAccounts()
  const hit = list.find((a) => a.userId === userId)
  if (!hit || hit.refreshToken === refreshToken) return
  hit.refreshToken = refreshToken
  write(list)
}

/** Perbarui nama/peran tersimpan (dipanggil setelah profil dimuat). */
export function refreshAccountInfo(userId: string, info: { name: string; role: string; email: string }) {
  const list = listAccounts()
  const hit = list.find((a) => a.userId === userId)
  if (!hit) return
  Object.assign(hit, info)
  write(list)
}

let syncing = false
/** Token Supabase berganti tiap diperbarui: simpan yang terbaru untuk akun yang diingat. Panggil sekali saat aplikasi mulai. */
export function startDeviceAccountSync() {
  if (syncing) return
  syncing = true
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) updateToken(session.user.id, session.refresh_token)
  })
}

/**
 * Lepas sesi aktif di perangkat ini TANPA mencabutnya di server (signOut, termasuk scope 'local', mencabut
 * refresh token sehingga akun tersimpan tidak bisa dipakai lagi untuk ganti orang). Lalu buka halaman masuk.
 */
export async function leaveToLogin() {
  const { data } = await supabase.auth.getSession()
  if (data.session) updateToken(data.session.user.id, data.session.refresh_token)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k)
    }
    sessionStorage.clear()
  } catch {
    /* abaikan */
  }
  window.location.assign('/login')
}

export type SwitchResult = 'OK' | 'WRONG' | 'LOCKED' | 'NO_PIN' | 'EXPIRED' | 'ERROR'

/**
 * Pindah ke akun tersimpan setelah PIN-nya cocok. Bila PIN salah, sesi sebelumnya dipulihkan.
 * Sesi akun yang sedang aktif disimpan dulu supaya bisa dipakai lagi nanti.
 */
export async function switchAccount(userId: string, pin: string): Promise<SwitchResult> {
  const target = listAccounts().find((a) => a.userId === userId)
  if (!target) return 'EXPIRED'
  const { data: cur } = await supabase.auth.getSession()
  const prev = cur.session
  if (prev) updateToken(prev.user.id, prev.refresh_token)
  if (prev?.user.id === userId) return 'OK'

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: target.refreshToken })
  if (error || !data.session) {
    forgetAccount(userId)
    if (prev) await supabase.auth.refreshSession({ refresh_token: prev.refresh_token })
    return 'EXPIRED'
  }
  updateToken(userId, data.session.refresh_token)

  const { data: verdict, error: rpcErr } = await rpc('verify_my_pin', { p_pin: pin })
  if (!rpcErr && verdict === null) return 'OK'

  // PIN tidak cocok: kembalikan orang sebelumnya (atau keluar bila tadi belum ada yang masuk)
  const { data: now } = await supabase.auth.getSession()
  if (now.session) updateToken(userId, now.session.refresh_token)
  const back = prev ? listAccounts().find((a) => a.userId === prev.user.id)?.refreshToken ?? prev.refresh_token : null
  if (back) await supabase.auth.refreshSession({ refresh_token: back })
  else {
    // belum ada yang masuk sebelumnya (halaman masuk): lepas sesi tanpa mencabut token akun tersimpan
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k?.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k)
      }
    } catch {
      /* abaikan */
    }
  }
  if (rpcErr) return 'ERROR'
  return verdict === 'LOCKED' || verdict === 'NO_PIN' ? verdict : 'WRONG'
}

export const SWITCH_MESSAGE: Record<Exclude<SwitchResult, 'OK'>, string> = {
  WRONG: 'PIN salah. Coba lagi.',
  LOCKED: 'Terlalu banyak salah. Tunggu 5 menit, lalu coba lagi.',
  NO_PIN: 'Akun ini belum punya PIN. Masuk pakai email dan kata sandi, lalu atur PIN di menu akun.',
  EXPIRED: 'Sesi akun ini sudah habis. Masuk lagi pakai email dan kata sandi.',
  ERROR: 'Gagal mengecek PIN. Periksa internet, lalu coba lagi.',
}
