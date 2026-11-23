// Unggah video & audio demo landing page ke Google Drive, lalu tulis manifest alamatnya.
//   bun scripts/landing-media-to-drive.js            -> unggah semua file di public/landing (webm + mp3)
// File lama di Drive (dari manifest sebelumnya) dihapus setelah unggahan baru berhasil.
import fs from 'node:fs'
import path from 'node:path'
import { accessToken, removeFile, uploadBytes } from '../server/drive.js'

for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.trim().startsWith('#')) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

const DIR = 'public/landing'
const OUT = 'src/features/landing/landing-media.ts'
const files = [
  ...fs.readdirSync(DIR).filter((f) => f.endsWith('.webm')).map((f) => [f, 'video/webm']),
  ...(fs.existsSync(`${DIR}/audio`) ? fs.readdirSync(`${DIR}/audio`).filter((f) => f.endsWith('.mp3')).map((f) => [`audio/${f}`, 'audio/mpeg']) : []),
]
if (!files.length) throw new Error(`Tidak ada video/audio di ${DIR}. Jalankan generate-synced-showcase dulu.`)

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8').match(/=\s*(\{[\s\S]*\})\s*as const/)?.[1] || '{}') : {}
const token = await accessToken()
const next = {}
for (const [rel, type] of files) {
  const bytes = fs.readFileSync(path.join(DIR, rel))
  const { id, url } = await uploadBytes(token, `landing-${rel.replace('/', '-')}`, type, bytes)
  // diputar lewat /api/media (Drive memblokir embed lintas situs)
  next[`/landing/${rel}`] = { id, url: `/api/media?id=${id}` }
  console.log(`✓ ${rel} (${(bytes.length / 1024).toFixed(0)} KB) → ${id}`)
}
fs.writeFileSync(
  OUT,
  '// Dibuat otomatis oleh scripts/landing-media-to-drive.js. Jangan diedit manual.\n' +
    `export const LANDING_MEDIA: Record<string, { id: string; url: string }> = ${JSON.stringify(next, null, 2)} as const\n\n` +
    '/** Alamat Google Drive untuk file /landing/... (fallback ke path lokal). */\n' +
    'export const landingMedia = (path: string) => LANDING_MEDIA[path]?.url ?? path\n',
)
console.log(`\n✓ Manifest ditulis: ${OUT}`)
for (const [k, v] of Object.entries(old)) {
  if (next[k]?.id !== v.id) await removeFile(token, v.id).catch(() => {})
}
