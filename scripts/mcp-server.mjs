#!/usr/bin/env bun
/**
 * MCP Stdio Server for Warung Kopi Nusantara / POS System.
 * Run locally for Claude Desktop, Cursor, or Antigravity IDE:
 *   bun run scripts/mcp-server.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { toolHandlers } from '../server/mcp-tools.js'

// Load .env automatically if running locally
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
    const val = trimmed.slice(trimmed.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

const server = new McpServer({
  name: 'mcp-pos-intelligence',
  version: '1.0.0',
})

// Helper to wrap handler into MCP content response
const makeHandler = (fnName) => async (args) => {
  try {
    const fn = toolHandlers[fnName]
    const envelope = await fn(args)
    return {
      content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
    }
  } catch (err) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: err.message, timestamp: new Date().toISOString() }, null, 2),
      }],
    }
  }
}

// 1. pos_get_today_sales
server.tool(
  'pos_get_today_sales',
  'Ambil ringkasan omzet dan transaksi penjualan hari ini (Gross Sales, Net Sales, AOV, Diskon, Pajak).',
  { store_slug: z.string().optional().describe('Slug toko (opsional, default: warkop-nusantara)') },
  makeHandler('pos_get_today_sales'),
)

// 2. pos_get_sales_report
server.tool(
  'pos_get_sales_report',
  'Laporan penjualan agregat untuk rentang tanggal tertentu (harian, metode bayar, top produk, kasir).',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
    limit: z.number().optional().describe('Batas jumlah item produk'),
  },
  makeHandler('pos_get_sales_report'),
)

// 3. pos_compare_periods
server.tool(
  'pos_compare_periods',
  'Bandingkan performa penjualan antara dua periode (omzet, pesanan, AOV, selisih delta %).',
  {
    period_a_from: z.string().describe('Periode A mulai YYYY-MM-DD'),
    period_a_to: z.string().describe('Periode A selesai YYYY-MM-DD'),
    period_b_from: z.string().describe('Periode B mulai YYYY-MM-DD'),
    period_b_to: z.string().describe('Periode B selesai YYYY-MM-DD'),
  },
  makeHandler('pos_compare_periods'),
)

// 4. pos_get_profit_report
server.tool(
  'pos_get_profit_report',
  'Laporan laba kotor, total HPP/COGS, Food Cost %, dan nilai kerugian bahan baku (waste).',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
  },
  makeHandler('pos_get_profit_report'),
)

// 5. pos_get_item_profitability
server.tool(
  'pos_get_item_profitability',
  'Peringkat profitabilitas per menu: harga jual, HPP resep, margin nominal (Rp), dan margin persentase (%).',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
    max_margin_pct: z.number().optional().describe('Filter maksimal margin % (misal: menu di bawah 40%)'),
    limit: z.number().optional().describe('Batas jumlah menu'),
  },
  makeHandler('pos_get_item_profitability'),
)

// 6. pos_get_recipe_costing
server.tool(
  'pos_get_recipe_costing',
  'Rincian komposisi bahan baku dan kalkulasi HPP resep untuk menu tertentu.',
  {
    item_name: z.string().describe('Nama menu minuman atau makanan'),
  },
  makeHandler('pos_get_recipe_costing'),
)

// 7. pos_get_active_shift
server.tool(
  'pos_get_active_shift',
  'Informasi shift kasir yang sedang berjalan (kasir, jam buka, modal awal, penjualan tunai saat ini).',
  {
    store_slug: z.string().optional().describe('Slug toko'),
  },
  makeHandler('pos_get_active_shift'),
)

// 8. pos_get_shift_detail
server.tool(
  'pos_get_shift_detail',
  'Rincian shift kasir yang sudah ditutup: modal, penjualan kas & non-kas, kas akhir, dan selisih (short/over).',
  {
    shift_id: z.string().optional().describe('ID shift atau "latest"'),
    store_slug: z.string().optional().describe('Slug toko'),
  },
  makeHandler('pos_get_shift_detail'),
)

// 9. pos_get_shift_summary
server.tool(
  'pos_get_shift_summary',
  'Ringkasan seluruh shift kasir dalam periode tertentu beserta rekap selisih kas.',
  {
    store_slug: z.string().optional().describe('Slug toko'),
  },
  makeHandler('pos_get_shift_summary'),
)

// 10. pos_get_cash_movements
server.tool(
  'pos_get_cash_movements',
  'Riwayat mutasi kas masuk/keluar di laci kasir (pembelian gas, es batu, modal tambahan).',
  {
    type: z.string().optional().describe('"in", "out", atau "all"'),
    limit: z.number().optional().describe('Batas jumlah catatan'),
  },
  makeHandler('pos_get_cash_movements'),
)

// 11. pos_get_low_stock_ingredients
server.tool(
  'pos_get_low_stock_ingredients',
  'Daftar bahan baku yang stoknya di bawah batas aman (safety stock) atau mendekati habis.',
  {
    threshold_ratio: z.number().optional().describe('Rasio batas ambang (default 1.0)'),
  },
  makeHandler('pos_get_low_stock_ingredients'),
)

// 12. pos_get_stock_movements
server.tool(
  'pos_get_stock_movements',
  'Riwayat pergerakan stok bahan baku (penerimaan barang, pemakaian resep, penyesuaian opname).',
  {
    type: z.string().optional().describe('Alasan: IN, OUT, ADJUST, WASTE'),
    limit: z.number().optional().describe('Batas jumlah baris'),
  },
  makeHandler('pos_get_stock_movements'),
)

// 13. pos_get_waste_report
server.tool(
  'pos_get_waste_report',
  'Laporan bahan baku yang terbuang/rusak (waste) beserta nilai kerugian dalam Rupiah.',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
  },
  makeHandler('pos_get_waste_report'),
)

// 14. pos_get_membership_summary
server.tool(
  'pos_get_membership_summary',
  'Ringkasan data loyalitas member: total member terdaftar, member aktif, dan poin beredar.',
  {
    store_slug: z.string().optional().describe('Slug toko'),
  },
  makeHandler('pos_get_membership_summary'),
)

// 15. pos_get_top_members
server.tool(
  'pos_get_top_members',
  'Daftar member paling loyal berdasarkan akumulasi nilai belanja (total spend) dan frekuensi kunjungan.',
  {
    limit: z.number().optional().describe('Jumlah member teratas'),
  },
  makeHandler('pos_get_top_members'),
)

// 16. pos_get_voucher_performance
server.tool(
  'pos_get_voucher_performance',
  'Performa penggunaan voucher dan kupon promosi: tingkat klaim dan omzet yang dihasilkan.',
  {},
  makeHandler('pos_get_voucher_performance'),
)

// 17. pos_get_payment_breakdown
server.tool(
  'pos_get_payment_breakdown',
  'Proporsi penerimaan omzet berdasarkan metode pembayaran (Tunai, QRIS, Kartu Debit, Transfer).',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
  },
  makeHandler('pos_get_payment_breakdown'),
)

// 18. pos_get_top_selling_items
server.tool(
  'pos_get_top_selling_items',
  'Peringkat menu terlaris berdasarkan kuantitas porsi terjual dan kontribusi nominal omzet.',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
    limit: z.number().optional().describe('Batas ranking'),
  },
  makeHandler('pos_get_top_selling_items'),
)

// 19. pos_get_hourly_sales_trend
server.tool(
  'pos_get_hourly_sales_trend',
  'Tren volume dan omzet penjualan per jam sepanjang hari untuk mendeteksi jam-jam sibuk (peak hours).',
  {
    date: z.string().describe('Tanggal YYYY-MM-DD'),
  },
  makeHandler('pos_get_hourly_sales_trend'),
)

// 20. pos_get_audit_logs
server.tool(
  'pos_get_audit_logs',
  'Jejak audit sistem POS: riwayat pembatalan pesanan (void), diskon manual, perubahan harga, dan resep.',
  {
    action: z.string().optional().describe('Filter aksi audit'),
    limit: z.number().optional().describe('Batas log'),
  },
  makeHandler('pos_get_audit_logs'),
)

// 21. pos_get_void_audit_report
server.tool(
  'pos_get_void_audit_report',
  'Laporan audit khusus pesanan yang dibatalkan (void) setelah dicetak atau diproses di kasir.',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
  },
  makeHandler('pos_get_void_audit_report'),
)

// 22. pos_get_store_info
server.tool(
  'pos_get_store_info',
  'Informasi outlet toko: nama toko, alamat, mata uang, zona waktu, dan pengaturan pajak restoran.',
  {
    store_slug: z.string().optional().describe('Slug toko'),
  },
  makeHandler('pos_get_store_info'),
)

// 23. pos_preview_void_order
server.tool(
  'pos_preview_void_order',
  'Simulasikan dampak pembatalan pesanan (nominal uang dikembalikan) sebelum diotorisasi supervisor.',
  {
    order_id: z.string().describe('ID pesanan'),
  },
  makeHandler('pos_preview_void_order'),
)

// 24. pos_get_unauthorized_voids
server.tool(
  'pos_get_unauthorized_voids',
  'Deteksi pesanan yang dibatalkan tanpa jejak supervisor PIN atau melanggar SOP kasir.',
  {
    from: z.string().describe('Tanggal mulai YYYY-MM-DD'),
    to: z.string().describe('Tanggal selesai YYYY-MM-DD'),
  },
  makeHandler('pos_get_unauthorized_voids'),
)

// Connect to Stdio Transport
const transport = new StdioServerTransport()
await server.connect(transport)

