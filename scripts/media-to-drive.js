// Uji & pemindahan media ke Google Drive.
//   bun scripts/media-to-drive.js check    - uji kredensial: unggah gambar kecil, buka alamat publiknya, lalu hapus
//   bun scripts/media-to-drive.js status   - hitung media per tempat penyimpanan
//   bun scripts/media-to-drive.js migrate  - pindahkan semua media yang belum di Drive (Unsplash, Supabase Storage, dll.)
import fs from 'node:fs'
import { accessToken, isDriveUrl, removeFile, uploadBytes } from '../server/drive.js'

for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.trim().startsWith('#')) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}
const ref = (process.env.VITE_SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `SQL gagal (${res.status})`)
  return json
}
const q = (v) => `'${String(v).replace(/'/g, "''")}'`

// PNG 1x1 untuk uji
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function check() {
  const token = await accessToken()
  console.log('✓ Login ke Google Drive berhasil')
  const { id, url } = await uploadBytes(token, `uji-pos-${Date.now()}.png`, 'image/png', PIXEL)
  console.log(`✓ Unggah berhasil (${id})`)
  let ok = false
  for (let i = 0; i < 5 && !ok; i++) {
    const r = await fetch(url)
    ok = r.ok && (r.headers.get('content-type') || '').startsWith('image/')
    if (!ok) await new Promise((r2) => setTimeout(r2, 1500))
  }
  await removeFile(token, id)
  console.log('✓ File uji dihapus lagi')
  if (!ok) throw new Error(`Alamat publik ${url} tidak bisa dibuka sebagai gambar`)
  console.log('✓ Alamat publik bisa dibuka tanpa login\n✅ Google Drive siap dipakai')
}

const place = (u) => (isDriveUrl(u) ? 'Google Drive' : /supabase\.co\/storage/.test(u) ? 'Supabase Storage' : new URL(u).host)

async function collect() {
  const products = await sql('select id, image_url, images, video_url from products')
  const stores = await sql("select id, logo_url from stores where logo_url <> ''")
  const urls = new Set()
  for (const p of products) for (const u of [p.image_url, p.video_url, ...(p.images || [])]) if (u) urls.add(u)
  for (const s of stores) urls.add(s.logo_url)
  return { products, stores, urls: [...urls] }
}

async function status() {
  const { urls } = await collect()
  const by = {}
  for (const u of urls) by[place(u)] = (by[place(u)] || 0) + 1
  console.log(`Media di database: ${urls.length} file`)
  for (const [k, n] of Object.entries(by)) console.log(`  ${k}: ${n}`)
  const left = urls.filter((u) => !isDriveUrl(u)).length
  console.log(left ? `⚠ ${left} file belum di Google Drive. Jalankan: make media-to-drive` : '✅ Semua media sudah di Google Drive')
  return left
}

async function migrate() {
  const { products, stores, urls } = await collect()
  const todo = urls.filter((u) => !isDriveUrl(u))
  if (!todo.length) return console.log('✅ Semua media sudah di Google Drive')
  const token = await accessToken()
  const moved = new Map()
  for (const u of todo) {
    try {
      const r = await fetch(u)
      if (!r.ok) throw new Error(`unduh gagal (${r.status})`)
      const type = (r.headers.get('content-type') || '').split(';')[0]
      if (!/^(image|video)\//.test(type)) throw new Error(`bukan gambar/video (${type})`)
      const name = `pindahan-${Date.now()}-${(new URL(u).pathname.split('/').pop() || 'file').replace(/[^\w.-]/g, '_').slice(0, 60)}`
      const out = await uploadBytes(token, name, type, Buffer.from(await r.arrayBuffer()))
      moved.set(u, out.url)
      console.log(`✓ ${place(u)} → Drive: ${name}`)
    } catch (e) {
      console.log(`✗ ${u.slice(0, 80)}: ${e.message}`)
    }
  }
  const swap = (u) => moved.get(u) ?? u
  for (const p of products) {
    const next = { image_url: p.image_url && swap(p.image_url), video_url: p.video_url && swap(p.video_url), images: (p.images || []).map(swap) }
    if (JSON.stringify(next) === JSON.stringify({ image_url: p.image_url, video_url: p.video_url, images: p.images || [] })) continue
    await sql(`update products set image_url = ${next.image_url ? q(next.image_url) : 'null'}, video_url = ${next.video_url ? q(next.video_url) : 'null'}, images = ${q(JSON.stringify(next.images))}::jsonb where id = ${q(p.id)}`)
  }
  for (const s of stores) if (moved.has(s.logo_url)) await sql(`update stores set logo_url = ${q(moved.get(s.logo_url))} where id = ${q(s.id)}`)
  console.log(`\nDipindahkan: ${moved.size} dari ${todo.length}`)
  await status()
}

const cmd = process.argv[2]
const run = { check, status, migrate }[cmd]
if (!run) console.log('Pakai: bun scripts/media-to-drive.js check | status | migrate')
else run().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1) })
