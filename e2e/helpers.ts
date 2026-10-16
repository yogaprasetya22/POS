import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

// Akun & data dari supabase/seed.sql. Tes ini MENGUBAH database di .env: jalankan hanya ke database demo/dev.
export const ACCOUNTS = {
  super: ['super@pos.test', 'super12345'],
  owner1: ['admin@pos.test', 'admin12345'],
  cashier1: ['kasir@pos.test', 'kasir12345'],
  owner2: ['owner2@pos.test', 'owner212345'],
} as const
export type Account = (typeof ACCOUNTS)[keyof typeof ACCOUNTS]

export const STORE1 = 'warkop-nusantara'
export const STORE2 = 'bakso-mas-joko'
// menu tanpa modifier wajib, tersedia
export const PRODUCT1 = '22222222-2222-4222-8222-000000000013' // Donat Glaze (toko 1)
export const PRODUCT2 = '33333333-3333-4333-8333-000000000004' // Kentang Goreng (toko 2)

const url = process.env.VITE_SUPABASE_URL!
const key = process.env.VITE_SUPABASE_ANON_KEY!

export const anon = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

export async function client([email, password]: Account) {
  const sb = anon()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email} gagal: ${error.message}`)
  return sb
}

export async function storeId(slug: string) {
  const { data, error } = await anon().from('stores').select('id').eq('slug', slug).single()
  if (error) throw error
  return data.id as string
}

/** Pesanan sebagai pelanggan anonim (jalur publik create_order). */
export const createOrder = (store: string, product: string, name = 'E2E') =>
  anon().rpc('create_order', {
    p_store_id: store,
    p_customer_name: name,
    p_order_type: 'TAKEAWAY',
    p_table_no: null,
    p_lines: [{ product_id: product, qty: 1, choices: [], note: '' }],
  })

export async function login(page: Page, [email, password]: Account) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await page.waitForURL(/\/(cashier|kitchen|admin|super)/)
}
