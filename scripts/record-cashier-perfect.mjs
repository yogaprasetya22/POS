import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('public/landing');
const TMP_DIR = path.resolve('tmp-cashier-rec');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

function convertPngToWebp(pngPath, webpPath) {
  try {
    execSync(`convert "${pngPath}" -quality 95 "${webpPath}"`);
    const size = Math.round(fs.statSync(webpPath).size / 1024);
    console.log(`✓ WebP saved: ${path.basename(webpPath)} (${size} KB)`);
  } catch (err) {
    console.error(`Failed to convert ${pngPath} to webp:`, err.message);
  }
}

function trimVideo(rawVideo, destVideo, startSec = '00:00:00.8') {
  try {
    execSync(`ffmpeg -y -ss ${startSec} -i "${rawVideo}" -c:v libvpx-vp9 -b:v 1400k -an "${destVideo}"`);
    console.log(`✓ Trimmed Video: ${path.basename(destVideo)} (${Math.round(fs.statSync(destVideo).size / 1024)} KB)`);
  } catch (e) {
    try {
      execSync(`ffmpeg -y -ss ${startSec} -i "${rawVideo}" -c copy "${destVideo}"`);
      console.log(`✓ Copied Video: ${path.basename(destVideo)}`);
    } catch {
      fs.copyFileSync(rawVideo, destVideo);
      console.log(`✓ Fallback Video: ${path.basename(destVideo)}`);
    }
  }
}

async function recordCashierFlow() {
  console.log('====================================================');
  console.log('🎥 Recording High-Precision Cashier Flow (1280x800)');
  console.log('====================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: TMP_DIR, size: { width: 1280, height: 800 } }
  });

  const page = await context.newPage();

  // 1. Login kasir
  await page.goto('http://localhost:5174/login');
  await page.getByLabel('Email').fill('kasir@pos.test');
  await page.getByLabel('Password').fill('kasir12345');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/\/cashier/, { timeout: 15000 });

  // Tunggu menu selesai load & zero skeleton
  await page.waitForSelector('button:has-text("Rp")', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // 2. Jika shift belum dibuka, tampilkan card baru lalu klik Buka Shift
  const openShiftBtn = page.getByRole('button', { name: /Buka Shift Sekarang/i });
  if (await openShiftBtn.isVisible()) {
    console.log('Found OpenShiftCard, demonstrating shift kickoff...');
    await page.waitForTimeout(1200);
    await openShiftBtn.click();
    await page.waitForTimeout(1500);
  }

  // 3. Tambahkan Meja & Nama Pelanggan
  const tableInput = page.getByPlaceholder('Meja', { exact: false });
  if (await tableInput.isVisible()) {
    await tableInput.fill('04');
    await page.waitForTimeout(400);
  }

  const nameInput = page.getByPlaceholder('Nama pelanggan', { exact: false });
  if (await nameInput.isVisible()) {
    await nameInput.fill('Dimas');
    await page.waitForTimeout(400);
  }

  // 4. Pilih kategori Makanan
  const catBtn = page.getByRole('button', { name: /^Makanan$/i });
  if (await catBtn.isVisible()) {
    await catBtn.click();
    await page.waitForTimeout(600);
  }

  // 5. Tambah item ke keranjang
  const nasiGoreng = page.locator('article, button').filter({ hasText: /Nasi Goreng/i }).first();
  if (await nasiGoreng.isVisible()) {
    await nasiGoreng.click();
    await page.waitForTimeout(600);
    const dialogBtn = page.locator('div[role="dialog"] button:has-text("Tambah")');
    if (await dialogBtn.isVisible()) await dialogBtn.click();
  }

  // 6. Pilih kategori Minuman
  const drinkCat = page.getByRole('button', { name: /^Minuman$/i });
  if (await drinkCat.isVisible()) {
    await drinkCat.click();
    await page.waitForTimeout(600);
  }

  // 7. Tambah Cafe Latte
  const cafeLatte = page.locator('article, button').filter({ hasText: /Cafe Latte|Kopi/i }).first();
  if (await cafeLatte.isVisible()) {
    await cafeLatte.click();
    await page.waitForTimeout(600);
    const dialogBtn = page.locator('div[role="dialog"] button:has-text("Tambah")');
    if (await dialogBtn.isVisible()) await dialogBtn.click();
  }

  // Tunggu keranjang terisi rapi
  await page.waitForTimeout(1000);

  // 8. TANGKAP SCREENSHOT HD KASIR TERBAIK (kasir.webp)
  // Menampilkan shift aktif, keranjang terisi pesanan Dimas Meja 04, tombol bayar siap
  const ssKasirPng = path.join(OUT_DIR, 'kasir-clean.png');
  await page.screenshot({ path: ssKasirPng });
  convertPngToWebp(ssKasirPng, path.join(OUT_DIR, 'kasir.webp'));
  fs.rmSync(ssKasirPng, { force: true });
  console.log('✓ kasir.webp captured with filled cart and active shift!');

  // 9. Lanjutkan alur bayar untuk video demo
  const uangPasBtn = page.getByRole('button', { name: /Uang pas/i }).first();
  if (await uangPasBtn.isVisible()) {
    await uangPasBtn.click();
    await page.waitForTimeout(800);
  }

  const bayarSubmit = page.getByRole('button', { name: /^Bayar Rp/i }).first();
  if (await bayarSubmit.isVisible()) {
    await bayarSubmit.click();
    await page.waitForTimeout(2000);
  }

  // Tunggu struk selesai tampil
  await page.waitForTimeout(2500);

  // Ambil video dan tutup
  const videoFile = await page.video()?.path();
  await page.close();
  await context.close();
  await browser.close();

  if (videoFile && fs.existsSync(videoFile)) {
    trimVideo(videoFile, path.join(OUT_DIR, 'video-kasir.webm'), '00:00:00.6');
  }

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('🎉 Cashier video and HD screenshot generated successfully!');
}

recordCashierFlow().catch((err) => {
  console.error('Recording error:', err);
  process.exit(1);
});

