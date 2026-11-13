import { msg } from '@shared/i18n'
import { supabase } from './supabase'

type Result = { data: unknown; error: Error | null }

/**
 * Panggil fungsi SQL lewat /api/rpc (Vercel; saat `vite dev` dilayani plugin di vite.config.ts).
 * `asPublic`: kirim tanpa sesi login. Dipakai halaman pembeli supaya pesanan tetap tercatat "dari pelanggan"
 * walau browsernya sedang login sebagai staf (mis. pemilik mencoba pesan lewat QR).
 */
export async function rpc(name: string, args?: Record<string, unknown>, opts?: { asPublic?: boolean }): Promise<Result> {
  const token = opts?.asPublic ? undefined : (await supabase.auth.getSession()).data.session?.access_token
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ name, args }),
    })
    const body = await res.json()
    return body.success ? { data: body.data, error: null } : { data: null, error: new Error(msg(body.error ?? 'Permintaan gagal')) }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

/** Katalog publik berdasarkan slug lewat /api/catalog (cache CDN). */
export async function fetchCatalogBySlug(slug: string) {
  const res = await fetch(`/api/catalog?slug=${encodeURIComponent(slug)}`)
  const body = await res.json()
  if (!body.success) throw new Error(body.error ?? 'Gagal memuat katalog')
  return body as { store: unknown; categories: unknown[]; products: unknown[]; promotions: unknown[] }
}

/** Daftar toko aktif untuk halaman depan. */
export async function fetchStores() {
  const res = await fetch('/api/stores')
  const body = await res.json()
  if (!body.success) throw new Error(body.error ?? 'Gagal memuat toko')
  return body.stores as { slug: string; name: string }[]
}
