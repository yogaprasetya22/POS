// Pembantu Google Drive untuk server (api/drive.js) dan skrip (scripts/media-to-drive.js).
// Kredensial hanya dibaca dari env server, tidak pernah dikirim ke browser.

export async function accessToken() {
  const { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN } = process.env
  if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET || !GDRIVE_REFRESH_TOKEN) throw new Error('Kredensial Google Drive belum diisi di server')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GDRIVE_CLIENT_ID, client_secret: GDRIVE_CLIENT_SECRET, refresh_token: GDRIVE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Otentikasi Google Drive gagal (${res.status})`)
  return (await res.json()).access_token
}

export const folderId = () => {
  const folder = process.env.GDRIVE_FOLDER_ID
  if (!folder) throw new Error('GDRIVE_FOLDER_ID belum diisi di server')
  return folder
}

/** Alamat publik file Drive: gambar lewat CDN Google, video lewat tautan unduh. */
export const publicUrl = (id, mimeType) =>
  String(mimeType || '').startsWith('video/') ? `https://drive.google.com/uc?export=download&id=${id}` : `https://lh3.googleusercontent.com/d/${id}`

export const isDriveUrl = (url) => /^https:\/\/(lh3\.googleusercontent\.com\/d\/|drive\.google\.com\/)/.test(String(url || ''))

/** Buka akses baca untuk siapa saja yang punya tautan. */
export async function share(token, id) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  if (!r.ok) throw new Error(`Gagal membuka akses file (${r.status})`)
}

/** Unggah isi file (dari server) ke folder media, lalu jadikan publik. Mengembalikan { id, url }. */
export async function uploadBytes(token, name, mimeType, bytes) {
  const boundary = `pos${Date.now()}${Math.random().toString(16).slice(2)}`
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId()] })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  const body = Buffer.concat([Buffer.from(head), Buffer.from(bytes), Buffer.from(`\r\n--${boundary}--`)])
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!r.ok) throw new Error(`Upload ke Google Drive gagal (${r.status})`)
  const { id } = await r.json()
  await share(token, id)
  return { id, url: publicUrl(id, mimeType) }
}

export async function removeFile(token, id) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}
