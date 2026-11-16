-- Data contoh 90 hari terakhir untuk toko demo (warkop-nusantara): pesanan, shift Pagi/Sore, kas, dan riwayat bahan.
-- Dibuat langsung di database (bukan lewat simulasi kasir), supaya:
--   * jam penjualan realistis: ramai makan siang (11–13) dan makan malam (18–20), akhir pekan lebih ramai, tren naik pelan
--   * stok bahan saat ini tidak habis (riwayat SALE dicatat, tetapi stok tidak dipotong)
-- Aman diulang: transaksi toko demo 90 hari terakhir dihapus dulu, lalu dibuat ulang (setseed → hasil sama).
-- Angka mengikuti aturan aplikasi: total = calc_charges(), kas seharusnya = shift_totals(), modal shift = uang serah terima.

-- Tutup satu shift seperti kasir: setoran/receh dulu, lalu hitung uang (kadang selisih), simpan, kembalikan uang yang diserahkan.
create or replace function pg_temp.sim_close(p_shift uuid, p_end timestamptz, p_reviewer uuid, p_old boolean) returns int
language plpgsql as $$
declare sh shifts; t record; diff int; r numeric;
begin
  select * into sh from shifts where id = p_shift;
  if random() < 0.15 then
    insert into cash_movements (shift_id, store_id, kind, amount, reason, user_id, created_at)
      values (sh.id, sh.store_id, 'IN', 50000, 'Tambah uang receh', sh.opened_by, sh.opened_at + interval '20 minutes');
  end if;
  select * into t from shift_totals(sh.id);
  if t.cash_sales > 100000 and random() < 0.75 then
    insert into cash_movements (shift_id, store_id, kind, amount, reason, user_id, created_at)
      values (sh.id, sh.store_id, 'OUT', (floor(t.cash_sales * 0.7 / 10000) * 10000)::int, 'Setoran ke owner', sh.opened_by, p_end - interval '30 minutes');
  end if;
  select * into t from shift_totals(sh.id);
  r := random();
  diff := case when r < 0.86 then 0 when r < 0.95 then -(1 + floor(random() * 5))::int * 2000 else (1 + floor(random() * 4))::int * 1000 end;
  update shifts set closed_at = p_end, closed_by = sh.opened_by, expected_cash = t.expected, counted_cash = t.expected + diff, difference = diff,
      note = case when diff < 0 then 'Uang kurang, sedang dicari' when diff > 0 then 'Kembalian kurang diberikan' else '' end,
      reviewed_by = case when diff <> 0 and p_old then p_reviewer end,
      reviewed_at = case when diff <> 0 and p_old then p_end + interval '1 day' end,
      review_note = case when diff <> 0 and p_old then 'Sudah dicek' else '' end
    where id = sh.id;
  return t.expected + diff;
end $$;

do $$
declare
  s uuid; today date := (now() at time zone 'Asia/Jakarta')::date; d0 date := today - 89; d0_ts timestamptz;
  u_kasir uuid; u_mgr uuid; sn_pagi uuid; sn_sore uuid;
  prods jsonb; tables text[];
  names text[] := array['Budi','Sari','Andi','Dewi','Rizky','Putri','Agus','Nadia','Fajar','Rina','Dimas','Maya','Joko','Lina','Tono','Wati','Yoga','Indah','Bayu','Citra'];
  hw numeric[] := array[1, 2, 1.5, 1.5, 3.5, 5, 4.5, 2, 2, 2.5, 3.5, 4.5, 5, 3, 1.5]; -- bobot pesanan per jam, 07..21
  d date; k int; dow int; factor numeric; n int; h int; t_at timestamptz; q int; is_today boolean;
  sh_pagi uuid; sh_sore uuid; sh uuid; carry int; pagi_end timestamptz; sore_end timestamptz;
  lines jsonb; li int; p jsonb; qty int; sub int; c record; method payment_method; st order_status; oid uuid; recv int; r numeric;
begin
  perform setseed(0.20261116);
  select id into s from stores where slug = 'warkop-nusantara';
  if s is null then raise notice 'Toko demo tidak ditemukan, dilewati'; return; end if;
  d0_ts := d0::timestamp at time zone 'Asia/Jakarta';
  select user_id into u_kasir from profiles where store_id = s and role = 'cashier' limit 1;
  select user_id into u_mgr from profiles where store_id = s and role = 'manager' limit 1;
  if u_kasir is null or u_mgr is null then raise exception 'Butuh akun kasir & manager di toko demo (jalankan make seed)'; end if;

  insert into shift_names (store_id, name, sort_order) select s, x.n, x.o from (values ('Pagi', 0), ('Sore', 1)) x(n, o)
    where not exists (select 1 from shift_names where store_id = s and lower(name) = lower(x.n));
  update shift_names set is_active = true where store_id = s and lower(name) in ('pagi', 'sore');
  select id into sn_pagi from shift_names where store_id = s and lower(name) = 'pagi';
  select id into sn_sore from shift_names where store_id = s and lower(name) = 'sore';

  -- ===== 1. hapus transaksi 90 hari terakhir (kembalikan stok & poin dari transaksi lama) =====
  create temp table _o on commit drop as select id from orders where store_id = s and business_day >= d0;
  create temp table _s on commit drop as select id from shifts where store_id = s and opened_at >= d0_ts;
  update ingredients i set stock = i.stock - x.v from (select ingredient_id, sum(delta) v from stock_movements where order_id in (select id from _o) group by 1) x where i.id = x.ingredient_id;
  update members mm set points = greatest(0, mm.points - x.p) from (select member_id, sum(delta) p from point_ledger where order_id in (select id from _o) group by 1) x where mm.id = x.member_id;
  update vouchers set redeemed_at = null, redeemed_order_id = null where redeemed_order_id in (select id from _o);
  delete from point_ledger where order_id in (select id from _o);
  delete from stock_movements where order_id in (select id from _o);
  update orders set reversal_shift_id = null where reversal_shift_id in (select id from _s);
  delete from orders where id in (select id from _o);
  update purchases set shift_id = null where shift_id in (select id from _s);
  update shifts set handover_from = null where handover_from in (select id from _s);
  delete from cash_movements where shift_id in (select id from _s);
  delete from shifts where id in (select id from _s);
  delete from daily_counters where store_id = s and day >= d0;
  -- laci yang masih terbuka dari sebelum rentang: tutup apa adanya
  update shifts set closed_at = opened_at + interval '8 hours', closed_by = opened_by, counted_cash = opening_cash, expected_cash = opening_cash, difference = 0
    where store_id = s and closed_at is null;
  carry := coalesce((select counted_cash from shifts where store_id = s and closed_at is not null order by closed_at desc limit 1), 300000);

  -- menu: menu populer muncul lebih sering (bobot 1..4)
  select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price, 'mods', modifiers, 'w', 1 + (abs(hashtext(name)) % 4)) order by sort) into prods from products where store_id = s;
  select array_agg(label order by label) into tables from store_tables where store_id = s and is_active;
  if prods is null then raise exception 'Toko demo belum punya menu (jalankan make seed)'; end if;

  -- ===== 2. tiap hari: shift Pagi (07.00–14.30, kasir) & Sore (14.30–22.00, manager) =====
  for k in 0..89 loop
    d := d0 + k;
    is_today := d = today;
    exit when is_today and now() < (d + time '07:00') at time zone 'Asia/Jakarta';
    dow := extract(isodow from d);
    factor := (case when dow in (6, 7) then 1.45 when dow = 5 then 1.2 when dow = 1 then 0.85 else 1 end) * (0.85 + k * 0.004) * (0.85 + random() * 0.3);
    pagi_end := (d + time '14:30') at time zone 'Asia/Jakarta';
    sore_end := (d + time '22:00') at time zone 'Asia/Jakarta';

    insert into shifts (store_id, opened_by, opened_at, opening_cash, opening_expected, handover_from, shift_name_id, shift_name)
      values (s, u_kasir, (d + time '07:00') at time zone 'Asia/Jakarta', carry, carry,
        (select id from shifts where store_id = s and closed_at is not null order by closed_at desc limit 1), sn_pagi, 'Pagi')
      returning id into sh_pagi;
    sh_sore := null;
    q := 0;

    for h in 7..21 loop
      n := round(hw[h - 6] * factor * (0.7 + random() * 0.6))::int;
      -- waktu pesanan dalam jam ini, diurutkan supaya pergantian shift tepat di 14.30
      for t_at in select (d + make_time(h, floor(random() * 60)::int, floor(random() * 60)::int)) at time zone 'Asia/Jakarta' as x from generate_series(1, n) order by 1 loop
        exit when is_today and t_at > now() - interval '3 minutes';
        if t_at >= pagi_end and sh_sore is null then
          carry := pg_temp.sim_close(sh_pagi, pagi_end, u_mgr, d < today - 3);
          insert into shifts (store_id, opened_by, opened_at, opening_cash, opening_expected, handover_from, shift_name_id, shift_name)
            values (s, u_mgr, pagi_end, carry, carry, sh_pagi, sn_sore, 'Sore') returning id into sh_sore;
        end if;
        sh := coalesce(sh_sore, sh_pagi);

        -- isi pesanan: 1–3 menu, kebanyakan 1 porsi
        lines := '[]'; sub := 0;
        for li in 1..(1 + floor(random() * 3))::int loop
          select e into p from jsonb_array_elements(prods) e order by random() * (e->>'w')::int desc limit 1;
          qty := case when random() < 0.8 then 1 else 2 end;
          lines := lines || jsonb_build_object('product_id', p->>'id', 'name', p->>'name', 'qty', qty, 'unit_price', (p->>'price')::int, 'subtotal', qty * (p->>'price')::int,
            'choices', coalesce((select jsonb_agg(jsonb_build_object('group', g->>'name', 'option', g->'options'->0->>'name', 'price', 0)) from jsonb_array_elements(p->'mods') g where (g->>'required')::boolean), '[]'), 'note', '');
          sub := sub + qty * (p->>'price')::int;
        end loop;
        select * into c from calc_charges(s, sub);
        r := random();
        method := case when r < 0.6 then 'CASH' when r < 0.9 then 'QRIS_STATIC' else 'EDC_CARD' end;
        r := random();
        st := case when r < 0.03 then 'CANCELLED' when r < 0.05 then 'VOID' when r < 0.06 then 'REFUNDED'
                   when is_today and t_at > now() - interval '25 minutes' then 'IN_KITCHEN' else 'COMPLETED' end;
        recv := case when method = 'CASH' then (case when random() < 0.4 then c.total else ceil(c.total / 5000.0)::int * 5000 + (case when random() < 0.3 then 5000 else 0 end) end) end;
        q := q + 1;
        insert into orders (store_id, queue_code, business_day, customer_name, order_type, items, subtotal, service_amount, tax_amount, rounding_amount, total,
            status, payment_method, cash_received, created_at, paid_at, shift_id, paid_by, created_by, void_reason, voided_at, voided_by, reversal_shift_id)
          values (s, 'A-' || lpad(q::text, 3, '0'), d, names[1 + floor(random() * array_length(names, 1))::int],
            case when tables is not null and random() < 0.55 then 'DINE_IN'::order_type else 'TAKEAWAY'::order_type end, lines, sub, c.service, c.tax, c.rounding, c.total,
            st, case when st = 'CANCELLED' then null else method end, case when st = 'CANCELLED' then null else recv end,
            t_at - interval '2 minutes', case when st = 'CANCELLED' then null else t_at end,
            case when st = 'CANCELLED' then null else sh end,
            case when st = 'CANCELLED' then null when sh = sh_pagi then u_kasir else u_mgr end,
            case when random() < 0.35 then (case when sh = sh_pagi then u_kasir else u_mgr end) end,
            case st when 'VOID' then 'Salah input menu' when 'REFUNDED' then 'Pelanggan komplain' end,
            case when st in ('VOID', 'REFUNDED') then t_at + interval '5 minutes' end,
            case when st in ('VOID', 'REFUNDED') then u_mgr end,
            case when st in ('VOID', 'REFUNDED') then sh end)
          returning id into oid;
        update orders set table_no = tables[1 + floor(random() * array_length(tables, 1))::int] where id = oid and order_type = 'DINE_IN';
      end loop;
    end loop;

    -- hari tanpa penjualan setelah 14.30 tetap berganti shift
    if sh_sore is null and (not is_today or now() >= pagi_end) then
      carry := pg_temp.sim_close(sh_pagi, pagi_end, u_mgr, d < today - 3);
      insert into shifts (store_id, opened_by, opened_at, opening_cash, opening_expected, handover_from, shift_name_id, shift_name)
        values (s, u_mgr, pagi_end, carry, carry, sh_pagi, sn_sore, 'Sore') returning id into sh_sore;
    end if;
    -- tutup shift Sore; hari ini dibiarkan terbuka sampai 22.00 (seperti kasir yang masih bertugas)
    if sh_sore is not null and not (is_today and now() < sore_end) then
      carry := pg_temp.sim_close(sh_sore, sore_end, u_mgr, d < today - 3);
    end if;

    insert into daily_counters (store_id, day, n) values (s, d, q) on conflict (store_id, day) do update set n = excluded.n;
  end loop;

  -- ===== 3. riwayat bahan dari resep (stok saat ini tidak diubah) =====
  insert into stock_movements (store_id, ingredient_id, delta, reason, note, order_id, user_id, created_at)
    select s, rc.ingredient_id, -(rc.qty * (it->>'qty')::int), 'SALE', 'Terjual ' || o.queue_code, o.id, o.paid_by, o.paid_at
    from orders o cross join jsonb_array_elements(o.items) it join recipes rc on rc.product_id = (it->>'product_id')::uuid
    where o.store_id = s and o.business_day >= d0 and o.paid_at is not null;
  insert into stock_movements (store_id, ingredient_id, delta, reason, note, order_id, user_id, created_at)
    select s, rc.ingredient_id, rc.qty * (it->>'qty')::int, 'VOID', 'Batal ' || o.queue_code, o.id, o.voided_by, o.voided_at
    from orders o cross join jsonb_array_elements(o.items) it join recipes rc on rc.product_id = (it->>'product_id')::uuid
    where o.store_id = s and o.business_day >= d0 and o.status in ('VOID', 'REFUNDED');

  raise notice 'Selesai: % pesanan, % shift', (select count(*) from orders where store_id = s and business_day >= d0), (select count(*) from shifts where store_id = s and opened_at >= d0_ts);
end $$;

-- Deskripsi menu demo (hanya mengisi yang masih kosong)
update products p set description = d.txt
from (values
  ('Nasi Goreng Spesial', 'Nasi goreng dengan telur, ayam suwir, dan sayuran. Bisa pilih level pedas.'),
  ('Cafe Latte', 'Espresso dengan susu segar, bisa panas atau es.'),
  ('Kentang Goreng', 'Kentang renyah dengan pilihan saus keju atau mayones.'),
  ('Mie Goreng Jawa', 'Mie telur dimasak kecap manis, telur, dan sayuran.'),
  ('Es Teh Lemon', 'Teh segar dengan perasan lemon asli, manisnya pas.'),
  ('Donat Glaze', 'Donat lembut dengan lapisan gula manis, dibuat setiap pagi.'),
  ('Ramen Telur Udang', 'Kuah kaldu gurih, mie ramen, udang, dan telur setengah matang.'),
  ('Cookies Coklat', 'Kue kering renyah dengan potongan cokelat leleh.'),
  ('Mie Kuah Ayam', 'Mie kuah hangat dengan ayam suwir dan sayuran segar.'),
  ('Chocolate Parfait', 'Lapisan krim, cokelat, dan remahan biskuit dalam gelas.'),
  ('Iga Bakar Madu', 'Iga sapi empuk dibakar dengan saus madu.'),
  ('Burger Sapi Keju', 'Daging sapi panggang, keju leleh, dan sayuran segar.'),
  ('Pizza Personal', 'Pizza ukuran pas untuk satu orang dengan mozzarella.'),
  ('Penne Bolognese', 'Pasta penne dengan saus daging tomat khas Italia.'),
  ('Rice Bowl Salmon', 'Nasi hangat, salmon panggang, dan sayuran segar.')
) d(name, txt)
where p.name = d.name and p.description = '' and p.store_id = (select id from stores where slug = 'warkop-nusantara');
