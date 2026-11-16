import { allow, supabaseFor } from '../server/supabase.js'

// Produk diambil per 1.000 baris (batas bawaan PostgREST) supaya katalog besar tidak terpotong.
async function allProducts(db, storeId) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('products').select('*').eq('store_id', storeId).order('sort').order('id').range(from, from + 999)
    if (error) return { data: null, error }
    out.push(...data)
    if (data.length < 1000) return { data: out, error: null }
  }
}

// GET /api/catalog?slug=toko-saya  -> toko, kategori, produk, promo aktif (publik, dibatasi RLS)
export default async function handler(req, res) {
  if (!allow(req, res, 'GET')) return
  const slug = String(req.query?.slug || '').trim()
  if (!slug) return res.status(400).json({ success: false, error: 'slug wajib diisi' })

  const db = supabaseFor(req)
  const s = await db.from('stores').select('id, slug, name, wa_number, is_active, theme, buyer_template, logo_url, tagline').eq('slug', slug).maybeSingle()
  if (s.error) return res.status(500).json({ success: false, error: s.error.message })
  if (!s.data) return res.status(404).json({ success: false, error: 'Toko tidak ditemukan' })

  const id = s.data.id
  const [c, p, pr] = await Promise.all([
    db.from('categories').select('*').eq('store_id', id).order('sort'),
    allProducts(db, id),
    db.from('promotions').select('*').eq('store_id', id).eq('is_active', true),
  ])
  const err = c.error ?? p.error ?? pr.error
  if (err) return res.status(500).json({ success: false, error: err.message })

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
  res.status(200).json({ success: true, store: s.data, categories: c.data, products: p.data, promotions: pr.data })
}
