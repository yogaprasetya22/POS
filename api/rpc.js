import { allow, supabaseFor } from '../server/supabase.js'

// Hanya fungsi SQL yang dipakai aplikasi; hak akses tetap diputuskan RLS/fungsi di database.
const ALLOWED = new Set([
  'create_order', 'quote_order', 'pay_order', 'advance_order', 'update_order_lines', 'apply_order_extras', 'expire_stale_orders',
  'split_order', 'merge_orders', 'reverse_order',
  'open_shift', 'close_shift', 'force_close_shift', 'shift_summary', 'shift_status', 'shift_detail', 'review_shift', 'shift_stats', 'cash_movement', 'save_message', 'save_store_locale',
  'upsert_member', 'adjust_points', 'create_voucher', 'delete_voucher', 'stock_adjust',
  'save_store_settings', 'set_supervisor_pin', 'register_store', 'set_store_plan', 'sales_report',
  'set_product_availability', 'list_stores_with_sales', 'save_store', 'assign_owner', 'add_staff', 'set_staff_role',
  'save_kitchen_settings', 'public_order_status', 'receive_purchase', 'record_waste', 'stock_count', 'import_inventory', 'save_store_branding', 'set_item_done', 'save_permission', 'save_shift_names', 'shift_stock', 'profit_report', 'save_supplier', 'save_purchase_order', 'receive_purchase_order', 'pay_purchase', 'cancel_purchase', 'save_buyer_template', 'save_store_identity',
  'set_staff_name', 'set_my_pin', 'has_my_pin', 'verify_my_pin',
  'save_store_midtrans_settings', 'get_store_midtrans_client_config', 'pay_order_midtrans',
  'get_order_for_midtrans', 'update_order_midtrans_session',
])

// Pembatas laju sederhana untuk pesanan publik (tanpa login). Disimpan di memori instance serverless,
// jadi bersifat best-effort; batas keras (antrean & per meja) ada di fungsi SQL create_order.
const hits = new Map()
const WINDOW_MS = 60_000
const MAX_PUBLIC_ORDERS = 6
function tooMany(ip) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  return list.length > MAX_PUBLIC_ORDERS
}

// POST /api/rpc  { name, args }  -> { success, data } | { success:false, error }
export default async function handler(req, res) {
  if (!allow(req, res, 'POST')) return
  const { name, args } = req.body || {}
  if (!ALLOWED.has(name)) return res.status(400).json({ success: false, error: 'Fungsi tidak dikenal' })

  if (name === 'create_order' && !req.headers?.authorization) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
    if (tooMany(ip)) return res.status(429).json({ success: false, error: 'Terlalu banyak pesanan, coba lagi sebentar' })
  }

  const { data, error } = await supabaseFor(req).rpc(name, args || {})
  if (error) return res.status(400).json({ success: false, error: error.message })
  res.status(200).json({ success: true, data })
}
