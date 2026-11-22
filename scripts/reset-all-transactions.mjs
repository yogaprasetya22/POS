/**
 * Skrip untuk membersihkan seluruh data transaksi di semua toko:
 * - Menghapus seluruh pesanan (orders)
 * - Mengembalikan stok bahan baku (ingredients) dari pengurangan pesanan
 * - Menghapus mutasi stok akibat pesanan (stock_movements)
 * - Mereset poin & total belanja member (members & point_ledger)
 * - Mereset status pemakaian voucher (vouchers)
 * - Menghapus pergeseran kas (cash_movements) & shift kasir (shifts)
 * - Mereset antrean harian (daily_counters)
 * - Menghapus audit log terkait transaksi kasir & pesanan
 */
import fs from 'node:fs'

const fileEnv = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)
const REF = fileEnv.SUPABASE_PROJECT_REF || fileEnv.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const TOKEN = fileEnv.SUPABASE_ACCESS_TOKEN
if (!REF || !TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN / project ref tidak ada di .env')

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function getStats() {
  const [res] = await sql(`
    SELECT
      (SELECT count(*) FROM orders)::int AS orders,
      (SELECT count(*) FROM shifts)::int AS shifts,
      (SELECT count(*) FROM withdrawals)::int AS withdrawals,
      (SELECT count(*) FROM cash_movements)::int AS cash_movements,
      (SELECT count(*) FROM stock_movements WHERE order_id IS NOT NULL OR reason IN ('SALE', 'VOID', 'WASTE'))::int AS test_stock_movements,
      (SELECT count(*) FROM daily_counters)::int AS daily_counters
  `)
  return res
}

console.log('Status data transaksi sebelum pembersihan:')
console.table(await getStats())

await sql(`
  -- 0. Nonaktifkan trigger stok sementara untuk pengembalian stok yang aman
  ALTER TABLE ingredients DISABLE TRIGGER ingredients_no_negative;

  DO $$
  BEGIN
    -- 1. Kembalikan stok bahan dari mutasi penjualan & void
    UPDATE ingredients i
    SET stock = GREATEST(0, i.stock - x.s)
    FROM (
      SELECT ingredient_id, sum(delta) AS s
      FROM stock_movements
      WHERE order_id IS NOT NULL
      GROUP BY ingredient_id
    ) x
    WHERE i.id = x.ingredient_id;

    -- 2. Hapus mutasi stok yang terhubung ke order atau sisa testing (termasuk waste test)
    DELETE FROM stock_movements WHERE order_id IS NOT NULL OR reason IN ('SALE', 'VOID', 'WASTE');

    -- 3. Kembalikan & reset poin serta statistik belanja member
    UPDATE members
    SET points = 0,
        total_spent = 0,
        visits = 0;

    -- 4. Hapus seluruh ledger poin
    DELETE FROM point_ledger;

    -- 5. Reset voucher yang terpakai
    UPDATE vouchers
    SET redeemed_at = NULL,
        redeemed_order_id = NULL
    WHERE redeemed_order_id IS NOT NULL;

    -- 6. Bersihkan riwayat penarikan dana (withdrawals)
    DELETE FROM withdrawals;

    -- 7. Lepaskan foreign key circular antara purchases, orders, dan shifts
    UPDATE purchases SET shift_id = NULL;
    UPDATE orders SET shift_id = NULL, reversal_shift_id = NULL;

    -- 8. Hapus seluruh orders
    DELETE FROM orders;

    -- 9. Lepaskan foreign key circular shift handover_from
    UPDATE shifts SET handover_from = NULL;

    -- 10. Hapus cash movements
    DELETE FROM cash_movements;

    -- 11. Hapus shifts
    DELETE FROM shifts;

    -- 12. Hapus counter antrean harian
    DELETE FROM daily_counters;

    -- 13. Hapus audit log transaksi
    DELETE FROM audit_log
    WHERE action IN (
      'order.pay', 'order.cancel', 'order.void', 'order.refund',
      'order.split', 'order.merge', 'shift.open', 'shift.close',
      'shift.force_close', 'shift.review', 'cash.in', 'cash.out', 'finance.withdrawal'
    );
  END $$;

  -- Aktifkan kembali trigger stok
  ALTER TABLE ingredients ENABLE TRIGGER ingredients_no_negative;
`)

console.log('\nStatus data transaksi setelah pembersihan:')
console.table(await getStats())
console.log('\nSemua transaksi berhasil dibersihkan dengan bersih!')

