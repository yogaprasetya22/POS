/**
 * Modul Storage Google Drive untuk upload media produk (foto & video).
 * // ponytail: REST API langsung ke Google Drive & OAuth2 via fetch + FormData tanpa Google SDK berat (hemat ~50MB).
 */

export interface GDriveUploadResult {
  fileId: string
  fileName: string
  mimeType: string
  url: string
}

/** Folder ID Google Drive khusus untuk media POS */
export const POS_GDRIVE_FOLDER_ID = '1wqpjkruY35XPB7xB_SeQWS9TmpO4pGTX'

let cachedAccessToken: string | null = null
let tokenExpiresAt = 0

function getEnv(key: string): string {
  const viteKey = `VITE_${key}`
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  if (env?.[viteKey]) return env[viteKey]
  if (env?.[key]) return env[key]

  const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process
  if (globalProcess?.env?.[viteKey]) return globalProcess.env[viteKey]
  if (globalProcess?.env?.[key]) return globalProcess.env[key]

  return ''
}

/**
 * Mengambil Access Token Google Drive menggunakan Refresh Token yang tersimpan di .env.
 * Token disimpan di memori selama masa berlaku (~50 menit) untuk meminimalkan round-trip.
 */
export async function getGDriveAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedAccessToken && tokenExpiresAt > now + 60_000) {
    return cachedAccessToken
  }

  const clientId = getEnv('GDRIVE_CLIENT_ID')
  const clientSecret = getEnv('GDRIVE_CLIENT_SECRET')
  const refreshToken = getEnv('GDRIVE_REFRESH_TOKEN')

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Kredensial Google Drive belum lengkap di file .env')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gagal otentikasi Google Drive (${res.status}): ${errText}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedAccessToken = data.access_token
  tokenExpiresAt = now + (Number(data.expires_in) || 3600) * 1000
  return data.access_token
}

/**
 * Mengunggah satu file (gambar atau video) langsung ke Google Drive di folder target.
 * Mengatur izin akses publik (anyone reader) dan mengembalikan URL CDN Google berkecepatan tinggi.
 */
export async function uploadToGDrive(file: File, folderPrefix = ''): Promise<GDriveUploadResult> {
  const token = await getGDriveAccessToken()
  const rootFolderId = getEnv('GDRIVE_FOLDER_ID') || POS_GDRIVE_FOLDER_ID

  const safeName = `${folderPrefix ? folderPrefix + '-' : ''}${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`

  const metadata = {
    name: safeName,
    parents: [rootFolderId],
  }

  const fd = new FormData()
  fd.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' }))
  fd.append('file', file, safeName)

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: fd,
    },
  )

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`Upload file ke Google Drive gagal (${uploadRes.status}): ${errText}`)
  }

  const fileData = (await uploadRes.json()) as { id: string }
  const fileId = fileData.id

  // Berikan izin 'anyone' reader agar media bisa dimuat secara publik oleh pelanggan & kasir
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    })
  } catch {
    // Non-fatal jika izin reader sudah aktif otomatis di level folder
  }

  // URL publik: Gambar menggunakan Google CDN (lh3), Video menggunakan direct streaming link
  const isVideo = file.type.startsWith('video/')
  const url = isVideo
    ? `https://drive.google.com/uc?export=download&id=${fileId}`
    : `https://lh3.googleusercontent.com/d/${fileId}`

  return {
    fileId,
    fileName: safeName,
    mimeType: file.type,
    url,
  }
}
