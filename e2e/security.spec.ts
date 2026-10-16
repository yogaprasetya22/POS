import { expect, test } from '@playwright/test'
import { ACCOUNTS, PRODUCT1, PRODUCT2, STORE1, STORE2, anon, client, createOrder, storeId } from './helpers'

const cancelAsCashier = async (ids: string[]) => {
  const cashier = await client(ACCOUNTS.cashier1)
  await Promise.all(ids.map((id) => cashier.rpc('advance_order', { p_order_id: id, p_to: 'CANCELLED' })))
}

test.describe('isolasi data antar toko (RLS)', () => {
  test('anon tidak bisa membaca pesanan/profil dan tidak bisa memanggil fungsi staf', async () => {
    const sb = anon()
    expect((await sb.from('orders').select('id')).data).toEqual([])
    expect((await sb.from('profiles').select('user_id')).data).toEqual([])
    const pay = await sb.rpc('pay_order', { p_order_id: crypto.randomUUID(), p_method: 'CASH', p_cash_received: 1 })
    expect(pay.error).not.toBeNull()
    expect((await sb.rpc('list_stores_with_sales')).error).not.toBeNull()
  })

  test('owner toko 2 tidak bisa melihat atau mengubah data toko 1', async () => {
    const [s1, s2] = await Promise.all([storeId(STORE1), storeId(STORE2)])
    const owner2 = await client(ACCOUNTS.owner2)

    const orders = (await owner2.from('orders').select('store_id')).data!
    expect(orders.length).toBeGreaterThan(0)
    expect(orders.every((o) => o.store_id === s2)).toBe(true)
    const profiles = (await owner2.from('profiles').select('store_id')).data!
    expect(profiles.every((p) => p.store_id === s2)).toBe(true)

    // tulis lintas toko ditolak / tidak mengenai baris
    const { data: p1 } = await anon().from('products').select('id').eq('store_id', s1).limit(1).single()
    expect((await owner2.from('products').update({ price: 1 }).eq('id', p1!.id).select()).data ?? []).toHaveLength(0)
    expect((await owner2.from('products').insert({ store_id: s1, name: 'x', price: 1 })).error).not.toBeNull()
    expect((await owner2.from('categories').insert({ store_id: s1, name: 'x' })).error).not.toBeNull()
    expect((await owner2.from('stores').update({ name: 'diretas' }).eq('id', s1).select()).data ?? []).toHaveLength(0)

    // fungsi pembayaran/status pada pesanan toko 1
    const order = await createOrder(s1, PRODUCT1, 'E2E-RLS')
    expect(order.error).toBeNull()
    const id = order.data.id as string
    try {
      expect((await owner2.rpc('pay_order', { p_order_id: id, p_method: 'QRIS_STATIC', p_cash_received: null })).error).not.toBeNull()
      expect((await owner2.rpc('advance_order', { p_order_id: id, p_to: 'CANCELLED' })).error).not.toBeNull()
      expect((await owner2.rpc('update_order_lines', { p_order_id: id, p_lines: [{ product_id: PRODUCT2, qty: 1, choices: [], note: '' }] })).error).not.toBeNull()
    } finally {
      await cancelAsCashier([id])
    }
  })

  test('pelanggan tidak bisa memesan menu milik toko lain', async () => {
    const s2 = await storeId(STORE2)
    const { error } = await createOrder(s2, PRODUCT1) // produk toko 1 dikirim ke toko 2
    expect(error?.message).toContain('Menu tidak tersedia')
  })

  test('kasir dan owner tidak punya akses super admin; super admin tidak bisa membaca pesanan', async () => {
    const cashier = await client(ACCOUNTS.cashier1)
    expect((await cashier.rpc('list_stores_with_sales')).error).not.toBeNull()
    expect((await cashier.rpc('assign_owner', { p_store_id: await storeId(STORE1), p_email: ACCOUNTS.cashier1[0] })).error).not.toBeNull()
    const owner1 = await client(ACCOUNTS.owner1)
    expect((await owner1.rpc('save_store', { p_id: null, p_slug: 'toko-liar', p_name: 'x', p_wa: '6281234567890', p_active: true })).error).not.toBeNull()

    const sup = await client(ACCOUNTS.super)
    expect((await sup.from('orders').select('id')).data).toEqual([])
    const { data: stores } = await sup.rpc('list_stores_with_sales')
    expect(stores.map((s: { slug: string }) => s.slug)).toEqual(expect.arrayContaining([STORE1, STORE2]))
  })

  test('toko nonaktif: menu publik tersembunyi dan pesanan baru ditolak', async () => {
    const sup = await client(ACCOUNTS.super)
    const { data: stores } = await sup.rpc('list_stores_with_sales')
    const s = stores.find((x: { slug: string }) => x.slug === STORE2)
    const setActive = (active: boolean) => sup.rpc('save_store', { p_id: s.id, p_slug: s.slug, p_name: s.name, p_wa: s.wa_number, p_active: active })
    try {
      expect((await setActive(false)).error).toBeNull()
      expect((await createOrder(s.id, PRODUCT2)).error?.message).toContain('tutup')
      expect((await anon().from('products').select('id').eq('store_id', s.id)).data).toEqual([])
    } finally {
      await setActive(true)
    }
  })
})

test('batas 40 pesanan UNPAID per toko menolak pesanan berikutnya', async () => {
  test.setTimeout(180_000)
  const s1 = await storeId(STORE1)
  const made: string[] = []
  let failure = ''
  try {
    for (let i = 0; i < 45 && !failure; i++) {
      const { data, error } = await createOrder(s1, PRODUCT1, 'E2E-SPAM')
      if (error) failure = error.message
      else made.push(data.id)
    }
    expect(failure).toContain('penuh')
    expect(made.length).toBeLessThanOrEqual(40)
  } finally {
    await cancelAsCashier(made) // bersihkan antrean demo
  }
})
