/** Upload media produk ke Google Drive lewat /api/drive. Kredensial dan folder tujuan hanya ada di server. */
import { supabase } from './supabase'

export interface GDriveUploadResult {
  fileId: string
  fileName: string
  mimeType: string
  url: string
}

async function post(body: Record<string, unknown>) {
  const { data: s } = await supabase.auth.getSession()
  const res = await fetch('/api/drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Permintaan gagal')
  return json
}

export async function uploadToGDrive(file: File, folderPrefix = ''): Promise<GDriveUploadResult> {
  const fileName = `${folderPrefix ? folderPrefix + '-' : ''}${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const mimeType = file.type || 'application/octet-stream'

  const { uploadUrl } = await post({ action: 'session', name: fileName, mimeType, size: file.size })
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file })
  if (!put.ok) throw new Error(`Upload gagal (${put.status})`)
  const { id } = (await put.json()) as { id: string }

  const { url } = await post({ action: 'share', fileId: id, mimeType })
  return { fileId: id, fileName, mimeType, url }
}
