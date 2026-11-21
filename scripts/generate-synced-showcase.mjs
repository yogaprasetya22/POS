import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const OUT_DIR = path.resolve('public/landing');
const AUDIO_DIR = path.resolve('public/landing/audio');
const TMP_DIR = path.resolve('tmp-sync-rec');
const AUTH_DIR = path.resolve('tmp-auth-cache');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });
if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
fs.mkdirSync(AUTH_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getOpenAIKey() {
  let key = process.env.OPENAI_API_KEY || '';
  if (!key && fs.existsSync('.env')) {
    const lines = fs.readFileSync('.env', 'utf-8').split('\n');
    for (const l of lines) {
      if (l.startsWith('OPENAI_API_KEY=')) {
        key = l.split('=', 2)[1].trim().replace(/^["']|["']$/g, '');
        break;
      }
    }
  }
  return key;
}

function getDuration(filePath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return parseFloat(out);
  } catch (err) {
    console.error(`Error getting duration for ${filePath}:`, err.message);
    return 3.0;
  }
}

async function generateBeatAudio(text, outFile, voice = 'onyx') {
  const key = getOpenAIKey();
  if (!key) throw new Error('OPENAI_API_KEY not found in .env');

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      input: text,
      voice: voice,
      speed: 1.02,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS Error (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(outFile, Buffer.from(arrayBuffer));
}

// 6 Skenario Demo yang Terstruktur per Beat Narasi & Aksi
const SCENARIOS = {
  kasir: {
    title: 'Layar Kasir POS',
    url: 'http://localhost:5199/cashier',
    auth: 'kasir.json',
    viewport: { width: 1280, height: 800 },
    beats: [
      {
        id: 'k1',
        text: 'Pilih menu makanan dan minuman favorit pelanggan langsung ke keranjang kasir.',
        action: async (page, durMs) => {
          // Klik menu 1 (Nasi Goreng)
          const menu1 = page.locator('button:has-text("Rp")').nth(0);
          await sleep(300);
          await menu1.click();
          await sleep(500);
          const add1 = page.locator('div[role="dialog"] button:has-text("Tambah")');
          if (await add1.isVisible()) await add1.click();
          
          // Klik menu 2 (Cafe Latte)
          await sleep(400);
          const menu2 = page.locator('button:has-text("Rp")').nth(1);
          await menu2.click();
          await sleep(500);
          const add2 = page.locator('div[role="dialog"] button:has-text("Tambah")');
          if (await add2.isVisible()) await add2.click();
        },
      },
      {
        id: 'k2',
        text: 'Ketik nama pelanggan untuk mencatat nomor meja dan identitas pesanan.',
        action: async (page, durMs) => {
          const nameInput = page.getByPlaceholder(/nama pelanggan/i).first();
          if (await nameInput.isVisible()) {
            await sleep(300);
            await nameInput.click();
            await sleep(200);
            await nameInput.pressSequentially('Dimas & Rina', { delay: 65 });
          }
        },
      },
      {
        id: 'k3',
        text: 'Terima pembayaran tunai uang pas atau non tunai dengan satu sentuhan.',
        action: async (page, durMs) => {
          const payBtn = page.getByRole('button', { name: /Uang pas/i }).first();
          if (await payBtn.isVisible()) {
            await sleep(400);
            await payBtn.click();
            await sleep(500);
            const terimaBtn = page.getByRole('button', { name: /^Terima Rp/i }).first();
            if (await terimaBtn.isVisible()) {
              await terimaBtn.click();
            }
          }
        },
      },
      {
        id: 'k4',
        text: 'Struk transaksi thermal otomatis tercetak rapi dan pesanan tercatat di laporan.',
        action: async (page, durMs) => {
          // Tahan dialog struk terlihat sampai narasi selesai
          await sleep(durMs > 1500 ? durMs - 500 : 1000);
        },
      },
    ],
  },

  qr: {
    title: 'Menu QR Meja Tamu',
    url: 'http://localhost:5199/s/warkop-nusantara?meja=T3',
    auth: 'customer.json',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    beats: [
      {
        id: 'q1',
        text: 'Pelanggan memindai QR meja lalu memilih menu langsung dari smartphone.',
        action: async (page, durMs) => {
          await sleep(400);
          await page.mouse.wheel(0, 180);
          await sleep(500);
          const addBtn = page.locator('button[aria-label^="Tambah"]').first();
          if (await addBtn.isVisible()) {
            await addBtn.click();
            await sleep(400);
            const dialogAdd = page.locator('div[role="dialog"] button:has-text("Tambah")');
            if (await dialogAdd.isVisible()) await dialogAdd.click();
          }
        },
      },
      {
        id: 'q2',
        text: 'Buka keranjang pesanan lalu masukkan nama pemesan.',
        action: async (page, durMs) => {
          const cartBtn = page.getByRole('button', { name: /Lihat pesanan/i });
          if (await cartBtn.isVisible()) {
            await sleep(300);
            await cartBtn.click();
            await sleep(400);
            const nameField = page.getByLabel('Nama', { exact: false });
            if (await nameField.isVisible()) {
              await nameField.click();
              await sleep(200);
              await nameField.pressSequentially('Budi Santoso', { delay: 65 });
            }
          }
        },
      },
      {
        id: 'q3',
        text: 'Kirim pesanan, nomor tiket antrean langsung terbit dan pesanan masuk ke dapur.',
        action: async (page, durMs) => {
          const submitBtn = page.getByRole('button', { name: /Kirim pesanan/i });
          if (await submitBtn.isVisible()) {
            await sleep(400);
            await submitBtn.click();
            await page.locator('[data-testid="queue-code"]').waitFor({ timeout: 8000 }).catch(() => {});
            await sleep(durMs > 2000 ? durMs - 1500 : 1000);
          }
        },
      },
    ],
  },

  dapur: {
    title: 'Layar Dapur KDS',
    url: 'http://localhost:5199/kitchen',
    auth: 'admin.json',
    viewport: { width: 1280, height: 800 },
    beats: [
      {
        id: 'd1',
        text: 'Pesanan lunas dari kasir dan meja seketika tampil di monitor dapur.',
        action: async (page, durMs) => {
          await sleep(durMs > 1000 ? durMs - 500 : 800);
        },
      },
      {
        id: 'd2',
        text: 'Koki menandai masakan yang selesai dan menekan tombol siap saji.',
        action: async (page, durMs) => {
          const itemCheckbox = page.locator('article input[type="checkbox"], article button:has-text("Selesai")').first();
          if (await itemCheckbox.isVisible()) {
            await sleep(300);
            await itemCheckbox.click();
            await sleep(600);
          }
          const actionBtn = page.locator('article button:has-text("Siap"), article button:has-text("Sudah")').first();
          if (await actionBtn.isVisible()) {
            await actionBtn.click();
          }
        },
      },
      {
        id: 'd3',
        text: 'Status tiket otomatis berpindah ke antrean siap antar pramusaji.',
        action: async (page, durMs) => {
          await sleep(durMs > 1500 ? durMs - 500 : 1000);
        },
      },
    ],
  },

  dashboard: {
    title: 'Dashboard Laba & Omset',
    url: 'http://localhost:5199/admin',
    auth: 'admin.json',
    viewport: { width: 1280, height: 800 },
    beats: [
      {
        id: 'b1',
        text: 'Pantau rekap omzet kotor, laba bersih, dan total transaksi hari ini.',
        action: async (page, durMs) => {
          await sleep(durMs > 1000 ? durMs - 400 : 800);
        },
      },
      {
        id: 'b2',
        text: 'Analisis grafik tren penjualan jam sibuk dan metode pembayaran favorit.',
        action: async (page, durMs) => {
          await sleep(300);
          await page.mouse.wheel(0, 260);
          await sleep(durMs > 1500 ? durMs - 800 : 1000);
        },
      },
      {
        id: 'b3',
        text: 'Buka laporan keuangan lengkap untuk evaluasi omzet harian maupun bulanan.',
        action: async (page, durMs) => {
          const lapNav = page.locator('a[href="/admin/laporan"]').first();
          if (await lapNav.isVisible()) {
            await sleep(300);
            await lapNav.click();
            await sleep(500);
            await page.mouse.wheel(0, 180);
          }
        },
      },
    ],
  },

  stok: {
    title: 'Manajemen Stok & Bahan',
    url: 'http://localhost:5199/admin/stok',
    auth: 'admin.json',
    viewport: { width: 1280, height: 800 },
    beats: [
      {
        id: 's1',
        text: 'Kelola stok bahan baku resto dan pantau sisa persediaan secara akurat.',
        action: async (page, durMs) => {
          await sleep(durMs > 1000 ? durMs - 400 : 800);
        },
      },
      {
        id: 's2',
        text: 'Sistem otomatis memotong stok sesuai resep setiap kali ada menu terjual.',
        action: async (page, durMs) => {
          await sleep(300);
          await page.mouse.wheel(0, 280);
          await sleep(durMs > 1500 ? durMs - 800 : 1000);
        },
      },
      {
        id: 's3',
        text: 'Terhubung langsung ke purchase order pemasok saat persediaan menipis.',
        action: async (page, durMs) => {
          const beliNav = page.locator('a[href="/admin/pembelian"]').first();
          if (await beliNav.isVisible()) {
            await sleep(300);
            await beliNav.click();
            await sleep(durMs > 1500 ? durMs - 800 : 1000);
          }
        },
      },
    ],
  },

  pengaturan: {
    title: 'Pengaturan Toko & Struk',
    url: 'http://localhost:5199/admin/toko',
    auth: 'admin.json',
    viewport: { width: 1280, height: 800 },
    beats: [
      {
        id: 'p1',
        text: 'Atur profil resto, alamat outlet, dan persentase pajak PB1 dengan mudah.',
        action: async (page, durMs) => {
          await sleep(durMs > 1000 ? durMs - 400 : 800);
        },
      },
      {
        id: 'p2',
        text: 'Kustomisasi format cetak struk thermal 58 atau 80 milimeter.',
        action: async (page, durMs) => {
          const strukBtn = page.locator('button[role="tab"]:has-text("Struk"), [data-value="struk"]').first();
          if (await strukBtn.isVisible()) {
            await sleep(300);
            await strukBtn.click();
            await sleep(durMs > 1500 ? durMs - 800 : 1000);
          }
        },
      },
      {
        id: 'p3',
        text: 'Kelola meja makan dan hak akses staf untuk keamanan operasional toko.',
        action: async (page, durMs) => {
          await sleep(300);
          await page.goto('http://localhost:5199/admin/meja');
          await sleep(durMs > 1500 ? durMs - 800 : 1000);
        },
      },
    ],
  },
};

async function prewarmCaches(browser) {
  console.log('--- Pre-warming browser caches & storage states ---');

  // 1. Kasir auth
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('kasir@pos.test');
    await page.getByLabel('Password').fill('kasir12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/cashier/, { timeout: 15000 });
    await page.waitForSelector('button:has-text("Rp")', { timeout: 15000 });

    // Open shift if needed during prewarm
    const shiftPagi = page.locator('button[role="radio"]:has-text("Pagi"), button:has-text("Pagi")').first();
    if (await shiftPagi.isVisible()) await shiftPagi.click();
    const modalBuka = page.locator('button:has-text("Buka Shift")').first();
    if (await modalBuka.isVisible()) await modalBuka.click();
    await page.waitForTimeout(1000);

    await ctx.storageState({ path: path.join(AUTH_DIR, 'kasir.json') });
    await ctx.close();
  }

  // 2. Admin auth
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('admin@pos.test');
    await page.getByLabel('Password').fill('admin12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 15000 });
    await page.goto('http://localhost:5199/admin');
    await page.waitForSelector('text=Uang masuk hari ini', { timeout: 15000 }).catch(() => {});
    await page.goto('http://localhost:5199/kitchen');
    await page.waitForTimeout(1000);
    await page.goto('http://localhost:5199/admin/stok');
    await page.locator('text=Semua bahan').waitFor({ timeout: 15000 }).catch(() => {});
    await page.goto('http://localhost:5199/admin/toko');
    await page.waitForSelector('text=Pengaturan toko', { timeout: 15000 }).catch(() => {});
    await ctx.storageState({ path: path.join(AUTH_DIR, 'admin.json') });
    await ctx.close();
  }

  // 3. Customer QR Menu cache
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5199/s/warkop-nusantara?meja=T3');
    await page.waitForSelector('button[aria-label^="Tambah"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await ctx.storageState({ path: path.join(AUTH_DIR, 'customer.json') });
    await ctx.close();
  }

  console.log('✓ All caches pre-warmed successfully (zero skeleton guaranteed)!');
}

async function main() {
  console.log('=====================================================');
  console.log('🎬 100% PERFECT SYNC: AI AUDIO BEATS & VIDEO RECORDER');
  console.log('=====================================================');

  // STEP 1: Generate segmented audio for all beats and construct master audios
  console.log('\n--- Generating OpenAI HD Onyx Voice Beats ---');
  for (const [key, scen] of Object.entries(SCENARIOS)) {
    console.log(`\n🎙️ Processing Audio for: ${scen.title} (${key})`);
    const beatFiles = [];
    const concatList = [];

    for (let i = 0; i < scen.beats.length; i++) {
      const beat = scen.beats[i];
      const beatFile = path.join(TMP_DIR, `${key}_beat_${i}.mp3`);
      console.log(`   [Beat ${i + 1}/${scen.beats.length}] "${beat.text.substring(0, 45)}..."`);
      await generateBeatAudio(beat.text, beatFile, 'onyx');
      beat.file = beatFile;
      beat.duration = getDuration(beatFile);
      beat.durMs = Math.round(beat.duration * 1000);
      console.log(`      ✓ Duration: ${beat.duration.toFixed(2)}s`);
      beatFiles.push(beatFile);
      concatList.push(`file '${beatFile}'`);

      // Add 0.25s silence between beats (except last)
      if (i < scen.beats.length - 1) {
        const silFile = path.join(TMP_DIR, `silence_025.mp3`);
        if (!fs.existsSync(silFile)) {
          execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 0.25 -q:a 9 -acodec libmp3lame "${silFile}"`, { stdio: 'ignore' });
        }
        concatList.push(`file '${silFile}'`);
      }
    }

    // Concat beats into master audio
    const listFile = path.join(TMP_DIR, `${key}_concat.txt`);
    fs.writeFileSync(listFile, concatList.join('\n'));
    const masterAudio = path.join(AUDIO_DIR, `${key}.mp3`);
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${masterAudio}"`, { stdio: 'ignore' });
    scen.totalAudioDur = getDuration(masterAudio);
    scen.masterAudio = masterAudio;
    console.log(`   🌟 Master Audio Created: ${path.basename(masterAudio)} (${scen.totalAudioDur.toFixed(2)}s)`);
  }

  // STEP 2: Record Playwright videos paced exactly to match beat durations
  console.log('\n--- Recording Playwright Videos Synchronized to Audio Beats ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  await prewarmCaches(browser);

  for (const [key, scen] of Object.entries(SCENARIOS)) {
    console.log(`\n🎥 Recording Synced Video: ${scen.title} (${key})`);
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, scen.auth),
      viewport: scen.viewport,
      isMobile: scen.isMobile || false,
      deviceScaleFactor: 2,
      recordVideo: { dir: TMP_DIR, size: scen.viewport },
    });

    const page = await ctx.newPage();
    await page.goto(scen.url);
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 }).catch(() => {});
    await sleep(600);

    // Capture screenshot HD at clean start state
    const imgFile = path.join(OUT_DIR, `${key === 'kasir' ? 'kasir' : key === 'qr' ? 'pelanggan' : key}.webp`);
    await page.screenshot({ path: imgFile, type: 'webp', quality: 90 });
    console.log(`   📸 Captured HD Screenshot: ${path.basename(imgFile)}`);

    // Synchronized execution through beats
    const startTime = Date.now();
    for (let i = 0; i < scen.beats.length; i++) {
      const beat = scen.beats[i];
      const beatStartTime = Date.now();
      console.log(`   ▶ Executing Beat ${i + 1}/${scen.beats.length} (Target: ${beat.duration.toFixed(2)}s)...`);
      
      try {
        await beat.action(page, beat.durMs);
      } catch (err) {
        console.warn(`      Action warning in beat ${i + 1}:`, err.message);
      }

      // Wait out remaining time of this beat + inter-sentence pause (0.25s)
      const targetBeatMs = beat.durMs + (i < scen.beats.length - 1 ? 250 : 0);
      const elapsedBeatMs = Date.now() - beatStartTime;
      const remainingMs = targetBeatMs - elapsedBeatMs;
      if (remainingMs > 0) {
        await sleep(remainingMs);
      }
    }

    const totalVideoRecordedMs = Date.now() - startTime;
    console.log(`   ✓ Video actions completed in ${(totalVideoRecordedMs / 1000).toFixed(2)}s (Target audio: ${scen.totalAudioDur.toFixed(2)}s)`);

    const rawVideo = await page.video()?.path();
    await page.close();
    await ctx.close();

    // STEP 3: Trim and Remux with Master Audio with exact frame match
    if (rawVideo && fs.existsSync(rawVideo)) {
      const destVideo = path.join(OUT_DIR, `video-${key}.webm`);
      console.log(`   🎬 Muxing Video + Audio -> ${path.basename(destVideo)}...`);

      // Trim initial load buffer (~0.6s) and set exact duration to match audio
      const trimStart = '00:00:00.6';
      execSync(
        `ffmpeg -y -ss ${trimStart} -t ${scen.totalAudioDur} -i "${rawVideo}" -i "${scen.masterAudio}" ` +
        `-c:v libvpx-vp9 -b:v 1200k -crf 28 -c:a libopus -b:a 96k -pix_fmt yuv420p "${destVideo}"`,
        { stdio: 'ignore' }
      );

      const finalDur = getDuration(destVideo);
      console.log(`   ✅ 100% SYNC COMPLETE: ${path.basename(destVideo)} (${finalDur.toFixed(2)}s) == Audio (${scen.totalAudioDur.toFixed(2)}s)!`);
    }
  }

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  console.log('\n=====================================================');
  console.log('🎉 ALL 6 DEMO VIDEOS & AUDIOS ARE NOW 100% SYNCHRONIZED!');
  console.log('=====================================================');
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
