import { allow, supabaseFor } from '../server/supabase.js'

// POST /api/orders  -> memanggil fungsi SQL create_order (harga dihitung ulang di database)
export default async function handler(req, res) {
  if (!allow(req, res, 'POST')) return
  const b = req.body || {}
  if (!b.store_id || !b.customer_name || !b.order_type || !Array.isArray(b.lines) || !b.lines.length) {
    return res.status(400).json({ success: false, error: 'store_id, customer_name, order_type, lines wajib diisi' })
  }

  const { data, error } = await supabaseFor(req).rpc('create_order', {
    p_store_id: b.store_id,
    p_customer_name: b.customer_name,
    p_order_type: b.order_type,
    p_table_no: b.table_no || null,
    p_lines: b.lines,
    p_promo_code: b.promo_code || null,
  })
  if (error) return res.status(400).json({ success: false, error: error.message })
  res.status(201).json({ success: true, order: data })
}
