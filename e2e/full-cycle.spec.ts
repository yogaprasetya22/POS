import { expect, test, type Page } from '@playwright/test'
import { ACCOUNTS, STORE1, client, freeDrawer, login } from './helpers'

/**
 * Satu siklus bisnis penuh, dari buka shift sampai serah terima ke shift berikutnya:
 * pelanggan pesan (QR) → kasir buka shift → bayar tunai + QRIS → dapur → kas keluar → tutup shift dengan selisih
 * → audit di database → shift B membuka dengan modal = uang serah terima → laporan & halaman shift back office.
 * Mengubah database di .env: jalankan hanya ke database demo/dev.
 */
const MANAGER = ['manager@pos.test', 'manager12345'] as const
const PRICE = 10_000 // Es Teh Lemon (seed)
const WITHDRAW = 5_000
const SHORT = 500

const digits = (s: string) => Number(s.replace(/\D/g, ''))

async function closeShiftOf(account: readonly [string, string]) {
  const c = await client(account as never)
  const s = (await c.rpc('shift_summary')).data as { expected_cash: number } | null
  if (s) await c.rpc('close_shift', { p_counted_cash: s.expected_cash, p_note: 'dibersihkan e2e' })
}

async function customerOrders(page: Page, names: string[]) {
  const codes: string[] = []
  for (const name of names) {
    await page.goto(`/s/${STORE1}?meja=T1`)
    await page.getByRole('button', { name: /Es Teh Lemon/ }).click()
    await page.getByRole('button', { name: /Tambah ke keranjang/ }).click()
    await page.getByRole('button', { name: 'Lihat pesanan' }).click()
    await page.getByLabel('Nama', { exact: true }).fill(name)
    await page.getByRole('button', { name: /Kirim pesanan/ }).click()
    const code = (await page.getByTestId('queue-code').textContent())?.trim()
    expect(code, `kode antrean untuk ${name}`).toMatch(/^A-\d+$/)
    codes.push(code!)
  }
  return codes
}

async function payAtCashier(page: Page, code: string, name: string, method: 'cash' | 'qris') {
  await page.getByLabel('Cari pesanan').fill(code)
  await expect(page.getByRole('button', { name: new RegExp(`\\b${code}\\b`) }).first()).toBeVisible()
  await page.getByLabel('Cari pesanan').press('Enter')
  await expect(page.getByText(`#${code} · ${name} · Meja T1`)).toBeVisible()
  if (method === 'cash') await page.getByRole('button', { name: 'Rp100.000' }).click()
  else await page.getByRole('radio', { name: 'QRIS' }).or(page.getByRole('button', { name: 'QRIS', exact: true })).first().click()
  await page.getByRole('button', { name: 'Terima Pembayaran' }).click()
  const receipt = page.getByRole('dialog')
  await expect(receipt.getByText('Pembayaran Berhasil')).toBeVisible()
  if (method === 'cash') await expect(receipt.getByText('Kembalian')).toBeVisible()
  await receipt.getByRole('button', { name: 'Selesai' }).click()
}

test.describe.serial('siklus bisnis penuh: pesan → bayar → dapur → tutup shift → serah terima', () => {
  const state = { opening: 0, codes: [] as string[], counted: 0 }
  const names = ['E2E Tunai', 'E2E Qris']

  test('persiapan: laci kosong dan tidak ada pesanan sisa', async () => {
    await freeDrawer()
    await closeShiftOf(ACCOUNTS.cashier1)
    await closeShiftOf(MANAGER)
    const sweeper = await client(ACCOUNTS.cashier1)
    const stale = (await sweeper.from('orders').select('id').eq('status', 'UNPAID').in('customer_name', names)).data ?? []
    await Promise.all(stale.map((o) => sweeper.rpc('advance_order', { p_order_id: o.id, p_to: 'CANCELLED' })))
  })

  test('pelanggan memesan lewat QR (2 pesanan)', async ({ page }) => {
    state.codes = await customerOrders(page, names)
    expect(new Set(state.codes).size).toBe(2)
  })

  test('kasir membuka shift, menerima tunai dan QRIS, dapur menyelesaikan', async ({ browser }) => {
    const ctx = await browser.newContext()
    const cashier = await ctx.newPage()
    await login(cashier, ACCOUNTS.cashier1)

    // buka shift: modal awal sudah terisi dari uang serah terima shift sebelumnya
    const open = cashier.getByRole('button', { name: 'Buka shift' })
    await open.waitFor()
    state.opening = digits(await cashier.getByLabel('Modal awal (Rp)').inputValue())
    await open.click()
    await expect(cashier.getByText('Shift terbuka')).toBeVisible()

    await payAtCashier(cashier, state.codes[0], names[0], 'cash')
    await payAtCashier(cashier, state.codes[1], names[1], 'qris')

    const kitchen = await ctx.newPage()
    await kitchen.goto('/kitchen')
    for (let i = 0; i < 2; i++) {
      const card = kitchen.locator('article').filter({ hasText: state.codes[i] }).filter({ hasText: names[i] })
      await expect(card).toBeVisible({ timeout: 15_000 })
      await card.getByRole('button', { name: 'Siap diambil' }).click()
      await card.getByRole('button', { name: 'Sudah diambil' }).click()
      await expect(card).toHaveCount(0)
    }

    // kas keluar, lalu tutup shift dengan uang kurang Rp500 (wajib beri alasan)
    await cashier.getByRole('button', { name: /Kas & tutup shift/ }).click()
    await cashier.getByRole('button', { name: 'Kas keluar', exact: true }).click()
    await cashier.getByLabel('Jumlah', { exact: true }).fill(String(WITHDRAW))
    await cashier.getByLabel('Alasan', { exact: true }).fill('Beli es batu')
    await cashier.getByRole('button', { name: 'Simpan', exact: true }).click()

    const expected = state.opening + PRICE - WITHDRAW // QRIS tidak masuk laci
    state.counted = expected - SHORT
    await cashier.getByLabel('Uang yang dihitung di laci (Rp)').fill(String(state.counted))
    await cashier.getByLabel('Catatan', { exact: true }).fill('Uang kembalian kurang (e2e)')
    await cashier.getByRole('button', { name: 'Tutup shift', exact: true }).click()
    await expect(cashier.getByText('Shift ditutup')).toBeVisible()
    await ctx.close()
  })

  test('audit database: kas seharusnya, selisih, dan laporan', async () => {
    const manager = await client(MANAGER)
    const last = ((await manager.rpc('shift_status')).data as { last_closed: { counted_cash: number; difference: number } }).last_closed
    expect(last.counted_cash).toBe(state.counted)
    expect(last.difference).toBe(-SHORT)
    // kas seharusnya = hasil hitung − selisih = modal + penjualan tunai − kas keluar (QRIS tidak masuk laci)
    expect(last.counted_cash - last.difference).toBe(state.opening + PRICE - WITHDRAW)

    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    const rep = (await manager.rpc('sales_report', { p_from: day, p_to: day })).data as { totals: { net: number }; by_method: { method: string; net: number }[] }
    const net = (m: string) => rep.by_method.find((x) => x.method === m)?.net ?? 0
    expect(net('CASH')).toBeGreaterThanOrEqual(PRICE)
    expect(net('QRIS_STATIC')).toBeGreaterThanOrEqual(PRICE)
  })

  test('serah terima: shift B membuka dengan modal = uang hitung shift A', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, MANAGER as never)
    await page.goto('/cashier')
    const open = page.getByRole('button', { name: 'Buka shift' })
    await open.waitFor()
    expect(digits(await page.getByLabel('Modal awal (Rp)').inputValue())).toBe(state.counted)
    await open.click()
    await expect(page.getByText('Shift terbuka')).toBeVisible()
    await ctx.close()
    await closeShiftOf(MANAGER) // bersihkan: laci kembali kosong
  })

  test('back office: halaman shift dan laporan terbuka tanpa galat', async ({ page }) => {
    await login(page, ACCOUNTS.owner1)
    for (const path of ['/admin/shift', '/admin/laporan']) {
      await page.goto(path)
      await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
      await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 })
    }
  })
})
