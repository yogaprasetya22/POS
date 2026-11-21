#!/usr/bin/env bun
/**
 * Automated Scenario Evaluation Runner for POS MCP Intelligence.
 * Validates scenarios from docs/MCP/02_500_POS_QA_SCENARIOS.md against the actual live database.
 * Run:
 *   bun run scripts/eval-pos-mcp.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { toolHandlers } from '../server/mcp-tools.js'

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

// Representative sample across all 7 categories from 02_150_POS_QA_SCENARIOS.md
const testScenarios = [
  // SA: Sales & Turnover
  { id: 'SA-001', category: 'SA', name: 'Today Sales', tool: 'pos_get_today_sales', args: {} },
  { id: 'SA-002', category: 'SA', name: '7-Day Sales Report', tool: 'pos_get_sales_report', args: { from: '2026-11-10', to: '2026-11-16' } },
  { id: 'SA-003', category: 'SA', name: 'MTD Sales Report', tool: 'pos_get_sales_report', args: { from: '2026-11-01', to: '2026-11-16' } },
  { id: 'SA-005', category: 'SA', name: 'Period Comparison', tool: 'pos_compare_periods', args: { period_a_from: '2026-11-10', period_a_to: '2026-11-16', period_b_from: '2026-11-03', period_b_to: '2026-11-09' } },
  { id: 'SA-006', category: 'SA', name: 'Payment Breakdown', tool: 'pos_get_payment_breakdown', args: { from: '2026-11-01', to: '2026-11-16' } },
  { id: 'SA-008', category: 'SA', name: 'Top 5 Selling Items', tool: 'pos_get_top_selling_items', args: { from: '2026-11-01', to: '2026-11-16', limit: 5 } },
  { id: 'SA-010', category: 'SA', name: 'Hourly Trend Yesterday', tool: 'pos_get_hourly_sales_trend', args: { date: '2026-11-15' } },

  // PR: Profit & HPP
  { id: 'PR-001', category: 'PR', name: 'Gross Profit Report', tool: 'pos_get_profit_report', args: { from: '2026-11-01', to: '2026-11-16' } },
  { id: 'PR-003', category: 'PR', name: 'Item Profitability Ranking', tool: 'pos_get_item_profitability', args: { from: '2026-11-01', to: '2026-11-16', limit: 5 } },
  { id: 'PR-004', category: 'PR', name: 'Low Margin Items (<40%)', tool: 'pos_get_item_profitability', args: { from: '2026-11-01', to: '2026-11-16', max_margin_pct: 40 } },
  { id: 'PR-005', category: 'PR', name: 'Recipe Costing Cafe Latte', tool: 'pos_get_recipe_costing', args: { item_name: 'Cafe Latte' } },
  { id: 'PR-007', category: 'PR', name: '30-Day COGS & Food Cost', tool: 'pos_get_profit_report', args: { from: '2026-10-18', to: '2026-11-16' } },

  // SH: Shifts & Cash Movements
  { id: 'SH-001', category: 'SH', name: 'Active Shift Status', tool: 'pos_get_active_shift', args: {} },
  { id: 'SH-003', category: 'SH', name: 'Latest Closed Shift Detail', tool: 'pos_get_shift_detail', args: { shift_id: 'latest' } },
  { id: 'SH-005', category: 'SH', name: 'Cash Out Movements', tool: 'pos_get_cash_movements', args: { type: 'out', limit: 10 } },
  { id: 'SH-006', category: 'SH', name: 'Shift Discrepancy Rekap', tool: 'pos_get_shift_summary', args: {} },
  { id: 'SH-007', category: 'SH', name: 'Shift Cash Shortage Audit', tool: 'pos_get_shift_discrepancies', args: { from: '2026-10-01', to: '2026-11-21' } },

  // IN: Inventory & Waste
  { id: 'IN-001', category: 'IN', name: 'Low Stock Ingredients', tool: 'pos_get_low_stock_ingredients', args: {} },
  { id: 'IN-004', category: 'IN', name: 'Stock Movement Logs', tool: 'pos_get_stock_movements', args: { limit: 20 } },
  { id: 'IN-005', category: 'IN', name: 'Monthly Waste Report', tool: 'pos_get_waste_report', args: { from: '2026-11-01', to: '2026-11-16' } },

  // CR: Members & CRM
  { id: 'CR-001', category: 'CR', name: 'Membership Summary & Liability', tool: 'pos_get_membership_summary', args: {} },
  { id: 'CR-002', category: 'CR', name: 'Top 10 Spender Members', tool: 'pos_get_top_members', args: { limit: 10 } },
  { id: 'CR-006', category: 'CR', name: 'Voucher Performance & Redemption', tool: 'pos_get_voucher_performance', args: {} },

  // AU: Audit & Voids
  { id: 'AU-001', category: 'AU', name: 'Recent Audit Trail', tool: 'pos_get_audit_logs', args: { limit: 20 } },
  { id: 'AU-002', category: 'AU', name: 'Monthly Void Audit Report', tool: 'pos_get_void_audit_report', args: { from: '2026-11-01', to: '2026-11-16' } },
  { id: 'AU-005', category: 'AU', name: 'Unauthorized Voids Detection', tool: 'pos_get_unauthorized_voids', args: { from: '2026-11-01', to: '2026-11-16' } },
  { id: 'AU-007', category: 'AU', name: 'Preview Void Order (Guardrail)', tool: 'pos_preview_void_order', args: { order_id: 'sample-order' }, expectError: true },

  // ED: Edge Cases & Validation
  { id: 'ED-001', category: 'ED', name: 'Empty Historic Period', tool: 'pos_get_sales_report', args: { from: '2024-01-01', to: '2024-01-01' } },
  { id: 'ED-004', category: 'ED', name: 'Zero Profit Calculation', tool: 'pos_get_profit_report', args: { from: '2024-01-01', to: '2024-01-01' } },
  { id: 'ED-008', category: 'ED', name: 'Non-Existent Recipe Lookup', tool: 'pos_get_recipe_costing', args: { item_name: 'Alien Antariksa' }, expectError: true },
]

console.log('================================================================');
console.log('🚀 EVALUATION SUITE: POS MCP Intelligence Scenarios');
console.log(`📋 Skenario Target: docs/MCP/02_500_POS_QA_SCENARIOS.md`);
console.log('================================================================\n');

let passed = 0
let failed = 0
const categoryStats = {}

for (const sc of testScenarios) {
  if (!categoryStats[sc.category]) categoryStats[sc.category] = { passed: 0, failed: 0 }

  const startTime = Date.now()
  try {
    const fn = toolHandlers[sc.tool]
    if (!fn) throw new Error(`Tool ${sc.tool} tidak ditemukan!`)

    const result = await fn(sc.args)
    const duration = Date.now() - startTime

    // Verifikasi format envelope baku
    if (!result.timestamp || !result.metadata) {
      throw new Error('Envelope tidak memenuhi standar metadata')
    }

    // Periksa apakah ada nilai NaN atau Infinity di dalam string output
    const str = JSON.stringify(result)
    if (str.includes('NaN') || str.includes('Infinity')) {
      throw new Error('Terdeteksi nilai NaN atau Infinity (pembagian dengan nol tidak terlindungi)')
    }

    // Jika scenario seharusnya error tapi sukses
    if (sc.expectError) {
      console.log(`  ✗ [${sc.id}] ${sc.name} (${sc.category}) - ${duration}ms: Harusnya error tapi sukses`)
      failed++
      categoryStats[sc.category].failed++
      continue
    }

    console.log(`  ✓ [${sc.id}] ${sc.name} (${sc.category}) - ${duration}ms [PASS]`)
    passed++
    categoryStats[sc.category].passed++
  } catch (err) {
    const duration = Date.now() - startTime
    if (sc.expectError) {
      console.log(`  ✓ [${sc.id}] ${sc.name} (${sc.category}) - ${duration}ms [GUARDRAIL TRIGGERED - PASS]`)
      passed++
      categoryStats[sc.category].passed++
    } else {
      console.error(`  ✗ [${sc.id}] ${sc.name} (${sc.category}) - ${duration}ms [FAIL]: ${err.message}`)
      failed++
      categoryStats[sc.category].failed++
    }
  }
}

console.log('\n================================================================');
console.log('📊 REKAPITULASI EVALUASI PER KATEGORI:');
console.log('----------------------------------------------------------------');
for (const [cat, stats] of Object.entries(categoryStats)) {
  const total = stats.passed + stats.failed
  const rate = Math.round((stats.passed / total) * 100)
  console.log(`  * Kategori ${cat.padEnd(4)}: ${stats.passed}/${total} Lolos (${rate}%)`)
}
console.log('----------------------------------------------------------------');
console.log(`TOTAL: ${passed} Lolos, ${failed} Gagal dari ${testScenarios.length} skenario uji.`);
console.log('================================================================');

if (failed > 0) process.exit(1)

