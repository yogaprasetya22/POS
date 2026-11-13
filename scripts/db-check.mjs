/**
 * Smoke test otorisasi & perhitungan di database (butuh seed + seed_pos pada project Supabase yang sama dengan .env).
 * Jalankan: make db-check   — memakai akun demo; JANGAN diarahkan ke database produksi.
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '  ✓' : '  ✗'} ${name}${cond ? '' : ` ${extra}`}`) }

const anonClient = () => createClient(URL_, KEY, { auth: { persistSession: false } })
async function as(email, password) {
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}
const err = async (p) => { const r = await p; return r.error?.message ?? null }

const owner = await as('admin@pos.test', 'admin12345')
const manager = await as('manager@pos.test', 'manager12345')
const cashier = await as('kasir@pos.test', 'kasir12345')
const kitchen = await as('dapur@pos.test', 'dapur12345')
const waiter = await as('pelayan@pos.test', 'pelayan12345')
const owner2 = await as('owner2@pos.test', 'owner212345')
const anon = anonClient()

const W = (await anon.from('stores').select('id').eq('slug', 'warkop-nusantara').single()).data.id
const B = (await anon.from('stores').select('id').eq('slug', 'bakso-mas-joko').single()).data.id
const hidden = (r) => !!r.error || (r.data?.length ?? 0) === 0
// pilih opsi pertama untuk grup wajib; harga satuan = harga dasar + harga opsi terpilih
const prod = async (store, name) => {
  const p = (await owner.from('products').select('id,price,modifiers').eq('store_id', store).eq('name', name).maybeSingle()).data
  const choices = (p.modifiers ?? []).filter((g) => g.required).map((g) => ({ group: g.name, option: g.options[0].name }))
  const extra = (p.modifiers ?? []).filter((g) => g.required).reduce((n, g) => n + g.options[0].price, 0)
  return { id: p.id, price: p.price + extra, choices }
}
const latte = await prod(W, 'Cafe Latte'), nasgor = await prod(W, 'Nasi Goreng Spesial')
const line = (p, qty = 1) => ({ product_id: p.id, qty, choices: p.choices ?? [], note: '' })

// Mulai dari keadaan bersih: tutup shift kasir yang tersisa (mis. dari tes e2e) dan buat voucher segar untuk tes ini
const leftover = (await cashier.rpc('shift_summary')).data
if (leftover) await cashier.rpc('close_shift', { p_counted_cash: leftover.expected_cash, p_note: 'dibersihkan db-check' })
// shift milik orang lain yang masih terbuka (mis. dari tes manual) ditutup paksa oleh manager agar laci bebas
const st0 = (await manager.rpc('shift_status')).data
if (st0?.open) {
  const d0 = (await manager.rpc('shift_detail', { p_shift: st0.open.id })).data
  await manager.rpc('force_close_shift', { p_shift: st0.open.id, p_counted_cash: d0.totals.expected, p_note: 'dibersihkan db-check' })
}
const lastClosed = (await manager.rpc('shift_status')).data?.last_closed
const handoverCash = lastClosed?.counted_cash ?? 100000
const stale = (await cashier.from('orders').select('id').eq('status', 'UNPAID').eq('table_no', 'T1')).data ?? []
await Promise.all(stale.map((o) => cashier.rpc('advance_order', { p_order_id: o.id, p_to: 'CANCELLED' })))
// sisa voucher dari jalan sebelumnya yang terhenti di tengah
const oldVouchers = (await manager.from('vouchers').select('id').eq('note', 'db-check').is('redeemed_at', null)).data ?? []
await Promise.all(oldVouchers.map((v) => manager.rpc('delete_voucher', { p_id: v.id })))
const VC = (await manager.rpc('create_voucher', { p_code: null, p_kind: 'AMOUNT', p_value: 5000, p_member: null, p_expires: null, p_note: 'db-check' })).data.code

console.log('\n[Anonim / pelanggan]')
ok((await err(anon.rpc('pay_order', { p_order_id: crypto.randomUUID(), p_method: 'CASH', p_cash_received: 1 }))) !== null, 'anon tidak bisa pay_order')
ok((await err(anon.rpc('open_shift', { p_opening_cash: 0 }))) !== null, 'anon tidak bisa open_shift')
ok((await err(anon.rpc('sales_report', { p_from: '2026-01-01', p_to: '2026-01-02' }))) !== null, 'anon tidak bisa sales_report')
ok(hidden(await anon.from('orders').select('id')), 'anon tidak melihat pesanan')
ok(hidden(await anon.from('members').select('id')), 'anon tidak melihat member')
ok(hidden(await anon.from('store_secrets').select('*')), 'anon tidak bisa membaca store_secrets')
const badTable = await err(anon.rpc('create_order', { p_store_id: W, p_customer_name: 'Tes', p_order_type: 'DINE_IN', p_table_no: 'Z99', p_lines: [line(latte)] }))
ok(badTable?.includes('tidak terdaftar'), 'meja tidak terdaftar ditolak untuk pelanggan', badTable)
const pub = await anon.rpc('create_order', { p_store_id: W, p_customer_name: 'Tes Publik', p_order_type: 'DINE_IN', p_table_no: 't1', p_lines: [line(latte)] })
ok(!pub.error && pub.data?.total > 0, 'pelanggan bisa pesan di meja terdaftar (case-insensitive)', pub.error?.message)
if (pub.data?.id) await cashier.rpc('advance_order', { p_order_id: pub.data.id, p_to: 'CANCELLED' }) // bersihkan agar tes bisa diulang (batas 3 pesanan/meja)
ok((await err(anon.rpc('quote_order', { p_store_id: W, p_lines: [line(latte)], p_member_id: crypto.randomUUID() }))) !== null, 'anon tidak bisa quote dengan member')

console.log('\n[Izin per role]')
const o1 = (await cashier.rpc('create_order', { p_store_id: W, p_customer_name: 'Walk-in', p_order_type: 'TAKEAWAY', p_table_no: null, p_lines: [line(latte, 2), line(nasgor)] })).data
ok(!!o1?.id, 'kasir bisa membuat pesanan')
ok((await err(kitchen.rpc('pay_order', { p_order_id: o1.id, p_method: 'CASH', p_cash_received: 999999 })))?.includes('forbidden'), 'dapur tidak bisa menerima pembayaran')
ok((await err(waiter.rpc('pay_order', { p_order_id: o1.id, p_method: 'CASH', p_cash_received: 999999 })))?.includes('forbidden'), 'pelayan tidak bisa menerima pembayaran')
ok((await err(cashier.rpc('pay_order', { p_order_id: o1.id, p_method: 'CASH', p_cash_received: 999999 })))?.includes('shift'), 'kasir wajib buka shift sebelum menerima pembayaran')
ok((await err(cashier.rpc('sales_report', { p_from: '2026-01-01', p_to: '2026-01-02' }))) !== null, 'kasir tidak bisa melihat laporan penjualan')
ok((await err(manager.rpc('sales_report', { p_from: '2026-01-01', p_to: '2026-12-31' }))) === null, 'manager bisa melihat laporan penjualan')
ok((await err(manager.rpc('add_staff', { p_email: 'x@x.com', p_role: 'cashier' })))?.includes('forbidden'), 'manager tidak bisa menambah staf (khusus owner)')
ok((await err(cashier.rpc('set_supervisor_pin', { p_pin: '9999' })))?.includes('forbidden'), 'kasir tidak bisa mengubah PIN')
ok((await err(cashier.from('products').update({ price: 1 }).eq('id', latte.id).then((r) => ({ error: r.error ?? (r.count === 0 ? null : null) })))) === null, 'update produk oleh kasir tidak melempar error (RLS menyaring)')
ok((await owner.from('products').select('price').eq('id', latte.id).single()).data.price === latte.price, 'harga produk tidak berubah oleh kasir')
ok((await err(kitchen.rpc('advance_order', { p_order_id: o1.id, p_to: 'CANCELLED' }))) !== null, 'dapur tidak bisa membatalkan pesanan')
ok((await err(owner2.rpc('apply_order_extras', { p_order_id: o1.id, p_promo_code: null, p_member_id: null, p_redeem_points: 0 }))) !== null, 'owner toko lain tidak bisa mengubah pesanan')
ok((await cashier.from('orders').select('id,total').eq('id', o1.id)).data?.length === 1, 'kasir melihat pesanan tokonya')
ok(hidden(await owner2.from('orders').select('id').eq('id', o1.id)), 'owner toko lain tidak melihat pesanan (RLS)')

console.log('\n[Shift, member, voucher, poin, pembayaran]')
const memberRes = await cashier.rpc('upsert_member', { p_phone: '081200000001', p_name: 'Budi Santoso' })
const member = memberRes.data
ok(member?.phone === '6281200000001', 'nomor HP dinormalisasi ke 62…', JSON.stringify(memberRes.error))
const shiftOpen = await cashier.rpc('open_shift', { p_opening_cash: handoverCash, p_note: 'db-check' })
ok(!shiftOpen.error || shiftOpen.error.message.includes('sudah terbuka'), 'kasir membuka shift', shiftOpen.error?.message)
const subtotal = latte.price * 2 + nasgor.price
const q0 = (await cashier.rpc('quote_order', { p_store_id: W, p_lines: [line(latte, 2), line(nasgor)], p_member_id: member.id, p_redeem_points: 0 })).data
ok(q0.total === subtotal - q0.promo_discount, 'quote tanpa tambahan sesuai subtotal', JSON.stringify(q0))
ok(q0.points_earned === Math.floor(q0.total / 10000), 'poin yang akan didapat = total / Rp10.000', `${q0.points_earned}`)
const qV = (await cashier.rpc('quote_order', { p_store_id: W, p_lines: [line(latte, 2), line(nasgor)], p_promo_code: VC })).data
ok(qV.voucher_discount === 5000 && qV.total === q0.total - 5000 + 0, 'voucher nominal Rp5.000 dipotong', JSON.stringify(qV))
const qP = (await cashier.rpc('quote_order', { p_store_id: W, p_lines: [line(latte, 2), line(nasgor)], p_member_id: member.id, p_redeem_points: 20 })).data
ok(qP.points_redeemed === 20 && qP.points_discount === 2000, 'tukar 20 poin = potongan Rp2.000', JSON.stringify(qP))
const qMax = (await cashier.rpc('quote_order', { p_store_id: W, p_lines: [line(latte)], p_member_id: member.id, p_redeem_points: 100000 })).data
ok(qMax.points_redeemed <= 120 && qMax.total >= 0, 'penukaran poin dibatasi saldo member & total', JSON.stringify(qMax))

await cashier.rpc('apply_order_extras', { p_order_id: o1.id, p_promo_code: VC, p_member_id: member.id, p_redeem_points: 20 })
const o1row = (await cashier.from('orders').select('*').eq('id', o1.id).single()).data
const expectTotal = subtotal - o1row.discount_amount - 5000 - 2000
ok(o1row.total === expectTotal, 'pesanan terhitung ulang (promo + voucher + poin)', `${o1row.total} vs ${expectTotal}`)
ok((await err(cashier.rpc('pay_order', { p_order_id: o1.id, p_method: 'CASH', p_cash_received: o1row.total - 1 })))?.includes('Pembayaran gagal'), 'uang kurang ditolak')
const before = (await cashier.from('members').select('points').eq('id', member.id).single()).data.points
const stockBefore = (await owner.from('ingredients').select('stock').eq('store_id', W).eq('name', 'Biji kopi').single()).data.stock
const paid = await cashier.rpc('pay_order', { p_order_id: o1.id, p_method: 'CASH', p_cash_received: o1row.total + 5000 })
ok(!paid.error && paid.data.status === 'IN_KITCHEN' && !!paid.data.shift_id && !!paid.data.paid_by, 'pembayaran tunai berhasil, tercatat shift & kasir', paid.error?.message)
const after = (await cashier.from('members').select('points').eq('id', member.id).single()).data.points
ok(after === before - 20 + o1row.points_earned, 'poin member: ditukar & didapat', `${before} -> ${after}`)
const stockAfter = (await owner.from('ingredients').select('stock').eq('store_id', W).eq('name', 'Biji kopi').single()).data.stock
ok(Number(stockBefore) - Number(stockAfter) === 36, 'stok bahan berkurang sesuai resep (2 latte × 18 g)', `${stockBefore} -> ${stockAfter}`)
// Stok bahan ↔ menu: sisa porsi dihitung otomatis & menu ditolak bila bahan kurang
const recs = (await owner.from('recipes').select('qty, ingredients(stock)').eq('product_id', latte.id)).data
const expPortions = Math.min(...recs.map((r) => Math.floor(Number(r.ingredients.stock) / Number(r.qty))))
const portionsOf = async () => (await owner.from('products').select('portions').eq('id', latte.id).single()).data.portions
ok((await portionsOf()) === expPortions, 'sisa porsi menu = min(stok / takaran resep)', `${await portionsOf()} vs ${expPortions}`)
const coffee = (await owner.from('ingredients').select('id, stock').eq('store_id', W).eq('name', 'Biji kopi').single()).data
const coffeeQty = Number(recs.length ? (await owner.from('recipes').select('qty').eq('product_id', latte.id).eq('ingredient_id', coffee.id).single()).data.qty : 0)
const cut = Number(coffee.stock) - coffeeQty * 1.5   // sisakan 1,5 porsi dari bahan ini
await owner.rpc('stock_adjust', { p_ingredient: coffee.id, p_delta: -cut, p_reason: 'ADJUST', p_note: 'db-check' })
ok((await portionsOf()) <= 1, 'stok bahan turun → sisa porsi ikut turun', `${await portionsOf()}`)
ok((await err(cashier.rpc('quote_order', { p_store_id: W, p_lines: [line(latte, 2)] })))?.includes('tinggal'), 'pesanan melebihi sisa porsi ditolak')
await owner.rpc('stock_adjust', { p_ingredient: coffee.id, p_delta: -(coffeeQty * 1.5), p_reason: 'ADJUST', p_note: 'db-check habiskan' })
ok((await portionsOf()) === 0, 'bahan habis → sisa porsi 0', `${await portionsOf()}`)
ok((await err(cashier.rpc('quote_order', { p_store_id: W, p_lines: [line(latte)] })))?.includes('tidak tersedia'), 'menu dengan bahan habis tidak bisa dipesan')
await owner.rpc('stock_adjust', { p_ingredient: coffee.id, p_delta: Number(coffee.stock), p_reason: 'ADJUST', p_note: 'db-check pulihkan' })
ok((await portionsOf()) === expPortions, 'restock → menu tersedia lagi', `${await portionsOf()}`)
const vch = (await owner.from('vouchers').select('redeemed_at').eq('store_id', W).eq('code', VC).single()).data
ok(!!vch.redeemed_at, 'voucher sekali pakai ditandai terpakai')
const q2 = (await cashier.rpc('quote_order', { p_store_id: W, p_lines: [line(latte)], p_promo_code: VC })).data
ok(q2.voucher_discount === 0, 'voucher yang sudah dipakai tidak berlaku lagi')

const avail = await kitchen.rpc('set_product_availability', { p_product: latte.id, p_available: false })
ok(!avail.error && (await anon.from('products').select('is_available').eq('id', latte.id).single()).data.is_available === false, 'dapur bisa menandai menu habis')
ok((await err(waiter.rpc('set_product_availability', { p_product: latte.id, p_available: true })))?.includes('forbidden'), 'pelayan tidak bisa mengubah ketersediaan menu')
await kitchen.rpc('set_product_availability', { p_product: latte.id, p_available: true })

console.log('\n[Void / refund & PIN]')
let r = (await cashier.rpc('reverse_order', { p_order_id: o1.id, p_kind: 'VOID', p_reason: 'salah input' })).data
ok(r.ok === false && r.error.includes('PIN'), 'kasir tanpa PIN ditolak', JSON.stringify(r))
r = (await cashier.rpc('reverse_order', { p_order_id: o1.id, p_kind: 'VOID', p_reason: 'salah input', p_pin: '0000' })).data
ok(r.ok === false && r.error === 'PIN salah', 'PIN salah ditolak', JSON.stringify(r))
r = (await cashier.rpc('reverse_order', { p_order_id: o1.id, p_kind: 'VOID', p_reason: 'x', p_pin: '1234' })).data
ok(r.ok === false && r.error.includes('Alasan'), 'alasan wajib diisi')
r = (await cashier.rpc('reverse_order', { p_order_id: o1.id, p_kind: 'VOID', p_reason: 'pelanggan batal', p_pin: '1234' })).data
ok(r.ok === true, 'kasir + PIN supervisor benar bisa void', JSON.stringify(r))
const restored = (await cashier.from('members').select('points').eq('id', member.id).single()).data.points
ok(restored === before, 'void mengembalikan poin member', `${restored} vs ${before}`)
const stockRestored = (await owner.from('ingredients').select('stock').eq('store_id', W).eq('name', 'Biji kopi').single()).data.stock
ok(Number(stockRestored) === Number(stockBefore), 'void mengembalikan stok bahan')
ok(hidden(await cashier.from('vouchers').select('id')), 'kasir tidak bisa membaca daftar voucher')
ok((await owner.from('vouchers').select('redeemed_at').eq('store_id', W).eq('code', VC).single()).data.redeemed_at === null, 'void mengembalikan voucher')
const logRows = (await owner.from('audit_log').select('action').eq('store_id', W).order('id', { ascending: false }).limit(20)).data.map((x) => x.action)
ok(logRows.includes('order.pay') && logRows.includes('order.void'), 'audit log mencatat pay & void', logRows.join(','))
ok(hidden(await cashier.from('audit_log').select('id')), 'kasir tidak bisa membaca audit log')

console.log('\n[Split & gabung bill]')
const s1 = (await waiter.rpc('create_order', { p_store_id: W, p_customer_name: 'Meja 5', p_order_type: 'DINE_IN', p_table_no: 'T5', p_lines: [line(latte), line(nasgor)] })).data
const totalBefore = (await waiter.from('orders').select('total').eq('id', s1.id).single()).data.total
const sp = await waiter.rpc('split_order', { p_order_id: s1.id, p_indexes: [1] })
ok(!sp.error && !!sp.data?.id, 'pelayan bisa pisah bill', sp.error?.message)
const a = (await waiter.from('orders').select('total').eq('id', s1.id).single()).data.total
const b = (await waiter.from('orders').select('total').eq('id', sp.data.id).single()).data.total
ok(a + b === totalBefore, 'total setelah dipisah tetap sama', `${a}+${b} vs ${totalBefore}`)
const mg = await waiter.rpc('merge_orders', { p_target: s1.id, p_source: sp.data.id })
ok(!mg.error, 'pelayan bisa gabung bill', mg.error?.message)
ok((await waiter.from('orders').select('total').eq('id', s1.id).single()).data.total === totalBefore, 'total setelah digabung kembali')
await waiter.rpc('advance_order', { p_order_id: s1.id, p_to: 'CANCELLED' })

console.log('\n[Pajak, service, pembulatan (Bakso Mas Joko: PB1 10%, bulat Rp100)]')
const bp = (await owner2.from('products').select('id,price').eq('store_id', B).limit(1).single()).data
const qt = (await owner2.rpc('quote_order', { p_store_id: B, p_lines: [{ product_id: bp.id, qty: 1, choices: [], note: '' }] })).data
const expTax = Math.round(bp.price * 0.1)
const exp = Math.round((bp.price + expTax) / 100) * 100
ok(qt.tax === expTax && qt.total === exp, `pajak 10% & pembulatan: ${bp.price} → ${qt.total}`, JSON.stringify(qt))

console.log('\n[Shift: tutup kas]')
const sum = (await cashier.rpc('shift_summary')).data
ok(sum && sum.cash_sales === 0 && sum.expected_cash === handoverCash, 'void dalam shift yang sama tidak menambah kas', JSON.stringify(sum))
await cashier.rpc('cash_movement', { p_kind: 'OUT', p_amount: 10000, p_reason: 'beli es batu' })
const expectAfterOut = handoverCash - 10000
const closed = await cashier.rpc('close_shift', { p_counted_cash: expectAfterOut, p_note: '' })
ok(!closed.error && closed.data.expected_cash === expectAfterOut && closed.data.difference === 0, 'tutup shift: kas keluar dihitung, selisih 0 tanpa catatan', JSON.stringify(closed.error ?? closed.data))

console.log('\n[Serah terima, selisih, tutup paksa, tinjauan]')
const bad1 = await err(cashier.rpc('open_shift', { p_opening_cash: expectAfterOut + 5000, p_note: '' }))
ok(bad1?.includes('SHIFT_HANDOVER_DIFF'), 'modal awal beda dari uang serah terima wajib catatan', bad1)
const o2 = await cashier.rpc('open_shift', { p_opening_cash: expectAfterOut + 5000, p_note: 'ada uang tambahan dari owner' })
ok(!o2.error && o2.data.opening_expected === expectAfterOut, 'modal beda + catatan diterima, serah terima tercatat', o2.error?.message)
const dup = await err(manager.rpc('open_shift', { p_opening_cash: 0, p_note: 'x' }))
ok(dup?.includes('SHIFT_HELD'), 'laci yang sedang dipegang kasir lain tidak bisa dibuka lagi', dup)
const st = (await waiter.rpc('shift_status')).data
ok(st?.open?.mine === false && !!st.open.who, 'staf lain bisa melihat siapa yang memegang laci', JSON.stringify(st))
const noNote = await err(cashier.rpc('close_shift', { p_counted_cash: expectAfterOut, p_note: '' }))
ok(noNote?.includes('SHIFT_DIFF_NEEDS_NOTE'), 'selisih wajib dijelaskan saat tutup shift', noNote)
ok((await err(cashier.rpc('force_close_shift', { p_shift: o2.data.id, p_counted_cash: 0, p_note: 'x' })))?.includes('forbidden'), 'kasir tidak bisa tutup paksa')
const fc = await manager.rpc('force_close_shift', { p_shift: o2.data.id, p_counted_cash: expectAfterOut + 5000 - 2000, p_note: 'kasir pulang, uang kurang 2rb' })
ok(!fc.error && fc.data.forced === true && fc.data.difference === -2000, 'manager menutup paksa shift terlupa, selisih -2.000', fc.error?.message)
const det = (await manager.rpc('shift_detail', { p_shift: o2.data.id })).data
ok(det?.shift?.forced === true && det.totals.expected === expectAfterOut + 5000 && det.shift.opened_by === 'kasir@pos.test', 'rincian shift memuat pembuka, tutup paksa, dan kas diharapkan')
ok((await err(cashier.rpc('review_shift', { p_shift: o2.data.id, p_note: 'ok' })))?.includes('forbidden'), 'kasir tidak bisa meninjau selisih')
ok(!(await err(manager.rpc('review_shift', { p_shift: o2.data.id, p_note: 'dijelaskan kasir, dicatat sebagai kekurangan' }))), 'manager meninjau selisih')
const stats = (await manager.rpc('shift_stats', { p_from: '2026-01-01', p_to: '2026-12-31' })).data
ok(stats && stats.with_diff >= 1 && Array.isArray(stats.by_cashier) && stats.by_cashier.length > 0, 'statistik selisih per kasir tersedia', JSON.stringify(stats)?.slice(0, 120))
ok((await err(cashier.rpc('shift_stats', { p_from: '2026-01-01', p_to: '2026-12-31' })))?.includes('forbidden'), 'kasir tidak bisa melihat statistik selisih')
const detOrders = (await manager.rpc('shift_detail', { p_shift: closed.data.id })).data
ok(Array.isArray(detOrders.orders) && detOrders.orders.every((o) => o.source === 'CUSTOMER' || o.source === 'STAFF'), 'tiap pesanan di rincian ditandai asalnya (pelanggan QR atau staf)')

console.log('\n[Onboarding & langganan]')
const stores = (await anon.from('stores').select('slug,plan').in('slug', ['warkop-nusantara'])).data
ok(Array.isArray(stores), 'kolom plan terbaca')

await manager.from('vouchers').select('id').eq('code', VC).maybeSingle().then(async ({ data }) => data && manager.rpc('delete_voucher', { p_id: data.id }))

console.log('\n[Bahasa & pesan]')
const own = owner
ok((await err(own.rpc('save_message', { p_locale: 'jaksel', p_key: 'shift.taken', p_text: 'Lacinya udah dipake orang lain' }))) === null, 'owner menyunting kalimat peringatan')
ok((await cashier.from('message_overrides').select('text').eq('key', 'shift.taken')).data?.[0]?.text === 'Lacinya udah dipake orang lain', 'staf toko membaca kalimat yang disunting')
ok(hidden(await owner2.from('message_overrides').select('text').eq('key', 'shift.taken')), 'toko lain tidak melihat kalimat toko ini')
ok((await err(manager.rpc('save_message', { p_locale: 'id', p_key: 'shift.taken', p_text: 'x' })))?.includes('forbidden'), 'manager tidak bisa menyunting kalimat (khusus owner)')
ok((await err(cashier.rpc('save_store_locale', { p_locale: 'en' })))?.includes('forbidden'), 'kasir tidak bisa mengubah bahasa toko')
ok((await err(own.rpc('save_store_locale', { p_locale: 'fr' }))) !== null, 'bahasa di luar daftar ditolak')
ok((await err(own.rpc('save_message', { p_locale: 'jaksel', p_key: 'shift.taken', p_text: '' }))) === null && hidden(await cashier.from('message_overrides').select('text').eq('key', 'shift.taken')), 'teks kosong mengembalikan ke kalimat bawaan')
const locs = (await anon.from('stores').select('locale').eq('slug', 'warkop-nusantara').single()).data
ok(['id', 'jaksel', 'en'].includes(locs?.locale), 'bahasa bawaan toko terbaca')

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} lulus, ${fail} gagal`)
process.exit(fail === 0 ? 0 : 1)
