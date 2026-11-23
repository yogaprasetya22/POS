import { accessToken } from '../server/drive.js'

// GET /api/media?id=<fileId>
// Perantara baca untuk video/audio di Google Drive. Drive mengirim "Cross-Origin-Resource-Policy: same-site",
// jadi <video src="drive..."> ditolak browser di domain lain. Di sini file dibaca server lalu diteruskan,
// lengkap dengan dukungan Range (bisa di-seek) dan di-cache CDN Vercel.
// Hanya file di folder media kita (GDRIVE_FOLDER_ID) yang boleh dibaca.

let cached = { token: '', exp: 0 }
async function token() {
  if (cached.token && Date.now() < cached.exp) return cached.token
  cached = { token: await accessToken(), exp: Date.now() + 50 * 60 * 1000 }
  return cached.token
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ success: false, error: 'Method not allowed' })
  const id = String(req.query?.id || '')
  if (!/^[\w-]{10,80}$/.test(id)) return res.status(400).json({ success: false, error: 'id tidak valid' })

  try {
    const t = await token()
    const auth = { Authorization: `Bearer ${t}` }
    const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=parents,mimeType,size&supportsAllDrives=true`, { headers: auth })
    const info = meta.ok ? await meta.json() : null
    if (!info?.parents?.includes(process.env.GDRIVE_FOLDER_ID) || !/^(video|audio|image)\//.test(info.mimeType || '')) {
      return res.status(404).json({ success: false, error: 'File tidak ditemukan' })
    }

    const range = req.headers.range
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
      headers: { ...auth, ...(range ? { Range: range } : {}) },
    })
    if (!r.ok && r.status !== 206) return res.status(502).json({ success: false, error: `Drive menolak (${r.status})` })

    res.statusCode = r.status
    res.setHeader('Content-Type', info.mimeType)
    res.setHeader('Accept-Ranges', 'bytes')
    for (const h of ['content-length', 'content-range']) {
      const v = r.headers.get(h)
      if (v) res.setHeader(h, v)
    }
    // file landing jarang berubah (nama id baru tiap unggah ulang): cache lama di CDN
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable')
    if (req.method === 'HEAD') return res.end()
    res.end(Buffer.from(await r.arrayBuffer()))
  } catch (e) {
    return res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) })
  }
}
