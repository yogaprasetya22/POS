import { allow, supabaseFor } from '../server/supabase.js'

// GET /api/stores -> toko aktif (nama & slug) untuk halaman depan
export default async function handler(req, res) {
  if (!allow(req, res, 'GET')) return
  const { data, error } = await supabaseFor(req).from('stores').select('slug, name').eq('is_active', true).order('name').limit(12)
  if (error) return res.status(500).json({ success: false, error: error.message })
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  res.status(200).json({ success: true, stores: data })
}
