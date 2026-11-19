/**
 * Data contoh HARI INI saja: shift pagi (07.00–14.00, kasir) dan shift sore (14.00–15.30, manager),
 * memakai RPC asli aplikasi (harga, pajak, stok, poin dihitung database), lalu jam tiap transaksi
 * digeser ke waktu yang realistis (ramai saat sarapan & makan siang). TIDAK menghapus data apa pun.
 * Shift yang masih terbuka ditutup dulu (uang dihitung = seharusnya) karena laci harus bebas.
 *
 *   bun scripts/sim-today.mjs --yes [--store warkop-nusantara] [--seed 7]
 *
 * Hanya untuk database demo/dev. Butuh SUPABASE_ACCESS_TOKEN di .env (sama seperti make migrate).
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)
const SLUG = opt('store', 'warkop-nusantara')
if (!/^[a-z0-9-]+$/.test(SLUG)) throw new Error('--store tidak valid')
if (!args.includes('--yes')) { console.log('Tambahkan --yes untuk membuat data contoh hari ini.'); process.exit(0) }

const env = {
  ...Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])),
  ...process.env,
}
const REF = env.SUPABASE_PROJECT_REF || env.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!env.SUPABASE_ACCESS_TOKEN || !REF) throw new Error('SUPABASE_ACCESS_TOKEN / project ref tidak ada di .env')
const sql = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`SQL gagal (${res.status}): ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

let s = Number(opt('seed', Date.now() % 1e6)) >>> 0
const rnd = () => ((s = (s + 0x6d2b79f5) >>> 0), ((t) => ((t = Math.imul(t ^ (t >>> 15), t | 1)), (t ^= t + Math.imul(t ^ (t >>> 7), t | 61)), ((t ^ (t >>> 14)) >>> 0) / 4294967296))(s))
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pick = (arr) => arr[int(0, arr.length - 1)]
const rp = (n) => 'Rp' + n.toLocaleString('id-ID')

const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function as(email, password) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}
const rpc = async (c, name, a = {}) => {
  const { data, error } = await c.rpc(name, a)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}

// jam Jakarta hari ini → ISO UTC
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
const at = (h, m = 0) => new Date(`${today}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`)
const nowJkt = new Date()

/** n waktu acak dalam [from, to] dengan puncak di sekitar jam-jam ramai; terurut. */
function times(n, from, to, peaks) {
  const out = []
  while (out.length < n) {
    const t = from.getTime() + rnd() * (to.getTime() - from.getTime())
    const h = new Date(t).getUTCHours() + 7 + new Date(t).getUTCMinutes() / 60
    const w = 0.25 + peaks.reduce((a, p) => a + Math.exp(-((h - p) ** 2) / 0.6), 0)
    if (rnd() < w / 1.6) out.push(new Date(t))
  }
  return out.sort((a, b) => a - b)
}

const NAMES = ['Budi', 'Sari', 'Andi', 'Dewi', 'Rizky', 'Putri', 'Agus', 'Nadia', 'Fajar', 'Rina', 'Dimas', 'Maya', 'Joko', 'Lina']
const METHODS = ['CASH', 'CASH', 'CASH', 'CASH', 'CASH', 'QRIS_STATIC', 'QRIS_STATIC', 'QRIS_STATIC', 'EDC_CARD']

const store = (await sql(`select id, name from stores where slug = '${SLUG}'`))[0]
if (!store) throw new Error(`toko ${SLUG} tidak ditemukan`)
const SID = store.id
console.log(`Toko: ${store.name} · tanggal ${today}`)

const anon = client()
const cashier = await as('kasir@pos.test', 'kasir12345')
const manager = await as('manager@pos.test', 'manager12345')
const kitchen = await as('dapur@pos.test', 'dapur12345')

// laci harus bebas
const open0 = (await rpc(manager, 'shift_status')).open
if (open0) {
  const d = await rpc(manager, 'shift_detail', { p_shift: open0.id })
  await rpc(manager, 'force_close_shift', { p_shift: open0.id, p_counted_cash: d.totals.expected, p_note: 'Ditutup untuk membuat data contoh hari ini' })
  console.log(`Shift terbuka milik ${open0.who} ditutup (uang dihitung = seharusnya ${rp(d.totals.expected)})`)
}

const products = ((await manager.from('products').select('id,name,modifiers').eq('store_id', SID).eq('is_available', true).limit(40)).data ?? []).map((p) => ({
  id: p.id, choices: (p.modifiers ?? []).filter((g) => g.required).map((g) => ({ group: g.name, option: g.options[0].name })),
}))
if (!products.length) throw new Error('toko tidak punya menu tersedia')
const tables = ((await manager.from('store_tables').select('label').eq('store_id', SID).eq('is_active', true)).data ?? []).map((t) => t.label)
const shiftNames = await sql(`select id, name from shift_names where store_id = '${SID}' and is_active order by sort_order`)
const nameId = (word, i) => shiftNames.find((r) => r.name.toLowerCase().includes(word))?.id ?? shiftNames[i]?.id ?? null
const lines = () => Array.from({ length: int(1, 3) }, () => { const p = pick(products); return { product_id: p.id, qty: int(1, 2), choices: p.choices, note: '' } })

/** Geser semua kolom waktu satu baris (dan turunannya) supaya created_at = target. */
const tsCols = {}
const cols = async (t) => (tsCols[t] ??= (await sql(`select column_name c from information_schema.columns where table_schema='public' and table_name='${t}' and data_type like 'timestamp%'`)).map((r) => r.c))
async function moveOrder(id, target) {
  const set = async (t) => (await cols(t)).map((c) => `${c} = ${c} + d.delta`).join(', ')
  await sql(`with d as (select '${target.toISOString()}'::timestamptz - created_at as delta from orders where id = '${id}')
    , a as (update stock_movements x set ${await set('stock_movements')} from d where x.order_id = '${id}')
    , b as (update point_ledger x set ${await set('point_ledger')} from d where x.order_id = '${id}')
    update orders x set ${await set('orders')} from d where x.id = '${id}';`)
}

const summary = []
async function runShift({ staff, label, word, idx, from, to, n, peaks, withdraw, cancelOne }) {
  const carry = (await rpc(staff, 'shift_status')).last_closed?.counted_cash ?? 100000
  const sh = await rpc(staff, 'open_shift', { p_opening_cash: carry, p_note: '', p_shift_name: nameId(word, idx) })
  const when = times(n, new Date(from.getTime() + 5 * 60e3), new Date(to.getTime() - 10 * 60e3), peaks)
  let sold = 0, revenue = 0, cancelled = 0
  for (const t of when) {
    const dine = tables.length && rnd() < 0.55
    const o = await rpc(rnd() < 0.35 ? staff : anon, 'create_order', {
      p_store_id: SID, p_customer_name: pick(NAMES), p_order_type: dine ? 'DINE_IN' : 'TAKEAWAY', p_table_no: dine ? pick(tables) : null, p_lines: lines(),
    })
    if (cancelOne && !cancelled && sold > 3) {
      await rpc(staff, 'advance_order', { p_order_id: o.id, p_to: 'CANCELLED' }); cancelled++
    } else {
      const method = pick(METHODS)
      const cash = method === 'CASH' ? (rnd() < 0.4 ? o.total : Math.ceil(o.total / 10000) * 10000) : null
      const paid = await rpc(staff, 'pay_order', { p_order_id: o.id, p_method: method, p_cash_received: cash })
      await rpc(kitchen, 'advance_order', { p_order_id: o.id, p_to: 'READY' })
      await rpc(kitchen, 'advance_order', { p_order_id: o.id, p_to: 'COMPLETED' })
      sold++; revenue += paid.total ?? o.total
    }
    await moveOrder(o.id, t)
  }
  if (withdraw) await rpc(staff, 'cash_movement', { p_kind: 'OUT', p_amount: 15000, p_reason: 'Beli es batu & gas' })
  const sum = await rpc(staff, 'shift_summary')
  const closed = await rpc(staff, 'close_shift', { p_counted_cash: sum.expected_cash, p_note: '' })
  // jam buka/tutup shift & kas keluar ke waktu yang realistis
  await sql(`update shifts set opened_at = '${from.toISOString()}', closed_at = '${to.toISOString()}' where id = '${sh.id}';
    update cash_movements set created_at = '${new Date(to.getTime() - 40 * 60e3).toISOString()}' where shift_id = '${sh.id}';`)
  summary.push(`${label}: ${sold} terbayar${cancelled ? `, ${cancelled} batal` : ''} · ${rp(revenue)} · laci ${rp(closed.counted_cash)}`)
}

const soreEnd = new Date(Math.min(at(15, 30).getTime(), nowJkt.getTime() - 5 * 60e3))
await runShift({ staff: cashier, label: 'Shift pagi 07.00–14.00 (kasir)', word: 'pagi', idx: 0, from: at(7), to: at(14), n: int(26, 32), peaks: [8, 12.3], withdraw: true })
await runShift({ staff: manager, label: `Shift sore 14.00–${soreEnd.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} (manager)`, word: 'sore', idx: 1, from: at(14), to: soreEnd, n: int(10, 14), peaks: [15], cancelOne: true })

console.log('\n' + summary.join('\n'))
const t = (await sql(`select count(*)::int n, coalesce(sum(total),0)::int net from orders where store_id='${SID}' and business_day='${today}' and paid_at is not null and status in ('IN_KITCHEN','READY','COMPLETED')`))[0]
console.log(`\n✅ Total hari ini sekarang: ${t.n} penjualan · ${rp(t.net)}`)
