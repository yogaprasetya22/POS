/**
 * Simulasi operasional 1 bulan (default 30 hari) + audit otomatis, memakai fungsi RPC asli seperti aplikasi.
 *
 *   bun scripts/sim-month.mjs                     # dry-run: hanya menampilkan apa yang akan dihapus
 *   bun scripts/sim-month.mjs --yes               # hapus transaksi bulan ini/rentang simulasi, simulasikan 30 hari, audit
 *   bun scripts/sim-month.mjs --yes --days 14 --seed 7 --store warkop-nusantara
 *   bun scripts/sim-month.mjs --yes --reset-only  # hanya hapus transaksi
 *
 * PERINGATAN: menghapus transaksi (pesanan, shift, kas, poin, mutasi stok) milik SATU toko pada rentang
 * tanggal simulasi. Jalankan hanya ke database demo/dev. Butuh SUPABASE_ACCESS_TOKEN (sama seperti make migrate).
 * Tanggal mundur dibuat dengan menggeser timestamp setelah tiap hari disimulasikan (RPC selalu memakai now()).
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)
const SLUG = opt('store', 'warkop-nusantara')
const DAYS = Number(opt('days', 30))
const YES = flag('yes')
if (!/^[a-z0-9-]+$/.test(SLUG) || !(DAYS >= 1 && DAYS <= 90)) throw new Error('--store atau --days tidak valid (1-90)')

const fileEnv = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)
const env = { ...fileEnv, ...process.env }
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY
const REF = env.SUPABASE_PROJECT_REF || URL_.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!env.SUPABASE_ACCESS_TOKEN || !REF) throw new Error('SUPABASE_ACCESS_TOKEN / project ref tidak ada di .env')

const sql = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`SQL gagal (${res.status}): ${(await res.text()).slice(0, 400)}`)
  return res.json()
}

// RNG berbenih supaya hasil bisa diulang
let s = Number(opt('seed', 20261110)) >>> 0
const rnd = () => ((s = (s + 0x6d2b79f5) >>> 0), ((t) => ((t = Math.imul(t ^ (t >>> 15), t | 1)), (t ^= t + Math.imul(t ^ (t >>> 7), t | 61)), ((t ^ (t >>> 14)) >>> 0) / 4294967296))(s))
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pick = (arr) => arr[int(0, arr.length - 1)]

const rp = (n) => 'Rp' + n.toLocaleString('id-ID')
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)
const monthStart = today.slice(0, 8) + '01'
const simStart = addDays(today, -(DAYS - 1))
const D0 = monthStart < simStart ? monthStart : simStart

let pass = 0, fail = 0
const ok = (c, name, extra = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${name}${c ? '' : ` ${extra}`}`) }

const storeRow = (await sql(`select id, name from stores where slug = '${SLUG}'`))[0]
if (!storeRow) throw new Error(`toko ${SLUG} tidak ditemukan`)
const SID = storeRow.id
console.log(`Toko: ${storeRow.name} (${SLUG})  ·  rentang reset: ${D0} s/d sekarang  ·  simulasi: ${DAYS} hari (${simStart} → ${today})`)

// ---------- 1. Reset transaksi ----------
const count = async () => (await sql(`select
  (select count(*) from orders where store_id='${SID}' and business_day >= '${D0}')::int as orders,
  (select count(*) from shifts where store_id='${SID}' and opened_at >= '${D0}')::int as shifts,
  (select count(*) from cash_movements where store_id='${SID}' and created_at >= '${D0}')::int as cash,
  (select count(*) from stock_movements where store_id='${SID}' and created_at >= '${D0}')::int as stock`))[0]

async function reset() {
  console.log('\n[Reset transaksi]')
  console.log('  sebelum:', JSON.stringify(await count()))
  if (!YES) { console.log('  Dry-run: tambahkan --yes untuk benar-benar menghapus.'); process.exit(0) }
  await sql(`do $$ declare sid uuid := '${SID}'; d0 date := '${D0}'; begin
    create temp table _o on commit drop as select id, member_id, total, paid_at from orders where store_id = sid and business_day >= d0;
    -- kembalikan efek ke stok & member sebelum baris dihapus
    update ingredients i set stock = i.stock - x.s from (select ingredient_id, sum(delta) s from stock_movements where order_id in (select id from _o) group by 1) x where i.id = x.ingredient_id;
    update members m set points = greatest(0, m.points - x.p) from (select member_id, sum(delta) p from point_ledger where order_id in (select id from _o) group by 1) x where m.id = x.member_id;
    update members m set total_spent = greatest(0, m.total_spent - x.t), visits = greatest(0, m.visits - x.v)
      from (select member_id, sum(total) t, count(*) v from _o where member_id is not null and paid_at is not null group by 1) x where m.id = x.member_id;
    update vouchers set redeemed_at = null, redeemed_order_id = null where redeemed_order_id in (select id from _o);
    delete from point_ledger where order_id in (select id from _o);
    delete from stock_movements where order_id in (select id from _o);
    delete from orders where id in (select id from _o);
    update shifts set handover_from = null where store_id = sid and handover_from in (select id from shifts where store_id = sid and opened_at >= d0);
    delete from shifts where store_id = sid and opened_at >= d0;
    delete from daily_counters where store_id = sid and day >= d0;
  end $$;`)
  console.log('  sesudah:', JSON.stringify(await count()))
}

// ---------- klien ----------
const anonClient = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function as(email, password) {
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}
const rpc = async (c, name, a = {}) => {
  const { data, error } = await c.rpc(name, a)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}

// ---------- 2. Simulasi ----------
const TZ_COLS = {}
async function tsCols(table) {
  TZ_COLS[table] ??= (await sql(`select column_name c from information_schema.columns where table_schema='public' and table_name='${table}' and data_type like 'timestamp%'`)).map((r) => r.c)
  return TZ_COLS[table]
}
/** Geser semua timestamp baris simulasi hari ini mundur k hari. */
async function backdate(k, shiftIds, orderIds) {
  if (!k) return
  const iv = `interval '${k} days'`
  const set = async (table, where) => {
    const cols = await tsCols(table)
    return `update ${table} set ${cols.map((c) => `${c} = ${c} - ${iv}`).join(', ')}${table === 'orders' ? `, business_day = business_day - ${k}` : ''} where ${where};`
  }
  const sh = shiftIds.map((i) => `'${i}'`).join(','), od = orderIds.length ? orderIds.map((i) => `'${i}'`).join(',') : "'00000000-0000-0000-0000-000000000000'"
  await sql([
    await set('orders', `id in (${od})`), await set('shifts', `id in (${sh})`), await set('cash_movements', `shift_id in (${sh})`),
    await set('point_ledger', `order_id in (${od})`), await set('stock_movements', `order_id in (${od})`),
    `delete from daily_counters where store_id = '${SID}' and day = (now() at time zone 'Asia/Jakarta')::date;`,
  ].join('\n'))
}

const NAMES = ['Budi', 'Sari', 'Andi', 'Dewi', 'Rizky', 'Putri', 'Agus', 'Nadia', 'Fajar', 'Rina', 'Dimas', 'Maya']
const METHODS = ['CASH', 'CASH', 'CASH', 'CASH', 'CASH', 'CASH', 'QRIS_STATIC', 'QRIS_STATIC', 'QRIS_STATIC', 'EDC_CARD']
const stats = { days: 0, shifts: 0, orders: 0, cancelled: 0, voids: 0, refunds: 0, revenue: 0, short: 0, over: 0, errors: [] }
const simOrders = [], simShiftIds = []
const note = (e) => { stats.errors.push(String(e.message ?? e)); if (stats.errors.length <= 5) console.log('  ! ' + (e.message ?? e)) }

async function main() {
  await reset()
  if (flag('reset-only')) return

  const anon = anonClient()
  const owner = await as('admin@pos.test', 'admin12345')
  const manager = await as('manager@pos.test', 'manager12345')
  const cashier = await as('kasir@pos.test', 'kasir12345')
  const kitchen = await as('dapur@pos.test', 'dapur12345')

  // laci harus bebas
  const open0 = (await rpc(manager, 'shift_status')).open
  if (open0) {
    const d = await rpc(manager, 'shift_detail', { p_shift: open0.id })
    await rpc(manager, 'force_close_shift', { p_shift: open0.id, p_counted_cash: d.totals.expected, p_note: 'dibersihkan sim-month' })
  }
  let carry = (await rpc(manager, 'shift_status')).last_closed?.counted_cash ?? 100000

  const products = ((await owner.from('products').select('id,modifiers').eq('store_id', SID).eq('is_available', true).limit(30)).data ?? []).map((p) => ({
    id: p.id, choices: (p.modifiers ?? []).filter((g) => g.required).map((g) => ({ group: g.name, option: g.options[0].name })),
  }))
  const tables = ((await owner.from('store_tables').select('label').eq('store_id', SID).eq('is_active', true)).data ?? []).map((t) => t.label)
  if (!products.length) throw new Error('toko tidak punya menu tersedia (jalankan make seed)')

  const memberIds = []
  for (let i = 1; i <= 6; i++) memberIds.push((await rpc(cashier, 'upsert_member', { p_phone: `0812000100${i}`, p_name: `Member Sim ${i}` })).id)

  const ing0 = new Map(((await owner.from('ingredients').select('id,stock').eq('store_id', SID)).data ?? []).map((r) => [r.id, Number(r.stock)]))
  const mem0 = new Map(((await owner.from('members').select('id,points').eq('store_id', SID)).data ?? []).map((r) => [r.id, r.points]))

  const lines = () => Array.from({ length: int(1, 3) }, () => { const p = pick(products); return { product_id: p.id, qty: int(1, 3), choices: p.choices, note: '' } })

  async function sellOne(staff, label, tracker, extra) {
    const dine = tables.length && rnd() < 0.55
    const byStaff = rnd() < 0.3
    const member = byStaff && rnd() < 0.5 ? pick(memberIds) : null
    const args = { p_store_id: SID, p_customer_name: pick(NAMES), p_order_type: dine ? 'DINE_IN' : 'TAKEAWAY', p_table_no: dine ? pick(tables) : null, p_lines: lines() }
    if (member) Object.assign(args, { p_member_id: member, p_redeem_points: rnd() < 0.3 ? 10 : 0 })
    const o = await rpc(byStaff ? staff : anon, 'create_order', args)
    simOrders.push(o.id) // semua pesanan (termasuk yang batal) ikut digeser tanggalnya
    if (rnd() < 0.04) { await rpc(staff, 'advance_order', { p_order_id: o.id, p_to: 'CANCELLED' }); stats.cancelled++; extra.push(o.id); return }
    const method = pick(METHODS)
    const received = method === 'CASH' ? (rnd() < 0.4 ? o.total : Math.ceil(o.total / 5000) * 5000 + (rnd() < 0.3 ? 5000 : 0)) : null
    const paid = await rpc(staff, 'pay_order', { p_order_id: o.id, p_method: method, p_cash_received: received })
    await rpc(kitchen, 'advance_order', { p_order_id: o.id, p_to: 'READY' })
    await rpc(kitchen, 'advance_order', { p_order_id: o.id, p_to: 'COMPLETED' })
    const rec = { id: o.id, total: paid.total ?? o.total, method, label, voided: false }
    tracker.push(rec)
  }

  const shiftRows = await sql(`select id, name from shift_names where store_id = '${SID}' and is_active order by sort_order`)
  const shiftPagi = shiftRows.find((s) => s.name.toLowerCase().includes('pagi'))?.id ?? shiftRows[0]?.id ?? null
  const shiftSore = shiftRows.find((s) => s.name.toLowerCase().includes('sore'))?.id ?? shiftRows[1]?.id ?? shiftPagi

  async function runShift(staff, label, n, plan) {
    const extra = [] // id pesanan batal
    const sName = label === 'pagi' ? shiftPagi : shiftSore
    const sh = await rpc(staff, 'open_shift', { p_opening_cash: carry, p_note: '', p_shift_name: sName })
    simShiftIds.push(sh.id)
    const mine = []
    for (let i = 0; i < n; i += 3) await Promise.all(Array.from({ length: Math.min(3, n - i) }, () => sellOne(staff, label, mine, extra).catch(note)))
    let cashIn = 0, cashOut = 0, reversed = 0
    if (plan.voidSame && mine.some((o) => o.method === 'CASH')) {
      const t = pick(mine.filter((o) => o.method === 'CASH'))
      const r = await rpc(staff, 'reverse_order', { p_order_id: t.id, p_kind: 'VOID', p_reason: 'Salah input (simulasi)', p_pin: null })
      if (r.ok) { t.voided = true; stats.voids++ } else note(new Error('void: ' + r.error))
    }
    if (plan.refund) {
      const t = plan.refund.find((o) => o.method === 'CASH' && !o.voided)
      if (t) {
        const r = await rpc(staff, 'reverse_order', { p_order_id: t.id, p_kind: 'REFUND', p_reason: 'Pelanggan komplain (simulasi)', p_pin: null })
        if (r.ok) { t.voided = true; reversed += t.total; stats.refunds++ } else note(new Error('refund: ' + r.error))
      }
    }
    if (plan.topUp) { await rpc(staff, 'cash_movement', { p_kind: 'IN', p_amount: plan.topUp, p_reason: 'Tambah uang receh' }); cashIn += plan.topUp }
    const cashSales = mine.filter((o) => o.method === 'CASH' && !o.voided).reduce((a, o) => a + o.total, 0)
    if (plan.withdrawRatio) {
      const amt = Math.floor((cashSales * plan.withdrawRatio) / 1000) * 1000
      if (amt > 0) { await rpc(staff, 'cash_movement', { p_kind: 'OUT', p_amount: amt, p_reason: 'Setoran ke owner' }); cashOut += amt }
    }
    // saldo yang seharusnya, dihitung terpisah dari database
    const expected = carry + cashSales + cashIn - cashOut - reversed
    const sum = await rpc(staff, 'shift_summary')
    ok(sum.expected_cash === expected, `${label}: kas seharusnya ${rp(expected)} (dihitung mandiri) = sistem`, `sistem ${sum.expected_cash}`)
    const r = rnd()
    const diff = r < 0.85 ? 0 : r < 0.95 ? -int(1, 5) * 2000 : int(1, 5) * 1000
    if (diff < 0) stats.short++
    if (diff > 0) stats.over++
    const closed = await rpc(staff, 'close_shift', { p_counted_cash: expected + diff, p_note: diff ? 'Selisih hitung (simulasi)' : '' })
    ok(closed.difference === diff, `${label}: selisih tercatat ${rp(diff)}`, `db ${closed.difference}`)
    carry = closed.counted_cash
    stats.shifts++
    stats.revenue += mine.filter((o) => !o.voided).reduce((a, o) => a + o.total, 0)
    return { sh, mine, extra }
  }

  console.log('\n[Simulasi]')
  for (let k = DAYS - 1; k >= 0; k--) {
    const day = addDays(today, -k)
    const dayShifts = [], before = simOrders.length
    const a = await runShift(cashier, 'Shift A', int(6, 14), { withdrawRatio: rnd() < 0.7 ? 0.8 : 0, topUp: rnd() < 0.15 ? 20000 : 0 })
    const b = await runShift(manager, 'Shift B', int(5, 12), { voidSame: k % 3 === 0, refund: k % 4 === 0 ? a.mine : null, withdrawRatio: 0.9 })
    dayShifts.push(a.sh.id, b.sh.id)
    const dayOrders = simOrders.slice(before)
    await backdate(k, dayShifts, dayOrders)
    stats.days++
    stats.orders += a.mine.length + b.mine.length
    process.stdout.write(`  ${day}  ${String(a.mine.length + b.mine.length).padStart(2)} pesanan  kas bawaan ${rp(carry)}\n`)
  }

  // ---------- 3. Audit akhir ----------
  console.log('\n[Audit akhir dari database]')
  await audit(manager, owner, ing0, mem0)
}

async function audit(manager, _owner, ing0, mem0) {
  const win = `store_id='${SID}' and business_day >= '${simStart}'`
  const one = async (q) => (await sql(q))[0]
  const bad = async (q) => Number((await one(`select count(*)::int n from (${q}) x`)).n)

  ok((await bad(`select 1 from shifts where store_id='${SID}' and opened_at >= '${simStart}' and closed_at is null`)) === 0, 'semua shift simulasi sudah ditutup')
  ok((await bad(`select 1 from orders where ${win} and status in ('UNPAID','IN_KITCHEN','READY')`)) === 0, 'tidak ada pesanan menggantung (UNPAID/dapur/siap)')
  ok((await bad(`select 1 from orders where ${win} and paid_at is not null and shift_id is null`)) === 0, 'semua pesanan terbayar terikat ke shift')
  ok((await bad(`select 1 from orders where ${win} and payment_method = 'CASH' and paid_at is not null and coalesce(cash_received,0) < total`)) === 0, 'uang tunai diterima ≥ total di semua pesanan tunai')
  ok((await bad(`select 1 from orders where ${win} and subtotal > 0 and total <> subtotal - discount_amount - voucher_discount - points_discount + service_amount + tax_amount + rounding_amount`)) === 0, 'total = subtotal − diskon + service + pajak + pembulatan (semua pesanan)')
  ok((await bad(`select 1 from (select opening_cash, lag(counted_cash) over (order by opened_at) prev from shifts where store_id='${SID}' and opened_at >= '${simStart}') s where prev is not null and opening_cash <> prev`)) === 0, 'rantai serah terima: modal shift = hasil hitung shift sebelumnya')
  ok((await bad(`select 1 from shifts where store_id='${SID}' and opened_at >= '${simStart}' and closed_at is not null and difference <> counted_cash - expected_cash`)) === 0, 'selisih = hasil hitung − seharusnya (semua shift)')
  ok((await bad(`select 1 from shifts s where s.store_id='${SID}' and s.opened_at >= '${simStart}' and s.closed_at is not null and s.expected_cash <> (select expected from shift_totals(s.id))`)) === 0, 'kas seharusnya yang tersimpan = hitung ulang dari transaksi')
  ok((await bad(`select 1 from orders where ${win} group by store_id, business_day, queue_code having count(*) > 1`)) === 0, 'kode antrean unik per hari')

  // laporan penjualan harus cocok dengan jumlah pesanan terbayar
  const rep = await rpc(manager, 'sales_report', { p_from: simStart, p_to: today })
  const truth = await one(`select count(*)::int n, coalesce(sum(total),0)::int net from orders where ${win} and paid_at is not null and status in ('IN_KITCHEN','READY','COMPLETED')`)
  ok(rep.totals.orders === truth.n && rep.totals.net === truth.net, `laporan = data mentah (${truth.n} pesanan, ${rp(truth.net)})`, JSON.stringify(rep.totals))
  ok(rep.by_method.reduce((a, m) => a + m.net, 0) === rep.totals.net, 'jumlah per metode bayar = total laporan')
  ok(rep.daily.length === DAYS, `laporan harian memuat ${DAYS} hari`, `ada ${rep.daily.length}`)
  ok(rep.voids.count === stats.voids && rep.refunds.count === stats.refunds, `void (${stats.voids}) dan refund (${stats.refunds}) tercatat di laporan`, JSON.stringify({ v: rep.voids, r: rep.refunds }))

  // stok bahan: perubahan = jumlah mutasi
  const mv = await sql(`select ingredient_id id, sum(delta)::float d from stock_movements where store_id='${SID}' and order_id in (select id from orders where ${win}) group by 1`)
  const ingNow = (await sql(`select id, stock::float s from ingredients where store_id='${SID}'`))
  let stockOk = true
  for (const r of ingNow) { const d = mv.find((m) => m.id === r.id)?.d ?? 0; if (Math.abs(r.s - (ing0.get(r.id) ?? r.s) - d) > 0.001) { stockOk = false; console.log('    stok tidak cocok', r.id) } }
  ok(stockOk, 'perubahan stok tiap bahan = jumlah mutasi stok')

  // poin member
  const pl = await sql(`select member_id id, sum(delta)::int d from point_ledger where store_id='${SID}' and order_id in (select id from orders where ${win}) group by 1`)
  const memNow = await sql(`select id, points from members where store_id='${SID}'`)
  ok(memNow.every((m) => { const d = pl.find((p) => p.id === m.id)?.d ?? 0; return m.points === Math.max(0, (mem0.get(m.id) ?? m.points) + d) }), 'saldo poin member = saldo awal + buku poin')
}

try {
  await main()
} catch (e) {
  console.error('\n❌', e.message)
  process.exit(1)
}

if (!flag('reset-only')) {
  console.log(`\nRingkasan: ${stats.days} hari · ${stats.shifts} shift · ${stats.orders} pesanan · ${stats.cancelled} batal · ${stats.voids} void · ${stats.refunds} refund · omzet ${rp(stats.revenue)} · selisih kurang ${stats.short}× / lebih ${stats.over}×`)
  if (stats.errors.length) console.log(`Galat saat simulasi: ${stats.errors.length} (contoh: ${stats.errors[0]})`)
  console.log(`\n${fail === 0 && stats.errors.length === 0 ? '✅' : '❌'} ${pass} lulus, ${fail} gagal, ${stats.errors.length} galat simulasi`)
  process.exit(fail || stats.errors.length ? 1 : 0)
}
