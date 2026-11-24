import { allow, supabaseAdmin, supabaseAnon } from '../server/supabase.js'

/**
 * POST /api/device
 *   { action: 'staff', token }               -> info perangkat + daftar staf ber-PIN
 *   { action: 'login', token, userId, pin }  -> sesi Supabase untuk staf (access + refresh token)
 * Token perangkat & PIN diperiksa di database (device_check_pin). Sesi dibuat dengan service role:
 * generateLink (tanpa mengirim email, disiapkan bersamaan dengan cek PIN) -> verifyOtp -> sesi milik staf itu, jadi auth.uid() = kasir.
 */

// Pembatas laju per IP (best-effort, memori instance). Batas keras ada di database.
const hits = new Map()
function tooMany(ip, max = 20, windowMs = 60_000) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
  return list.length > max
}

export default async function handler(req, res) {
  if (!allow(req, res, 'POST')) return
  const admin = supabaseAdmin()
  if (!admin) {
    return res.status(500).json({ success: false, error: 'Server belum dikonfigurasi: SUPABASE_SERVICE_ROLE_KEY belum diisi.' })
  }
  const { action, token, userId, pin } = req.body || {}
  if (typeof token !== 'string' || token.length < 32) return res.status(400).json({ success: false, error: 'UNBOUND' })

  if (action === 'staff') {
    const { data, error } = await admin.rpc('device_staff', { p_token: token })
    if (error) return res.status(500).json({ success: false, error: error.message })
    if (!data?.ok) return res.status(401).json({ success: false, error: data?.reason ?? 'UNBOUND' })
    return res.status(200).json({ success: true, data })
  }

  if (action === 'login') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
    if (tooMany(ip)) return res.status(429).json({ success: false, error: 'TOO_MANY' })
    if (typeof userId !== 'string' || typeof pin !== 'string') return res.status(400).json({ success: false, error: 'WRONG' })

    // Cek PIN dan siapkan tautan sesi BERSAMAAN (hemat 1-2 perjalanan ke Supabase). Tautan hanya dipakai bila PIN
    // benar; token-nya tidak pernah dikirim ke perangkat, jadi menyiapkannya lebih dulu tidak membuka celah.
    const t0 = Date.now()
    const linkFor = (async () => {
      const { data: u } = await admin.auth.admin.getUserById(userId)
      if (!u?.user?.email) return null
      const { data: l } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
      return { email: u.user.email, hashed: l?.properties?.hashed_token }
    })().catch(() => null)
    const { data: check, error } = await admin.rpc('device_check_pin', { p_token: token, p_user: userId, p_pin: pin })
    const t1 = Date.now()
    if (error) return res.status(500).json({ success: false, error: error.message })
    if (!check?.ok) return res.status(check?.reason === 'UNBOUND' ? 401 : 403).json({ success: false, error: check?.reason ?? 'WRONG', until: check?.until, left: check?.left })

    let link = await linkFor
    if (!link?.hashed || link.email !== check.email) {
      // cadangan: alur lama berurutan
      const { data: l } = await admin.auth.admin.generateLink({ type: 'magiclink', email: check.email })
      link = { email: check.email, hashed: l?.properties?.hashed_token }
    }
    const t2 = Date.now()
    if (!link.hashed) return res.status(500).json({ success: false, error: 'Gagal membuat sesi kasir' })
    const { data: auth, error: otpErr } = await supabaseAnon().auth.verifyOtp({ token_hash: link.hashed, type: 'email' })
    if (otpErr || !auth?.session) return res.status(500).json({ success: false, error: 'Gagal membuat sesi kasir' })
    // lihat di DevTools → Network → Timing untuk tahu bagian mana yang lambat
    res.setHeader('Server-Timing', `pin;dur=${t1 - t0}, link;dur=${t2 - t1}, session;dur=${Date.now() - t2}`)

    return res.status(200).json({
      success: true,
      session: { access_token: auth.session.access_token, refresh_token: auth.session.refresh_token },
    })
  }

  return res.status(400).json({ success: false, error: 'Aksi tidak dikenal' })
}
