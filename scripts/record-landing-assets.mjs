import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('public/landing');
const TMP_VID_DIR = path.resolve('tmp-recordings');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(TMP_VID_DIR)) fs.rmSync(TMP_VID_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_VID_DIR, { recursive: true });

function convertPngToWebp(pngPath, webpPath) {
  try {
    execSync(`convert "${pngPath}" -quality 92 "${webpPath}"`);
    const size = Math.round(fs.statSync(webpPath).size / 1024);
    console.log(`✓ Converted: ${path.basename(webpPath)} (${size} KB)`);
  } catch (err) {
    console.error(`Failed to convert ${pngPath} to webp:`, err.message);
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });

  // ──────────────────────────────────────────
  // 1. KASIR POS (Tablet 1280x800)
  // ──────────────────────────────────────────
  console.log('\n--- 1. Recording Kasir POS ---');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_VID_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('kasir@pos.test');
    await page.getByLabel('Password').fill('kasir12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/cashier/, { timeout: 12000 });

    // Handle modal buka shift jika ada
    await page.waitForTimeout(1000);
    const modalBuka = page.locator('text=Buka Kasir');
    if (await modalBuka.isVisible()) {
      const modalBtn = page.getByRole('button', { name: /Buka Shift/i });
      if (await modalBtn.isVisible()) await modalBtn.click();
      await page.waitForTimeout(1000);
    }

    // Tunggu katalog menu
    await page.waitForSelector('button:has-text("Rp")', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Cari menu spesifik: Donat Glaze atau item pertama
    const donat = page.locator('button:has-text("Donat")').first();
    if (await donat.isVisible()) {
      await donat.click();
      await page.waitForTimeout(800);
    } else {
      await page.locator('button:has-text("Rp")').first().click();
      await page.waitForTimeout(800);
    }

    // Tangani jika ada dialog varian terbuka
    const dialogBtn = page.locator('div[role="dialog"] button:has-text("Tambah")').first();
    if (await dialogBtn.isVisible()) {
      await dialogBtn.click();
      await page.waitForTimeout(800);
    }

    // Tambah menu kopi / minuman
    const kopi = page.locator('button:has-text("Kopi"), button:has-text("Teh")').first();
    if (await kopi.isVisible()) {
      await kopi.click();
      await page.waitForTimeout(800);
      const dialogBtn2 = page.locator('div[role="dialog"] button:has-text("Tambah")').first();
      if (await dialogBtn2.isVisible()) {
        await dialogBtn2.click();
        await page.waitForTimeout(800);
      }
    }

    await page.waitForTimeout(1200);

    // Screenshot kasir jernih dan terisi keranjang
    const ssKasirPng = path.join(OUT_DIR, 'kasir-raw.png');
    await page.screenshot({ path: ssKasirPng });
    convertPngToWebp(ssKasirPng, path.join(OUT_DIR, 'kasir.webp'));
    fs.rmSync(ssKasirPng, { force: true });

    // Interaksi bayar
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

    await page.waitForTimeout(1500);
    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      const dest = path.join(OUT_DIR, 'video-kasir.webm');
      fs.copyFileSync(videoFile, dest);
      console.log(`✓ Video Kasir: ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    }
  }

  // ──────────────────────────────────────────
  // 2. MENU QR MEJA PELANGGAN (Mobile 390x844)
  // ──────────────────────────────────────────
  console.log('\n--- 2. Recording Menu QR Pelanggan ---');
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      recordVideo: { dir: TMP_VID_DIR, size: { width: 390, height: 844 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/s/warkop-nusantara?meja=T3');

    // Tunggu sampai skeleton selesai dan header toko muncul
    await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Scroll perlahan
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(800);

    // Tambah 1 item (klik menu)
    const itemBtn = page.locator('button:has-text("Rp")').first();
    if (await itemBtn.isVisible()) {
      await itemBtn.click();
      await page.waitForTimeout(800);
      const tambahBtn = page.locator('div[role="dialog"] button:has-text("Tambah"), button:has-text("Tambah ke keranjang")').first();
      if (await tambahBtn.isVisible()) {
        await tambahBtn.click();
        await page.waitForTimeout(800);
      }
    }

    // Screenshot tampilan menu pelanggan dengan floating cart
    const ssQrPng = path.join(OUT_DIR, 'pelanggan-raw.png');
    await page.screenshot({ path: ssQrPng });
    convertPngToWebp(ssQrPng, path.join(OUT_DIR, 'pelanggan.webp'));
    fs.rmSync(ssQrPng, { force: true });

    // Buka keranjang
    const cartBtn = page.getByRole('button', { name: /Lihat pesanan/i }).first();
    if (await cartBtn.isVisible()) {
      await cartBtn.click();
      await page.waitForTimeout(1200);
    }

    await page.waitForTimeout(1500);
    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      const dest = path.join(OUT_DIR, 'video-qr.webm');
      fs.copyFileSync(videoFile, dest);
      console.log(`✓ Video QR: ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    }
  }

  // ──────────────────────────────────────────
  // 3. LAYAR DAPUR KDS (Kitchen Display 1280x800)
  // ──────────────────────────────────────────
  console.log('\n--- 3. Recording Layar Dapur KDS ---');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_VID_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('admin@pos.test');
    await page.getByLabel('Password').fill('admin12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 12000 });

    await page.goto('http://localhost:5199/kitchen');
    await page.waitForTimeout(3000);

    // Screenshot dapur
    const ssDapurPng = path.join(OUT_DIR, 'dapur-raw.png');
    await page.screenshot({ path: ssDapurPng });
    convertPngToWebp(ssDapurPng, path.join(OUT_DIR, 'dapur.webp'));
    fs.rmSync(ssDapurPng, { force: true });

    // Interaksi jika ada kartu tiket
    const actionBtn = page.locator('article button').first();
    if (await actionBtn.isVisible()) {
      await actionBtn.click();
      await page.waitForTimeout(1200);
    }

    await page.waitForTimeout(1500);
    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      const dest = path.join(OUT_DIR, 'video-dapur.webm');
      fs.copyFileSync(videoFile, dest);
      console.log(`✓ Video Dapur: ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    }
  }

  // ──────────────────────────────────────────
  // 4. DASHBOARD LABA & LAPORAN (/admin)
  // ──────────────────────────────────────────
  console.log('\n--- 4. Recording Dashboard Laba & Finansial ---');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_VID_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('admin@pos.test');
    await page.getByLabel('Password').fill('admin12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 12000 });

    await page.goto('http://localhost:5199/admin');
    await page.waitForTimeout(3500);

    // Screenshot dashboard overview
    const ssDashPng = path.join(OUT_DIR, 'dashboard-raw.png');
    await page.screenshot({ path: ssDashPng });
    convertPngToWebp(ssDashPng, path.join(OUT_DIR, 'dashboard.webp'));
    fs.rmSync(ssDashPng, { force: true });

    // Scroll overview
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(1500);

    // Kunjungi laporan
    await page.goto('http://localhost:5199/admin/laporan');
    await page.waitForTimeout(2500);

    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      const dest = path.join(OUT_DIR, 'video-dashboard.webm');
      fs.copyFileSync(videoFile, dest);
      console.log(`✓ Video Dashboard: ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    }
  }

  // ──────────────────────────────────────────
  // 5. MANAJEMEN BAHAN BAKU & STOK (/admin/stok)
  // ──────────────────────────────────────────
  console.log('\n--- 5. Recording Manajemen Bahan Baku & Stok ---');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: TMP_VID_DIR, size: { width: 1280, height: 800 } }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5199/login');
    await page.getByLabel('Email').fill('admin@pos.test');
    await page.getByLabel('Password').fill('admin12345');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 12000 });

    await page.goto('http://localhost:5199/admin/stok');
    await page.waitForTimeout(3500);

    // Screenshot stok
    const ssStokPng = path.join(OUT_DIR, 'stok-raw.png');
    await page.screenshot({ path: ssStokPng });
    convertPngToWebp(ssStokPng, path.join(OUT_DIR, 'stok.webp'));
    fs.rmSync(ssStokPng, { force: true });

    // Scroll daftar bahan baku
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(2000);

    const videoFile = await page.video()?.path();
    await page.close();
    await context.close();

    if (videoFile && fs.existsSync(videoFile)) {
      const dest = path.join(OUT_DIR, 'video-stok.webm');
      fs.copyFileSync(videoFile, dest);
      console.log(`✓ Video Stok: ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    }
  }

  await browser.close();
  fs.rmSync(TMP_VID_DIR, { recursive: true, force: true });
  console.log('\n🎉 ALL ASSETS & VIDEOS RECORDED & CONVERTED!');
}

run().catch((err) => {
  console.error('Recording error:', err);
  process.exit(1);
});
