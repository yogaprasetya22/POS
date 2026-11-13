import { expect, test } from '@playwright/test'
import { ACCOUNTS, STORE1, client, ensureShift, freeDrawer, login } from './helpers'

test('pelanggan pesan via QR → kasir terima bayar → dapur siapkan (realtime)', async ({ browser, page }) => {
  // Bersihkan sisa pesanan E2E yang belum dibayar (penjaga anti-spam membatasi 3 pesanan menunggu per meja)
  await freeDrawer()
  const sweeper = await client(ACCOUNTS.cashier1)
  const stale = (await sweeper.from('orders').select('id').eq('status', 'UNPAID').eq('customer_name', 'E2E Pelanggan')).data ?? []
  await Promise.all(stale.map((o) => sweeper.rpc('advance_order', { p_order_id: o.id, p_to: 'CANCELLED' })))

  // 1. Pelanggan (tanpa login): pesan Es Teh Lemon di meja T1.
  await page.goto(`/s/${STORE1}?meja=T1`) // toko 1 punya meja terdaftar T1..T8
  await page.getByRole('button', { name: /Es Teh Lemon/ }).click()
  await page.getByRole('button', { name: /Tambah ke keranjang/ }).click()
  await page.getByRole('button', { name: 'Lihat pesanan' }).click()
  await page.getByLabel('Nama', { exact: true }).fill('E2E Pelanggan')
  await page.getByRole('button', { name: /Kirim pesanan/ }).click()

  const code = (await page.getByTestId('queue-code').textContent())?.trim()
  expect(code, 'kode antrean tampil di layar konfirmasi').toMatch(/^A-\d+$/)
  await expect(page.getByText('Rp10.000')).toBeVisible()

  // 2. Staf toko login; layar dapur dibuka lebih dulu untuk memeriksa realtime
  const ctx = await browser.newContext()
  const cashier = await ctx.newPage()
  await login(cashier, ACCOUNTS.cashier1)
  await ensureShift(cashier) // kasir wajib buka shift sebelum menerima pembayaran
  const kitchen = await ctx.newPage()
  await kitchen.goto('/kitchen')
  await expect(kitchen.getByRole('heading', { name: /Dapur/ })).toBeVisible()
  // Kode antrean dipakai ulang tiap hari (A-005 bisa sama dengan pesanan hari lain yang masih di dapur), jadi cocokkan juga nama pelanggan
  const mine = kitchen.locator('article').filter({ hasText: code! }).filter({ hasText: 'E2E Pelanggan' })
  await expect(mine).toHaveCount(0) // belum dibayar → belum masuk dapur

  // 3. Kasir cari kode, terima bayar tunai uang pas
  await cashier.getByLabel('Cari pesanan').fill(code!)
  await expect(cashier.getByRole('button', { name: new RegExp(`\\b${code}\\b`) })).toBeVisible() // antrean sudah termuat
  await cashier.getByLabel('Cari pesanan').press('Enter')
  await expect(cashier.getByText(`#${code} · E2E Pelanggan · Meja T1`)).toBeVisible()
  await cashier.getByRole('button', { name: 'Uang pas' }).click()
  await cashier.getByRole('button', { name: 'Terima Pembayaran' }).click()
  const receipt = cashier.getByRole('dialog')
  await expect(receipt.getByText('Pembayaran Berhasil')).toBeVisible()
  await expect(receipt.getByText(code!, { exact: true })).toBeVisible()
  await receipt.getByRole('button', { name: 'Selesai' }).click()

  // 4. Dapur menerima pesanan tanpa refresh, lalu IN_KITCHEN → READY → COMPLETED
  const card = mine
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card).toContainText('Es Teh Lemon')
  await card.getByRole('button', { name: 'Siap diambil' }).click()
  await expect(card.getByRole('button', { name: 'Sudah diambil' })).toBeVisible()
  await card.getByRole('button', { name: 'Sudah diambil' }).click()
  await expect(card).toHaveCount(0)

  await ctx.close()
})
