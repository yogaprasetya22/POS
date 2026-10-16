import { expect, test } from '@playwright/test'
import { ACCOUNTS, STORE1, login } from './helpers'

test('pelanggan pesan via WA → kasir terima bayar → dapur siapkan (realtime)', async ({ browser, page }) => {
  // 1. Pelanggan (tanpa login): pesan Es Teh Lemon di meja 9. wa.me dicegat agar tidak keluar ke internet.
  await page.route(/https:\/\/wa\.me\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'wa' }))
  await page.goto(`/s/${STORE1}?meja=9`)
  await page.getByRole('button', { name: /Es Teh Lemon/ }).click()
  await page.getByRole('button', { name: /Tambah ke keranjang/ }).click()
  await page.getByRole('button', { name: 'Checkout' }).click()
  await page.getByLabel('Nama panggilan').fill('E2E Pelanggan')
  await page.getByRole('button', { name: /Pesan via WhatsApp/ }).click()

  await page.waitForURL(/wa\.me/)
  const text = new URL(page.url()).searchParams.get('text')!
  const code = /PESANAN (A-\d+)/.exec(text)?.[1]
  expect(code, 'kode antrean ada di teks WA').toBeTruthy()
  expect(text).toContain('Meja 9')
  expect(text).toContain('Es Teh Lemon')
  expect(text).toContain('Rp10.000')

  // 2. Staf toko login; layar dapur dibuka lebih dulu untuk memeriksa realtime
  const ctx = await browser.newContext()
  const cashier = await ctx.newPage()
  await login(cashier, ACCOUNTS.cashier1)
  const kitchen = await ctx.newPage()
  await kitchen.goto('/kitchen')
  await expect(kitchen.getByLabel('breadcrumb').getByText('Dapur')).toBeVisible()
  await expect(kitchen.getByText(code!)).toHaveCount(0) // belum dibayar → belum masuk dapur

  // 3. Kasir cari kode, terima bayar tunai uang pas
  await cashier.getByLabel('Cari pesanan').fill(code!)
  await expect(cashier.getByRole('button', { name: new RegExp(`#${code}\\b`) })).toBeVisible() // antrean sudah termuat
  await cashier.getByLabel('Cari pesanan').press('Enter')
  await expect(cashier.getByText(`#${code} · E2E Pelanggan · Meja 9`)).toBeVisible()
  await cashier.getByRole('button', { name: 'Uang pas' }).click()
  await cashier.getByRole('button', { name: 'Terima Pembayaran' }).click()
  const receipt = cashier.getByRole('dialog')
  await expect(receipt.getByText('Pembayaran Berhasil')).toBeVisible()
  await expect(receipt.getByText(code!, { exact: true })).toBeVisible()
  await receipt.getByRole('button', { name: 'Selesai' }).click()

  // 4. Dapur menerima pesanan tanpa refresh, lalu IN_KITCHEN → READY → COMPLETED
  const card = kitchen.locator('[data-slot=card]').filter({ hasText: code! })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card).toContainText('Es Teh Lemon')
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(card.getByRole('button', { name: 'Sudah diambil' })).toBeVisible()
  await card.getByRole('button', { name: 'Sudah diambil' }).click()
  await expect(card).toHaveCount(0)

  await ctx.close()
})
