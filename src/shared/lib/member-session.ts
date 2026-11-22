import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rpc } from './api'

/**
 * Sesi member TERPISAH dari sesi staf (storageKey sendiri), supaya kasir yang membuka menu QR di
 * browsernya tidak ikut keluar, dan member di HP pelanggan tidak pernah dianggap staf.
 * Akun member = Supabase anonymous user; sesi disimpan & diperbarui otomatis (praktis selamanya).
 * Catatan: kunci sengaja tidak berpola `sb-*-auth-token` agar tidak dihapus saat staf ganti akun.
 */
export const memberClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storageKey: 'pos-member-session', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export const MemberCardSchema = z.object({
  member_id: z.string(),
  store_name: z.string(),
  store_slug: z.string(),
  name: z.string(),
  phone_tail: z.string(),
  points: z.number(),
  visits: z.number(),
  total_spent: z.number(),
  points_value: z.number(),
  since: z.string(),
  orders: z.array(z.object({ queue: z.string(), total: z.number(), paid_at: z.string().nullable(), points: z.number() })),
})
export type MemberCard = z.infer<typeof MemberCardSchema>

async function token(): Promise<string | undefined> {
  return (await memberClient.auth.getSession()).data.session?.access_token
}

/** Pastikan HP ini punya akun member (anonim). Dipakai saat menukar QR pertama kali. */
async function ensureAccount(): Promise<string> {
  const t = await token()
  if (t) return t
  const { data, error } = await memberClient.auth.signInAnonymously()
  if (error || !data.session) {
    throw new Error(
      error?.message?.toLowerCase().includes('anonymous')
        ? 'Login member belum diaktifkan pemilik toko (Supabase: Allow anonymous sign-ins).'
        : 'Gagal menyiapkan akun member. Periksa internet lalu scan ulang QR.',
    )
  }
  return data.session.access_token
}

export async function claimMemberLink(qrToken: string) {
  const t = await ensureAccount()
  const { error } = await rpc('claim_member_link', { p_token: qrToken }, { token: t })
  if (error) throw error
}

export async function hasMemberSession() {
  return Boolean(await token())
}

export async function loadMemberCards(): Promise<MemberCard[]> {
  const t = await token()
  if (!t) return []
  const { data, error } = await rpc('my_member_cards', {}, { token: t })
  if (error) throw error
  return z.array(MemberCardSchema).parse(data ?? [])
}

export async function leaveMember(memberId: string) {
  const t = await token()
  if (!t) return
  await rpc('leave_member', { p_member: memberId }, { token: t })
}

/** Alamat yang di-encode ke QR kasir. */
export const memberLinkUrl = (qrToken: string) => `${window.location.origin}/member?t=${encodeURIComponent(qrToken)}`
