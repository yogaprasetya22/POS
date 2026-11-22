import { createClient } from '@supabase/supabase-js'

/** Klien Supabase per-request dengan kunci anon; token user (bila ada) diteruskan agar RLS tetap berlaku. */
export function supabaseFor(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const auth = req.headers?.authorization
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: auth ? { headers: { Authorization: auth } } : {},
  })
}

/** Pastikan method sesuai; jika tidak, jawab 405 dan return false. */
export function allow(req, res, method) {
  if (req.method === method) return true
  res.setHeader('Allow', method)
  res.status(405).json({ success: false, error: 'Method tidak diizinkan' })
  return false
}

/**
 * Klien service role: HANYA untuk server (api/device.js) — melewati RLS.
 * Wajib SUPABASE_SERVICE_ROLE_KEY di env server (jangan pernah diawali VITE_).
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Klien anon tanpa sesi tersimpan (untuk menukar token jadi sesi di server). */
export function supabaseAnon() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
