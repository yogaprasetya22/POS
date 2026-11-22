import { supabase } from './supabase'

/**
 * Perangkat kasir yang sudah diaktifkan manager. Yang disimpan di perangkat hanya token acak;
 * database menyimpan hash-nya (tabel devices). Kasir masuk lewat PIN -> /api/device membuatkan sesi.
 */
export type BoundDevice = { token: string; deviceId: string; name: string; storeName: string }
export type DeviceStaff = { user_id: string; name: string; role: string }
export type LoginFail = { reason: 'WRONG' | 'LOCKED' | 'DEVICE_LOCKED' | 'NO_PIN' | 'UNBOUND' | 'TOO_MANY' | 'ERROR'; until?: string; left?: number; message?: string }

const KEY = 'pos-bound-device'

export function getDevice(): BoundDevice | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return d && typeof d.token === 'string' ? (d as BoundDevice) : null
  } catch {
    return null
  }
}
export const saveDevice = (d: BoundDevice) => localStorage.setItem(KEY, JSON.stringify(d))
export const clearDevice = () => localStorage.removeItem(KEY)

async function call(body: Record<string, unknown>) {
  const res = await fetch('/api/device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

export async function fetchDeviceStaff(): Promise<{ staff: DeviceStaff[]; storeName: string; deviceName: string } | 'UNBOUND' | { error: string }> {
  const d = getDevice()
  if (!d) return 'UNBOUND'
  const r = await call({ action: 'staff', token: d.token })
  if (r.status === 401) {
    clearDevice()
    return 'UNBOUND'
  }
  if (!r.body.success) return { error: r.body.error ?? 'Gagal memuat daftar kasir' }
  return { staff: r.body.data.staff, storeName: r.body.data.store?.name ?? d.storeName, deviceName: r.body.data.device?.name ?? d.name }
}

/** Masuk sebagai staf lewat PIN. Berhasil: sesi Supabase aktif atas nama staf itu. */
export async function deviceLogin(userId: string, pin: string): Promise<null | LoginFail> {
  const d = getDevice()
  if (!d) return { reason: 'UNBOUND' }
  const r = await call({ action: 'login', token: d.token, userId, pin })
  if (!r.body.success) {
    if (r.body.error === 'UNBOUND') clearDevice()
    const known = ['WRONG', 'LOCKED', 'DEVICE_LOCKED', 'NO_PIN', 'UNBOUND', 'TOO_MANY']
    return known.includes(r.body.error)
      ? { reason: r.body.error, until: r.body.until, left: r.body.left }
      : { reason: 'ERROR', message: r.body.error }
  }
  const { error } = await supabase.auth.setSession(r.body.session)
  return error ? { reason: 'ERROR', message: error.message } : null
}

/** Kunci layar: sesi kasir ditutup (refresh token dicabut), perangkat TETAP terikat. */
export async function lockDevice() {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  window.location.assign('/kunci')
}

/**
 * Jadikan perangkat ini perangkat kasir, memakai sesi owner/manager yang SEDANG login (tanpa login ulang).
 * `token` opsional: sesi lain (mis. login manager sementara di halaman /perangkat).
 */
export async function bindThisDevice(name: string, token?: string): Promise<BoundDevice> {
  const { rpc } = await import('./api')
  const { data, error } = await rpc('bind_device', { p_name: name }, token ? { token } : undefined)
  if (error) {
    throw new Error(/owner atau manager/i.test(error.message)
      ? 'Akun ini bukan owner/manager. Perangkat kasir hanya bisa diaktifkan oleh owner atau manager.'
      : error.message)
  }
  const r = data as { device_id: string; token: string; name: string; store_name: string }
  const d = { token: r.token, deviceId: r.device_id, name: r.name, storeName: r.store_name }
  saveDevice(d)
  return d
}
