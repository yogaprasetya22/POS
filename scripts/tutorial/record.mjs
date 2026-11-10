/**
 * Rekam video panduan per peran (layar + suara). Mengubah database di .env: jalankan hanya ke database demo/dev.
 *
 *   node scripts/tutorial/record.mjs pelanggan      # satu peran
 *   node scripts/tutorial/record.mjs all            # semua peran, berurutan
 *
 * Butuh: aplikasi jalan di BASE_URL (default http://localhost:5199), ffmpeg, dan mesin suara Piper
 * (scripts/tutorial/.tts: venv + model id.onnx). Hasil: docs/videos/*.mp4
 */
import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROLES } from './roles.mjs'
import { VIDEOS } from './fitur.mjs'

try { process.loadEnvFile('.env') } catch { /* env dari shell */ }
const BASE = process.env.BASE_URL || 'http://localhost:5199'
const ROOT = path.resolve(import.meta.dirname, '../..')
const TTS_PY = process.env.TTS_PYTHON || path.join(ROOT, 'scripts/tutorial/.tts/venv/bin/python')
const TTS_MODEL = process.env.TTS_MODEL || path.join(ROOT, 'scripts/tutorial/.tts/id.onnx')
const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const SET = opt('set') || 'peran'
const SETS = { peran: ROLES, fitur: VIDEOS }
if (!SETS[SET]) throw new Error(`--set harus salah satu: ${Object.keys(SETS).join(', ')}`)
const AUDIO = opt('audio') ? path.resolve(opt('audio')) : null
const OUT = path.join(ROOT, 'docs/videos', SET === 'fitur' ? 'fitur' : '')
const TMP = fs.mkdtempSync(path.join(process.env.TUTORIAL_TMP || os.tmpdir(), 'tutorial-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** Batas waktu keras: langkah yang menggantung tidak boleh memanjangkan video. */
const limit = (p, ms, what) => Promise.race([p, sleep(ms).then(() => { throw new Error(`${what} melebihi ${ms / 1000} detik`) })])
const LEAD = 600 // ms: video mulai sedikit sebelum langkah pertama

const duration = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout) * 1000

function synth(texts, dir) {
  const jobs = texts.map((text, i) => ({ text, out: path.join(dir, `s${i}.wav`) }))
  const r = spawnSync(TTS_PY, [path.join(ROOT, 'scripts/tutorial/gen-tts.py'), TTS_MODEL], { input: JSON.stringify(jobs), encoding: 'utf8' })
  if (r.status !== 0) throw new Error('TTS gagal: ' + r.stderr.slice(-400))
  return jobs.map((j) => ({ file: j.out, ms: duration(j.out) }))
}

const CURSOR = () => {
  const mk = () => {
    if (document.getElementById('__cur')) return
    const c = document.createElement('div')
    c.id = '__cur'
    c.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:26px;height:26px;border-radius:50%;background:rgba(37,99,235,.28);border:2px solid #2563eb;transform:translate(-50%,-50%);transition:left .35s cubic-bezier(.2,.8,.2,1),top .35s cubic-bezier(.2,.8,.2,1),transform .12s;left:-60px;top:-60px'
    document.documentElement.appendChild(c)
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', () => { c.style.transform = 'translate(-50%,-50%) scale(.6)' }, true)
    addEventListener('mouseup', () => { c.style.transform = 'translate(-50%,-50%) scale(1)' }, true)
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mk) : mk()
}

const caption = (page, text) =>
  page.evaluate((t) => {
    let el = document.getElementById('__cap')
    if (!el) {
      el = document.createElement('div')
      el.id = '__cap'
      el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:82%;z-index:2147483646;pointer-events:none;background:rgba(15,23,42,.88);color:#fff;font:500 18px/1.4 system-ui,sans-serif;padding:10px 18px;border-radius:12px;text-align:center'
      document.documentElement.appendChild(el)
    }
    el.textContent = t
  }, text).catch(() => {})

/** Nomor slide pertama video ini: urutan global adegan = docs/narasi.txt (seri fitur dulu, lalu seri peran). */
function slideBase(name) {
  let n = 0
  for (const [seri, set] of [['fitur', VIDEOS], ['peran', ROLES]]) {
    for (const [k, v] of Object.entries(set)) {
      if (seri === SET && k === name) return n
      n += (v.steps ?? v.scenes)({}).length
    }
  }
  return n
}
function loadAudio(name, count) {
  const base = slideBase(name)
  return Array.from({ length: count }, (_, i) => {
    const file = path.join(AUDIO, `slide-${String(base + i + 1).padStart(2, '0')}.mp3`)
    if (!fs.existsSync(file)) throw new Error(`file suara tidak ada: ${file} (jalankan docs/fish_ai.py dulu)`)
    return { file, ms: duration(file) }
  })
}

async function record(name) {
  const role = SETS[SET][name]
  if (!role) throw new Error(`video tidak dikenal: ${name}. Pilihan: ${Object.keys(SETS[SET]).join(', ')}`)
  console.log(`\n▶ ${name}: ${role.title}`)
  const dir = fs.mkdtempSync(path.join(TMP, name + '-'))
  const ctx = await role.before?.()
  const steps = (role.steps ?? role.scenes)(ctx ?? {})
  const clips = AUDIO ? loadAudio(name, steps.length) : synth(steps.map((s) => s[0]), dir)

  const browser = await chromium.launch({ slowMo: 120 })
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } })
  await context.addInitScript(CURSOR)
  const t0 = Date.now()
  const page = await context.newPage()
  // wa.me disimulasikan: tampilkan isi pesan yang akan terkirim ke WhatsApp (tanpa keluar ke internet)
  page.setDefaultTimeout(8000)
  await page.route(/https:\/\/wa\.me\//, (route) => {
    const text = new URL(route.request().url()).searchParams.get('text') ?? ''
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    route.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8',
      body: `<body style="margin:0;font:22px system-ui;background:#e7ded3;min-height:100vh;display:grid;place-items:center">
        <div style="background:#075e54;color:#fff;position:fixed;top:0;left:0;right:0;padding:16px 28px;font-weight:600">WhatsApp · Kasir Warung Kopi Nusantara</div>
        <div style="background:#d9fdd3;max-width:560px;padding:18px 22px;border-radius:14px;white-space:pre-wrap;box-shadow:0 1px 2px #0003">${esc}</div></body>`,
    })
  })

  const starts = []
  const failed = []
  for (let i = 0; i < steps.length; i++) {
    const [text, run] = steps[i]
    starts.push(Date.now() - t0 + LEAD)
    await limit(caption(page, text), 4000, 'caption').catch(() => {})
    await Promise.all([
      (async () => { try { await limit(Promise.resolve(run?.(page, ctx)), 25000, 'langkah') } catch (e) { failed.push(`${i + 1}: ${String(e.message).split('\n')[0]}`); await page.screenshot({ path: path.join(dir, `gagal-${i + 1}.png`) }).catch(() => {}); console.log('  ! langkah', i + 1, 'gagal; tangkapan layar:', path.join(dir, `gagal-${i + 1}.png`)) } })(),
      sleep(clips[i].ms + 500),
    ])
    await limit(caption(page, text), 4000, 'caption').catch(() => {})
    await sleep(300)
  }
  await sleep(800)
  const video = await page.video().path()
  await context.close()
  await browser.close()
  await role.after?.(ctx)

  // gabungkan suara ke video
  fs.mkdirSync(OUT, { recursive: true })
  const outFile = path.join(OUT, `${role.file}.mp4`)
  const inputs = clips.flatMap((c) => ['-i', c.file])
  const filter = clips.map((_, i) => `[${i + 1}:a]adelay=${starts[i]}|${starts[i]}[a${i}]`).join(';') + ';' +
    clips.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0:dropout_transition=0,volume=0.8[aout]`
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', video, ...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outFile], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('ffmpeg gagal: ' + r.stderr.slice(-500))
  const secs = Math.round(duration(outFile) / 1000)
  console.log(`  ✔ ${path.relative(ROOT, outFile)}  (${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')})`)
  if (failed.length) console.log(`  ⚠ langkah gagal (video tetap dibuat, periksa): ${failed.join(' | ')}`)
  return failed.length
}

const arg = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))
if (!arg) { console.error(`Pakai: node scripts/tutorial/record.mjs <${Object.keys(SETS[SET]).join('|')}|all> [--set peran|fitur] [--audio dir]`); process.exit(1) }
let bad = 0
for (const n of arg === 'all' ? Object.keys(SETS[SET]) : [arg]) bad += await record(n)
if (!process.env.TUTORIAL_KEEP) fs.rmSync(TMP, { recursive: true, force: true })
process.exit(bad ? 2 : 0)
