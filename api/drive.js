import { accessToken, folderId, publicUrl, share, uploadBytes } from '../server/drive.js'
import { allow, supabaseFor } from '../server/supabase.js'

const MAX_BYTES = 50 * 1024 * 1024
const BUCKET = 'product-images'

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
      const folder = folderId()
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
      await share(token, String(b.fileId))
      const url = publicUrl(id, b.mimeType)
      return res.status(200).json({ success: true, url })
    }
    // Perantara: file yang terlanjur masuk Supabase Storage (unggah langsung gagal) dipindahkan server ke Drive.
    if (b.action === 'import' && b.path) {
      const { data: storeId } = await db.rpc('my_store')
      const path = String(b.path)
      // hanya file milik toko sendiri di bucket media
      if (!storeId || !path.startsWith(`${storeId}/`) || path.includes('..')) return res.status(403).json({ success: false, error: 'File ini bukan milik tokomu' })
      const file = await db.storage.from(BUCKET).download(path)
      if (file.error || !file.data) throw new Error('File perantara tidak ditemukan di Supabase Storage')
      const type = file.data.type || String(b.mimeType || '')
      if (!/^(image|video)\//.test(type)) return res.status(400).json({ success: false, error: 'Hanya gambar atau video yang boleh diunggah' })
      if (file.data.size > MAX_BYTES) return res.status(413).json({ success: false, error: 'Ukuran file melebihi 50 MB' })
      const out = await uploadBytes(token, path.replace(/\//g, '-'), type, Buffer.from(await file.data.arrayBuffer()))
      // sudah aman di Drive: hapus salinan perantara (gagal hapus tidak membatalkan hasil)
      await db.storage.from(BUCKET).remove([path]).catch(() => {})
      return res.status(200).json({ success: true, url: out.url, fileId: out.id })
    }
    return res.status(400).json({ success: false, error: 'action tidak dikenal' })
  } catch (e) {
    return res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) })
  }
}
