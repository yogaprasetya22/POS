import { allow, supabaseFor } from '../server/supabase.js'

// Kredensial Google Drive hanya ada di server (env Vercel), tidak pernah dikirim ke browser.
async function accessToken() {
  const { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN } = process.env
  if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET || !GDRIVE_REFRESH_TOKEN) throw new Error('Kredensial Google Drive belum diisi di server')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GDRIVE_CLIENT_ID,
      client_secret: GDRIVE_CLIENT_SECRET,
      refresh_token: GDRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Otentikasi Google Drive gagal (${res.status})`)
  return (await res.json()).access_token
}

const MAX_BYTES = 50 * 1024 * 1024

// POST /api/drive
//   { action:'session', name, mimeType }  -> { uploadUrl }   (browser mengunggah langsung ke Google, tanpa batas 4,5 MB Vercel)
//   { action:'share', fileId, mimeType }  -> { url }         (file dibuat publik, URL siap dipakai)
export default async function handler(req, res) {
  if (!allow(req, res, 'POST')) return
  const db = supabaseFor(req)
  const { data: auth } = await db.auth.getUser()
  if (!auth?.user) return res.status(401).json({ success: false, error: 'Silakan login dulu' })
  // hanya pengelola menu yang boleh mengunggah media
  const { data: role } = await db.rpc('my_role')
  if (!['owner', 'manager'].includes(role)) return res.status(403).json({ success: false, error: 'Hanya owner/manager yang boleh mengunggah media' })

  const b = req.body || {}
  try {
    const token = await accessToken()
    if (b.action === 'session') {
      const type = String(b.mimeType || '')
      if (!/^(image|video)\//.test(type)) return res.status(400).json({ success: false, error: 'Hanya gambar atau video yang boleh diunggah' })
      if (Number(b.size) > MAX_BYTES) return res.status(413).json({ success: false, error: 'Ukuran file melebihi 50 MB' })
      const folder = process.env.GDRIVE_FOLDER_ID
      if (!folder) throw new Error('GDRIVE_FOLDER_ID belum diisi di server')
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': type,
          ...(req.headers.origin ? { Origin: req.headers.origin } : {}),
        },
        body: JSON.stringify({ name: String(b.name || 'file'), parents: [folder] }),
      })
      const uploadUrl = r.headers.get('location')
      if (!r.ok || !uploadUrl) throw new Error(`Gagal membuat sesi upload (${r.status})`)
      return res.status(200).json({ success: true, uploadUrl })
    }
    if (b.action === 'share' && b.fileId) {
      const id = encodeURIComponent(String(b.fileId))
      // hanya file di folder media kita yang boleh dibuka publik (bukan file Drive lain)
      const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=parents,mimeType&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })
      const info = meta.ok ? await meta.json() : null
      if (!info?.parents?.includes(process.env.GDRIVE_FOLDER_ID) || !/^(image|video)\//.test(info.mimeType || '')) {
        return res.status(403).json({ success: false, error: 'File ini tidak boleh dibagikan' })
      }
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      })
      if (!r.ok) throw new Error(`Gagal membuka akses file (${r.status})`)
      const isVideo = String(b.mimeType || '').startsWith('video/')
      const url = isVideo ? `https://drive.google.com/uc?export=download&id=${id}` : `https://lh3.googleusercontent.com/d/${id}`
      return res.status(200).json({ success: true, url })
    }
    return res.status(400).json({ success: false, error: 'action tidak dikenal' })
  } catch (e) {
    return res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) })
  }
}
