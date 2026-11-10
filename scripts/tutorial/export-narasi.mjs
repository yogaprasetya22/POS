/**
 * Tulis docs/narasi.txt (untuk docs/fish_ai.py: blok dipisah baris '---') dan docs/narasi-peta.md.
 * Urutan slide global: seri fitur (12 video) lalu seri peran (7 video); record.mjs memakai urutan yang sama.
 *   node scripts/tutorial/export-narasi.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { VIDEOS } from './fitur.mjs'
import { ROLES } from './roles.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const rows = []
let n = 0
for (const [seri, set] of [['fitur', VIDEOS], ['peran', ROLES]])
  for (const [key, v] of Object.entries(set)) for (const [text, , layar] of (v.scenes ?? v.steps)({})) rows.push({ n: ++n, seri, key, video: v.title, text, layar: layar ?? '' })

const long = rows.filter((r) => r.text.length > 450)
fs.writeFileSync(path.join(ROOT, 'docs/narasi.txt'), rows.map((r) => r.text).join('\n---\n') + '\n')

let md = '# Peta narasi → video\n\nDihasilkan oleh `scripts/tutorial/export-narasi.mjs` (jangan diedit tangan; ubah `scripts/tutorial/fitur.mjs`).\n\n| Slide | Seri | Video | Awal narasi |\n|---|---|---|---|\n'
for (const r of rows) md += `| ${String(r.n).padStart(2, '0')} | ${r.seri} | ${r.video} | ${r.text.slice(0, 60).replace(/\|/g, '/')}… |\n`
fs.writeFileSync(path.join(ROOT, 'docs/narasi-peta.md'), md)
const words = rows.reduce((a, r) => a + r.text.split(/\s+/).length, 0)
console.log(`${rows.length} blok, ${words} kata (≈ ${Math.round(words / 2.3 / 60)} menit suara), ${Object.keys(VIDEOS).length + Object.keys(ROLES).length} video`)
if (long.length) console.log(`PERINGATAN: ${long.length} blok > 450 karakter (akan dipecah oleh fish_ai.py): slide ${long.map((r) => r.n).join(', ')}`)
