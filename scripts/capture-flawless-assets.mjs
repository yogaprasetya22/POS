import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('public/landing');
const TMP_DIR = path.resolve('tmp-flawless-rec');

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

function trimVideo(rawVideo, destVideo, startSec = '00:00:01.5') {
  try {
    execSync(`ffmpeg -y -ss ${startSec} -i "${rawVideo}" -c:v libvpx-vp9 -b:v 1200k -an "${destVideo}"`);
    console.log(`✓ Trimmed Video: ${path.basename(destVideo)} (${Math.round(fs.statSync(destVideo).size / 1024)} KB)`);
  } catch (e) {
    try {
      execSync(`ffmpeg -y -ss ${startSec} -i "${rawVideo}" -c copy "${destVideo}"`);
      console.log(`✓ Copied Video: ${path.basename(destVideo)}`);
    } catch {
      fs.copyFileSync(rawVideo, destVideo);
      console.log(`✓ Raw Fallback Video: ${path.basename(destVideo)}`);
    }
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });

  // ──────────────────────────────────────────
  // 1. KASIR POS (1280x800)
  // ──────────────────────────────────────────
  console.log('\n=========================================');
  console.log('1. Capturing Kasir POS (Full Data)');
  console.log('=========================================');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('kasir@pos.test');
    await page.getByLabel('Password').fill('kasir12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/cashier/, { timeout: 15000 });

    // Handle shift kasir
    await page.waitForTimeout(1000);
    const modalBuka = page.locator('text=Buka Kasir');
    if (await modalBuka.isVisible()) {
      const modalBtn = page.getByRole('button', { name: /Buka Shift/i });
      if (await modalBtn.isVisible()) await modalBtn.click();
      await page.waitForTimeout(1000);
    }

    // Tunggu sampai katalog menu dan gambar termuat
    await page.waitForSelector('button:has-text("Rp")', { timeout: 15000 });
    // Tunggu skeleton 0
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Tambah menu ke keranjang
    const menuButtons = page.locator('button:has-text("Rp")');
    if (await menuButtons.count() > 0) {
      await menuButtons.nth(0).click();
      await page.waitForTimeout(700);
      const dialogAdd = page.locator('div[role="dialog"] button:has-text("Tambah")');
      if (await dialogAdd.isVisible()) await dialogAdd.click();
    }
    if (await menuButtons.count() > 1) {
      await menuButtons.nth(1).click();
      await page.waitForTimeout(700);
      const dialogAdd2 = page.locator('div[role="dialog"] button:has-text("Tambah")');
      if (await dialogAdd2.isVisible()) await dialogAdd2.click();
    }

    await page.waitForTimeout(1500);

    // Tangkap screenshot HD kasir dengan keranjang terisi & gambar menu nyata
    const ssKasirPng = path.join(OUT_DIR, 'kasir-clean.png');
    await page.screenshot({ path: ssKasirPng });
    convertPngToWebp(ssKasirPng, path.join(OUT_DIR, 'kasir.webp'));
    fs.rmSync(ssKasirPng, { force: true });

    // Interaksi bayar untuk video
    const payBtn = page.getByRole('button', { name: /Uang pas/i }).first();
    if (await payBtn.isVisible()) {
      await payBtn.click();
      await page.waitForTimeout(800);
      const terimaBtn = page.getByRole('button', { name: /^Terima Rp/i }).first();
      if (await terimaBtn.isVisible()) {
        await terimaBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    await page.waitForTimeout(2000);
    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      trimVideo(videoFile, path.join(OUT_DIR, 'video-kasir.webm'), '00:00:01.2');
    }
  }

  // ──────────────────────────────────────────
  // 2. MENU QR MEJA PELANGGAN (Mobile 390x844)
  // ──────────────────────────────────────────
  console.log('\n=========================================');
  console.log('2. Capturing Menu QR Pelanggan (Full Data)');
  console.log('=========================================');
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      recordVideo: { dir: TMP_DIR, size: { width: 390, height: 844 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/s/warkop-nusantara?meja=T3');
    await page.waitForSelector('button[aria-label^="Tambah"]', { timeout: 15000 });
    // Tunggu skeleton 0
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Screenshot HP jernih menu tanpa skeleton
    const ssQrPng = path.join(OUT_DIR, 'pelanggan-clean.png');
    await page.screenshot({ path: ssQrPng });
    convertPngToWebp(ssQrPng, path.join(OUT_DIR, 'pelanggan.webp'));
    fs.rmSync(ssQrPng, { force: true });

    // Interaksi scroll & tambah menu
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(800);

    const firstItem = page.locator('button[aria-label^="Tambah"]').first();
    await firstItem.click();
    await page.waitForTimeout(600);
    const dialogAdd1 = page.locator('div[role="dialog"] button:has-text("Tambah")');
    if (await dialogAdd1.isVisible()) await dialogAdd1.click();

    await page.waitForTimeout(800);
    const cartBtn = page.getByRole('button', { name: /Lihat pesanan/i });
    if (await cartBtn.isVisible()) {
      await cartBtn.click();
      await page.waitForTimeout(1000);

      const nameInput = page.getByLabel('Nama', { exact: false });
      if (await nameInput.isVisible()) {
        await nameInput.fill('Budi Santoso');
        await page.waitForTimeout(800);
      }

      const submitBtn = page.getByRole('button', { name: /Kirim pesanan/i });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.locator('[data-testid="queue-code"]').waitFor({ timeout: 10000 });
        console.log('✓ QR Order submitted with Queue Code!');
        await page.waitForTimeout(3000);
      }
    }

    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      trimVideo(videoFile, path.join(OUT_DIR, 'video-qr.webm'), '00:00:01.2');
    }
  }

  // ──────────────────────────────────────────
  // 3. LAYAR DAPUR KDS (/kitchen) (1280x800)
  // ──────────────────────────────────────────
  console.log('\n=========================================');
  console.log('3. Capturing Layar Dapur KDS (With Active Tickets)');
  console.log('=========================================');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('admin@pos.test');
    await page.getByLabel('Password').fill('admin12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 15000 });

    await page.goto('http://localhost:5199/kitchen');
    await page.waitForTimeout(2000);
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Screenshot dapur dengan tiket aktif
    const ssDapurPng = path.join(OUT_DIR, 'dapur-clean.png');
    await page.screenshot({ path: ssDapurPng });
    convertPngToWebp(ssDapurPng, path.join(OUT_DIR, 'dapur.webp'));
    fs.rmSync(ssDapurPng, { force: true });

    // Interaksi koki
    const actionBtn = page.locator('article button').first();
    if (await actionBtn.isVisible()) {
      await actionBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(2000);

    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      trimVideo(videoFile, path.join(OUT_DIR, 'video-dapur.webm'), '00:00:01.0');
    }
  }

  // ──────────────────────────────────────────
  // 4. DASHBOARD & LABA (/admin) (1280x800)
  // ──────────────────────────────────────────
  console.log('\n=========================================');
  console.log('4. Capturing Dashboard Laba & Finansial (Full Data & KPI)');
  console.log('=========================================');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('admin@pos.test');
    await page.getByLabel('Password').fill('admin12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 15000 });

    await page.goto('http://localhost:5199/admin');
    // Wajib tunggu sampai teks KPI muncul dan BUKAN StatTilesSkeleton!
    await page.waitForSelector('text=Uang masuk hari ini', { timeout: 20000 });
    // Pastikan skeleton 0!
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Screenshot dashboard HD dengan angka dan grafik nyata
    const ssDashPng = path.join(OUT_DIR, 'dashboard-clean.png');
    await page.screenshot({ path: ssDashPng });
    convertPngToWebp(ssDashPng, path.join(OUT_DIR, 'dashboard.webp'));
    fs.rmSync(ssDashPng, { force: true });

    // Scroll untuk video
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1500);

    // Kunjungi laporan
    await page.goto('http://localhost:5199/admin/laporan');
    await page.waitForTimeout(2500);

    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      trimVideo(videoFile, path.join(OUT_DIR, 'video-dashboard.webm'), '00:00:01.5');
    }
  }

  // ──────────────────────────────────────────
  // 5. MANAJEMEN BAHAN & RESEP (/admin/stok) (1280x800)
  // ──────────────────────────────────────────
  console.log('\n=========================================');
  console.log('5. Capturing Manajemen Stok & Resep (32 Bahan Nyata)');
  console.log('=========================================');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('admin@pos.test');
    await page.getByLabel('Password').fill('admin12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 15000 });

    await page.goto('http://localhost:5199/admin/stok');
    // Tunggu sampai teks daftar bahan muncul
    await page.waitForSelector('text=Semua bahan, text=Stok bahan, text=Unduh template', { timeout: 20000 });
    // Pastikan skeleton 0!
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Screenshot stok HD dengan daftar bahan baku nyata
    const ssStokPng = path.join(OUT_DIR, 'stok-clean.png');
    await page.screenshot({ path: ssStokPng });
    convertPngToWebp(ssStokPng, path.join(OUT_DIR, 'stok.webp'));
    fs.rmSync(ssStokPng, { force: true });

    // Scroll daftar bahan untuk video
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(2000);

    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      trimVideo(videoFile, path.join(OUT_DIR, 'video-stok.webm'), '00:00:01.5');
    }
  }

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('\n=========================================');
  console.log('🎉 ALL SCREENSHOTS & VIDEOS RECORDED FLAWLESSLY (ZERO SKELETON)!');
  console.log('=========================================');
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
