import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('public/landing');
const TMP_DIR = path.resolve('tmp-settings-rec');
const AUTH_FILE = path.join(TMP_DIR, 'auth.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

async function run() {
  console.log('=========================================');
  console.log('Recording Settings & Backoffice Suite Demo (Pure Settings)');
  console.log('=========================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Step 1: Pre-authenticate without recording
  const setupContext = await browser.newContext();
  const setupPage = await setupContext.newPage();
  await setupPage.goto('http://localhost:5199/login');
  await setupPage.getByLabel('Email').fill('admin@pos.test');
  await setupPage.getByLabel('Password').fill('admin12345');
  await setupPage.getByRole('button', { name: /masuk/i }).click();
  await setupPage.waitForURL(/\/(cashier|kitchen|admin)/, { timeout: 15000 });
  await setupContext.storageState({ path: AUTH_FILE });
  await setupContext.close();
  console.log('✓ Pre-authentication successful');

  // Step 2: Start recording directly at /admin/toko with authenticated state
  const recContext = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: TMP_DIR,
      size: { width: 1280, height: 800 },
    },
  });

  const page = await recContext.newPage();
  await page.goto('http://localhost:5199/admin/toko');
  await page.waitForSelector('text=Pengaturan toko', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Take screenshot with Struk tab open (shows thermal receipt preview!)
  const strukBtn = page.getByRole('button', { name: /Struk/i });
  if (await strukBtn.isVisible()) {
    await strukBtn.click();
    await page.waitForTimeout(800);
  }

  const webpPath = path.join(OUT_DIR, 'pengaturan.webp');
  await page.screenshot({ path: webpPath, type: 'webp', quality: 90 });
  console.log(`✓ WebP saved: pengaturan.webp (${Math.round(fs.statSync(webpPath).size / 1024)} KB)`);

  // Now record smooth settings walk-through
  // 1. Show Struk settings (thermal 58mm/80mm + receipt preview)
  await page.waitForTimeout(2500);

  // 2. Click Pajak & Poin
  const pajakBtn = page.getByRole('button', { name: /Pajak & poin/i });
  if (await pajakBtn.isVisible()) {
    await pajakBtn.click();
    await page.waitForTimeout(3000);
  }

  // 3. Click Profil
  const profilBtn = page.getByRole('button', { name: /Profil/i });
  if (await profilBtn.isVisible()) {
    await profilBtn.click();
    await page.waitForTimeout(2500);
  }

  // 4. Go to Meja & QR
  await page.goto('http://localhost:5199/admin/meja');
  await page.waitForTimeout(3000);

  // 5. Go to Tim & Hak Akses PIN
  await page.goto('http://localhost:5199/admin/tim');
  await page.waitForTimeout(3000);

  // 6. Go to Promo & Diskon
  await page.goto('http://localhost:5199/admin/promo');
  await page.waitForTimeout(2500);

  await page.close();
  await recContext.close();
  await browser.close();

  // Find generated video
  const files = fs.readdirSync(TMP_DIR).filter((f) => f.endsWith('.webm'));
  if (files.length > 0) {
    const rawVideo = path.join(TMP_DIR, files[0]);
    const finalVideo = path.join(OUT_DIR, 'video-pengaturan.webm');

    console.log('Optimizing video-pengaturan.webm with ffmpeg...');
    execSync(
      `ffmpeg -y -i "${rawVideo}" -c:v libvpx-vp9 -b:v 1200k -crf 28 -an -pix_fmt yuv420p "${finalVideo}"`,
      { stdio: 'inherit' }
    );
    console.log(`✓ Final video saved: video-pengaturan.webm (${Math.round(fs.statSync(finalVideo).size / 1024)} KB)`);
  }

  // Cleanup
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('🎉 Pure settings video recorded perfectly!');
}

run().catch((err) => {
  console.error('Recording failed:', err);
  process.exit(1);
});
