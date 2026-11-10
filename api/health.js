import { allow } from '../server/supabase.js'

export default function handler(req, res) {
  if (!allow(req, res, 'GET')) return
  const configured = Boolean(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
      (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
  )
  res.status(configured ? 200 : 500).json({ success: true, ok: configured })
}
