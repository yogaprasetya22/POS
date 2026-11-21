import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('public/landing');
const TMP_DIR = path.resolve('tmp-qr-rec');

if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

async function run() {
  console.log('--- 1. Perekaman Alur Lengkap QR Meja Tuntas Sampai Akhir ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });

  // Buat context mobile iPhone/Android ratio
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    recordVideo: { dir: TMP_DIR, size: { width: 390, height: 844 } }
  });

  const page = await context.newPage();

  // Buka menu meja T3
  await page.goto('http://localhost:5199/s/warkop-nusantara?meja=T3');
  await page.waitForSelector('button[aria-label^="Tambah"]', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Ambil screenshot bersih menu pelanggan untuk landing page (pelanggan.webp)
  const ssQrPng = path.join(OUT_DIR, 'pelanggan-raw.png');
  await page.screenshot({ path: ssQrPng });
  execSync(`convert "${ssQrPng}" -quality 92 "${path.join(OUT_DIR, 'pelanggan.webp')}"`);
  fs.rmSync(ssQrPng, { force: true });
  console.log('✓ Screenshot pelanggan.webp diperbarui (jernih tanpa skeleton).');

  // Aksi 1: Scroll santai ke bawah melihat katalog menu
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(900);

  // Aksi 2: Tambah menu pertama (Pizza Personal / item pertama)
  const firstItem = page.locator('button[aria-label^="Tambah"]').first();
  await firstItem.click();
  await page.waitForTimeout(600);
  const dialogAdd1 = page.locator('div[role="dialog"] button:has-text("Tambah")');
  if (await dialogAdd1.isVisible()) {
    await dialogAdd1.click();
    await page.waitForTimeout(600);
  }

  // Aksi 3: Tambah menu kedua (item kedua)
  const secondItem = page.locator('button[aria-label^="Tambah"]').nth(1);
  if (await secondItem.isVisible()) {
    await secondItem.click();
    await page.waitForTimeout(600);
    const dialogAdd2 = page.locator('div[role="dialog"] button:has-text("Tambah")');
    if (await dialogAdd2.isVisible()) {
      await dialogAdd2.click();
      await page.waitForTimeout(600);
    }
  }

  await page.waitForTimeout(1000);

  // Aksi 4: Buka keranjang pesanan
  const cartBtn = page.getByRole('button', { name: /Lihat pesanan/i });
  await cartBtn.click();
  await page.waitForTimeout(1000);

  // Aksi 5: Isi nama pelanggan
  const nameInput = page.getByLabel('Nama', { exact: false });
  if (await nameInput.isVisible()) {
    await nameInput.fill('Budi Santoso');
    await page.waitForTimeout(800);
  }

  // Aksi 6: Kirim pesanan ke kasir & dapur
  const submitBtn = page.getByRole('button', { name: /Kirim pesanan/i });
  await submitBtn.click();

  // Aksi 7: Tunggu sampai konfirmasi kode antrean tampil
  await page.locator('[data-testid="queue-code"]').waitFor({ timeout: 10000 });
  const queueCode = await page.locator('[data-testid="queue-code"]').textContent();
  console.log(`✓ Pesanan berhasil dikirim! Kode antrean: ${queueCode}`);

  // Tampilkan layar sukses konfirmasi selama 3 detik agar calon penyewa bisa melihat jelas tiket antreannya
  await page.waitForTimeout(3000);

  const videoFile = await page.video()?.path();
  await page.close();
  await context.close();
  await browser.close();

  if (videoFile && fs.existsSync(videoFile)) {
    const rawDest = path.join(TMP_DIR, 'raw-qr.webm');
    fs.copyFileSync(videoFile, rawDest);

    const finalDest = path.join(OUT_DIR, 'video-qr.webm');
    // Potong 1.2 detik awal agar video langsung dibuka pada tampilan menu yang sudah jadi (tanpa skeleton)
    try {
      execSync(`ffmpeg -y -ss 00:00:01.2 -i "${rawDest}" -c:v libvpx-vp9 -b:v 1000k -an "${finalDest}"`);
      console.log(`✓ Trimmed video QR saved: ${finalDest} (${Math.round(fs.statSync(finalDest).size / 1024)} KB)`);
    } catch (e) {
      console.log('FFmpeg reencode fallback to copy:', e.message);
      try {
        execSync(`ffmpeg -y -ss 00:00:01.2 -i "${rawDest}" -c copy "${finalDest}"`);
        console.log(`✓ Video QR saved via copy: ${finalDest}`);
      } catch {
        fs.copyFileSync(rawDest, finalDest);
        console.log(`✓ Video QR saved raw: ${finalDest}`);
      }
    }
  }

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('🎉 Perekaman video QR meja tuntas sampai akhir sukses 100%!');
}

run().catch((err) => {
  console.error('Recording QR error:', err);
  process.exit(1);
});
