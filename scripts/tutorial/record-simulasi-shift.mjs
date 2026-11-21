/**
 * Rekam video panduan simulasi shift kasir:
 * - Modal pagi Rp 100.000
 * - Uang laci jadi Rp 250.000 (omzet masuk Rp 150.000)
 * - Tutup shift & pembagian uang:
 *   * Tinggalkan modal Rp 100.000 di laci untuk shift berikutnya
 *   * Setor omzet Rp 150.000 ke owner hari ini juga
 *
 * Output: docs/videos/simulasi-shift-kasir.mp4
 */
import { chromium } from '@playwright/test'
import { spawnSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ACC, clearShifts } from './roles.mjs'

const BASE = 'http://localhost:5199'
const ROOT = path.resolve(import.meta.dirname, '../..')
const OUT = path.join(ROOT, 'docs/videos')
const AUDIO_DIR = path.join(OUT, '.audio-cache')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(AUDIO_DIR, { recursive: true })
fs.mkdirSync(OUT, { recursive: true })

const SCENES = [
  {
    id: 1,
    title: 'Login Kasir',
    text: 'Simulasi kasir: modal pagi seratus ribu rupiah, penjualan tunai, dan pembagian uang laci.',
    run: async (page) => {
      await page.goto(BASE + '/login')
      await page.waitForTimeout(600)
      const useEmailBtn = page.getByRole('button', { name: /Masuk pakai email/i })
      if (await useEmailBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await useEmailBtn.click()
        await page.waitForTimeout(400)
      }
      await page.getByLabel('Email').fill(ACC.cashier[0])
      await page.getByLabel('Password').fill(ACC.cashier[1])
      await page.getByRole('button', { name: 'Masuk' }).click()
      await page.waitForURL(/\/cashier/, { timeout: 10000 })
      await page.waitForTimeout(1000)
    },
  },
  {
    id: 2,
    title: 'Buka Shift Pagi (Modal Rp 100.000)',
    text: 'Kasir memilih shift pagi dan memastikan modal awal seratus ribu rupiah tersedia sebagai uang kembalian.',
    run: async (page) => {
      const radioPagi = page.getByRole('radio', { name: 'Pagi' })
      if (await radioPagi.isVisible({ timeout: 2000 }).catch(() => false)) {
        await radioPagi.hover()
        await page.waitForTimeout(400)
        await radioPagi.click()
        await page.waitForTimeout(500)
      }

      const modalInput = page.getByLabel(/Modal awal/i)
      if (await modalInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await modalInput.hover()
        await page.waitForTimeout(400)
        const val = await modalInput.inputValue()
        if (val !== '100000' && val !== '100.000') {
          await modalInput.fill('100000')
          await page.waitForTimeout(400)
        }
      }

      const bukaBtn = page.getByRole('button', { name: 'Buka shift' })
      await bukaBtn.hover()
      await page.waitForTimeout(500)
      await bukaBtn.click()
      await page.waitForSelector('text=Kas & tutup shift', { timeout: 10000 })
      await page.waitForTimeout(1000)
    },
  },
  {
    id: 3,
    title: 'Penjualan Tunai Masuk Rp 150.000',
    text: 'Selama jam operasional, ada pemasukan tunai seratus lima puluh ribu rupiah, sehingga fisik laci menjadi dua ratus lima puluh ribu rupiah.',
    run: async (page) => {
      const btnKas = page.getByRole('button', { name: /Kas & tutup shift/i })
      await btnKas.hover()
      await page.waitForTimeout(400)
      await btnKas.click()
      await page.waitForTimeout(600)

      const btnKasMasuk = page.getByRole('button', { name: 'Kas masuk', exact: true })
      await btnKasMasuk.hover()
      await page.waitForTimeout(400)
      await btnKasMasuk.click()
      await page.waitForTimeout(500)

      const inputJumlah = page.getByLabel('Jumlah', { exact: true })
      await inputJumlah.fill('150000')
      await page.waitForTimeout(400)

      const inputAlasan = page.getByLabel('Alasan', { exact: true })
      await inputAlasan.fill('Penjualan tunai shift pagi')
      await page.waitForTimeout(500)

      const btnSimpan = page.getByRole('button', { name: 'Simpan', exact: true })
      await btnSimpan.hover()
      await page.waitForTimeout(400)
      await btnSimpan.click()
      await page.waitForTimeout(1200)
    },
  },
  {
    id: 4,
    title: 'Persiapan Tutup Shift',
    text: 'Saat pergantian shift, kasir membuka menu kas dan tutup shift untuk menghitung fisik uang.',
    run: async (page) => {
      const btnKas = page.getByRole('button', { name: /Kas & tutup shift/i })
      const countInput = page.getByLabel(/Uang yang dihitung di laci/i)
      if (!await countInput.isVisible().catch(() => false)) {
        await btnKas.hover()
        await page.waitForTimeout(400)
        await btnKas.click()
        await page.waitForTimeout(800)
      }
    },
  },
  {
    id: 5,
    title: 'Hitung Uang Fisik (Rp 250.000)',
    text: 'Seluruh uang fisik di laci dihitung. Kasir memasukkan angka dua ratus lima puluh ribu rupiah. Status kas langsung pas dan cocok.',
    run: async (page) => {
      const countInput = page.getByLabel(/Uang yang dihitung di laci/i)
      await countInput.hover()
      await page.waitForTimeout(400)
      await countInput.fill('250000')
      await page.waitForTimeout(1000)
    },
  },
  {
    id: 6,
    title: 'Eksekusi Tutup Shift',
    text: 'Tekan tombol tutup shift. Sistem POS secara otomatis memecah uang laci sesuai aturan operasional toko.',
    run: async (page) => {
      const btnTutup = page.getByRole('button', { name: 'Tutup shift', exact: true })
      await btnTutup.hover()
      await page.waitForTimeout(500)
      await btnTutup.click()
      await page.waitForSelector('text=Shift ditutup', { timeout: 10000 })
      await page.waitForTimeout(1000)
    },
  },
  {
    id: 7,
    title: 'Aturan Pembagian Uang Laci',
    text: 'Modal seratus ribu rupiah tetap ditinggalkan di laci untuk kasir berikutnya, sedangkan omzet seratus lima puluh ribu rupiah disetor ke owner hari ini juga.',
    run: async (page) => {
      // Sorot baris "Setor ke owner" dan "Tinggalkan di laci"
      const dialog = page.locator('[role=dialog]')
      if (await dialog.isVisible()) {
        await dialog.hover()
      }
      await page.waitForTimeout(5000)
    },
  },
]

// 1. Generate Voice per Scene
console.log('[video-simulasi] 🎙️ Menyiapkan audio narasi (Microsoft Edge TTS id-ID-GadisNeural)...')
const clips = []
for (let i = 0; i < SCENES.length; i++) {
  const wavPath = path.join(AUDIO_DIR, `sim-scene-${i + 1}.mp3`)
  const text = SCENES[i].text

  if (!fs.existsSync(wavPath) || fs.statSync(wavPath).size < 1000) {
    const pyCode = `
import asyncio, edge_tts
async def run():
    await edge_tts.Communicate("${text.replace(/"/g, '\\"')}", "id-ID-GadisNeural", rate="-2%").save("${wavPath}")
asyncio.run(run())
`
    execSync(`python3 -c '${pyCode}'`)
  }

  const durProbe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wavPath], { encoding: 'utf8' })
  const ms = Number(durProbe.stdout.trim()) * 1000
  clips.push({ file: wavPath, ms })
  console.log(`  ✓ Scene ${i + 1}: ${Math.round(ms)}ms - "${text.slice(0, 50)}..."`)
}

// 2. Playwright Video Recording
console.log('\n[video-simulasi] 🎥 Merekam layar aplikasi POS dengan Playwright...')
await clearShifts()

const videoDir = path.join(OUT, '.video-raw')
fs.mkdirSync(videoDir, { recursive: true })

const browser = await chromium.launch({ headless: true, slowMo: 80 })
const context = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
})

const CURSOR = () => {
  const mk = () => {
    if (document.getElementById('__cur')) return
    const c = document.createElement('div')
    c.id = '__cur'
    c.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:24px;height:24px;border-radius:50%;background:rgba(37,99,235,.38);border:2.5px solid #2563eb;transform:translate(-50%,-50%);transition:left .25s cubic-bezier(.2,.8,.2,1),top .25s cubic-bezier(.2,.8,.2,1);left:-60px;top:-60px;box-shadow:0 0 10px rgba(37,99,235,.5)'
    document.documentElement.appendChild(c)
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mk) : mk()
}
await context.addInitScript(CURSOR)

const page = await context.newPage()
page.setDefaultTimeout(12000)

const caption = async (p, t) => {
  await p.evaluate((text) => {
    let el = document.getElementById('__cap')
    if (!el) {
      el = document.createElement('div')
      el.id = '__cap'
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:88%;z-index:2147483646;pointer-events:none;background:rgba(15,23,42,.92);color:#fff;font:600 17px/1.4 system-ui,-apple-system,sans-serif;padding:12px 24px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.45);text-align:center;border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(8px)'
      document.documentElement.appendChild(el)
    }
    el.textContent = text
  }, t).catch(() => {})
}

const t0 = Date.now()
const LEAD = 600
const starts = []

for (let i = 0; i < SCENES.length; i++) {
  const scene = SCENES[i]
  starts.push(Date.now() - t0 + LEAD)
  await caption(page, scene.text)
  console.log(`  ▶ Menjalankan scene ${i + 1} (${scene.title})...`)
  await Promise.all([
    scene.run(page).catch((err) => console.error(`    [!] Catatan scene ${i + 1}:`, err.message)),
    sleep(clips[i].ms + 800),
  ])
  await sleep(400)
}

await sleep(1500)
const videoPath = await page.video().path()
await context.close()
await browser.close()
await clearShifts()

console.log('\n[video-simulasi] 🎬 Menyatukan video & narasi suara dengan ffmpeg...')
const finalMp4 = path.join(OUT, 'simulasi-shift-kasir.mp4')

const inputs = clips.flatMap((c) => ['-i', c.file])
const filter = clips.map((_, i) => `[${i + 1}:a]adelay=${starts[i]}|${starts[i]}[a${i}]`).join(';') + ';' +
  clips.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0:dropout_transition=0,volume=0.95[aout]`

const r = spawnSync('ffmpeg', [
  '-y', '-v', 'error',
  '-i', videoPath,
  ...inputs,
  '-filter_complex', filter,
  '-map', '0:v',
  '-map', '[aout]',
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '21',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  finalMp4,
], { encoding: 'utf8' })

if (r.status !== 0) {
  throw new Error('ffmpeg failed: ' + r.stderr)
}

fs.rmSync(videoDir, { recursive: true, force: true })
const finalSize = fs.statSync(finalMp4).size
const durTotal = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', finalMp4], { encoding: 'utf8' }).stdout.trim())

console.log(`\n============================================================`)
console.log(`✅ VIDEO SIMULASI BERHASIL DIBUAT DENGAN SEMPURNA!`)
console.log(`📁 File: ${finalMp4}`)
console.log(`⏱️ Durasi: ${Math.round(durTotal)} detik`)
console.log(`📦 Ukuran: ${(finalSize / (1024 * 1024)).toFixed(2)} MB`)
console.log(`============================================================`)
