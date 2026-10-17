-- Data dummy WA-Order POS (2 toko demo).
-- Menyediakan data lengkap: katalog menu, promo & diskon, serta transaksi komprehensif
-- (UNPAID, IN_KITCHEN, READY, COMPLETED, CANCELLED, EXPIRED) lintas tanggal (hari ini, kemarin, minggu ini).

-- ===== Toko Demo =====
insert into stores (slug, name, wa_number) values
  ('warkop-nusantara', 'Warung Kopi Nusantara', '6281234567890'),
  ('bakso-mas-joko', 'Bakso Mas Joko', '6289876543210')
on conflict (slug) do update set name = excluded.name;

-- ===== Toko 1: Warung Kopi Nusantara =====
insert into categories (id, store_id, name, sort) values
  ('11111111-1111-4111-8111-000000000001', (select id from stores where slug = 'warkop-nusantara'), 'Makanan', 0),
  ('11111111-1111-4111-8111-000000000002', (select id from stores where slug = 'warkop-nusantara'), 'Minuman', 1),
  ('11111111-1111-4111-8111-000000000003', (select id from stores where slug = 'warkop-nusantara'), 'Camilan & Dessert', 2)
on conflict (id) do update set store_id = excluded.store_id, name = excluded.name, sort = excluded.sort;

-- Gambar produk via Unsplash CDN
insert into products (id, store_id, category_id, name, sku, price, is_available, modifiers, image_url, sort)
select v.id::uuid, (select id from stores where slug = 'warkop-nusantara'), v.cat::uuid, v.name, v.sku, v.price, v.avail, v.mods::jsonb, v.img, v.sort
from (values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Nasi Goreng Spesial', 'MKN-001', 25000, true,
   '[{"name":"Level Pedas","required":true,"multiple":false,"options":[{"name":"Tidak pedas","price":0},{"name":"Sedang","price":0},{"name":"Pedas","price":0}]},
     {"name":"Tambahan","required":false,"multiple":true,"options":[{"name":"Telur ceplok","price":4000},{"name":"Kerupuk","price":2000}]}]',
   'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=70', 0),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 'Mie Goreng Jawa', 'MKN-002', 23000, true,
   '[{"name":"Level Pedas","required":true,"multiple":false,"options":[{"name":"Tidak pedas","price":0},{"name":"Pedas","price":0}]}]',
   'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&q=70', 1),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000001', 'Ramen Telur Udang', 'MKN-003', 35000, true, '[]',
   'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=70', 2),
  ('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-000000000001', 'Mie Kuah Ayam', 'MKN-004', 28000, true, '[]',
   'https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&q=70', 3),
  ('22222222-2222-4222-8222-000000000005', '11111111-1111-4111-8111-000000000001', 'Iga Bakar Madu', 'MKN-005', 55000, false, '[]',
   'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=70', 4),
  ('22222222-2222-4222-8222-000000000006', '11111111-1111-4111-8111-000000000001', 'Burger Sapi Keju', 'MKN-006', 38000, true,
   '[{"name":"Tambahan","required":false,"multiple":true,"options":[{"name":"Extra keju","price":5000},{"name":"Extra patty","price":15000}]}]',
   'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=70', 5),
  ('22222222-2222-4222-8222-000000000007', '11111111-1111-4111-8111-000000000001', 'Pizza Personal', 'MKN-007', 45000, true, '[]',
   'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=70', 6),
  ('22222222-2222-4222-8222-000000000008', '11111111-1111-4111-8111-000000000001', 'Penne Bolognese', 'MKN-008', 32000, true, '[]',
   'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=70', 7),
  ('22222222-2222-4222-8222-000000000009', '11111111-1111-4111-8111-000000000001', 'Rice Bowl Salmon', 'MKN-009', 42000, true, '[]',
   'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=70', 8),
  ('22222222-2222-4222-8222-000000000010', '11111111-1111-4111-8111-000000000002', 'Cafe Latte', 'MNM-001', 22000, true,
   '[{"name":"Suhu","required":true,"multiple":false,"options":[{"name":"Es","price":0},{"name":"Panas","price":0}]},
     {"name":"Gula","required":true,"multiple":false,"options":[{"name":"Normal","price":0},{"name":"Less sugar","price":0},{"name":"Tanpa gula","price":0}]},
     {"name":"Tambahan","required":false,"multiple":true,"options":[{"name":"Extra shot","price":5000},{"name":"Oat milk","price":6000}]}]',
   'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=70', 0),
  ('22222222-2222-4222-8222-000000000011', '11111111-1111-4111-8111-000000000002', 'Es Teh Lemon', 'MNM-002', 10000, true,
   '[{"name":"Gula","required":true,"multiple":false,"options":[{"name":"Normal","price":0},{"name":"Less sugar","price":0}]}]',
   'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=70', 1),
  ('22222222-2222-4222-8222-000000000012', '11111111-1111-4111-8111-000000000003', 'Kentang Goreng', 'CML-001', 18000, true,
   '[{"name":"Saus","required":false,"multiple":true,"options":[{"name":"Saus keju","price":3000},{"name":"Mayones","price":2000}]}]',
   'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=70', 0),
  ('22222222-2222-4222-8222-000000000013', '11111111-1111-4111-8111-000000000003', 'Donat Glaze', 'CML-002', 12000, true, '[]',
   'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=70', 1),
  ('22222222-2222-4222-8222-000000000014', '11111111-1111-4111-8111-000000000003', 'Cookies Coklat', 'CML-003', 15000, true, '[]',
   'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=70', 2),
  ('22222222-2222-4222-8222-000000000015', '11111111-1111-4111-8111-000000000003', 'Chocolate Parfait', 'CML-004', 27000, true, '[]',
   'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=70', 3)
) as v(id, cat, name, sku, price, avail, mods, img, sort)
on conflict (id) do update set
  store_id = excluded.store_id, category_id = excluded.category_id, name = excluded.name, sku = excluded.sku, price = excluded.price,
  is_available = excluded.is_available, modifiers = excluded.modifiers, image_url = excluded.image_url, sort = excluded.sort;

-- ===== Toko 2: Bakso Mas Joko =====
insert into categories (id, store_id, name, sort) values
  ('44444444-4444-4444-8444-000000000001', (select id from stores where slug = 'bakso-mas-joko'), 'Bakso & Mie', 0),
  ('44444444-4444-4444-8444-000000000002', (select id from stores where slug = 'bakso-mas-joko'), 'Minuman', 1)
on conflict (id) do update set store_id = excluded.store_id, name = excluded.name, sort = excluded.sort;

insert into products (id, store_id, category_id, name, sku, price, is_available, modifiers, image_url, sort)
select v.id::uuid, (select id from stores where slug = 'bakso-mas-joko'), v.cat::uuid, v.name, v.sku, v.price, v.avail, v.mods::jsonb, v.img, v.sort
from (values
  ('33333333-3333-4333-8333-000000000001', '44444444-4444-4444-8444-000000000001', 'Bakso Urat Spesial', 'BKS-001', 25000, true,
   '[{"name":"Tambahan","required":false,"multiple":true,"options":[{"name":"Bakso urat","price":5000},{"name":"Pangsit goreng","price":3000}]}]',
   'https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&q=70', 0),
  ('33333333-3333-4333-8333-000000000002', '44444444-4444-4444-8444-000000000001', 'Mie Goreng Bakso', 'BKS-002', 22000, true, '[]',
   'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&q=70', 1),
  ('33333333-3333-4333-8333-000000000003', '44444444-4444-4444-8444-000000000001', 'Nasi Goreng Kampung', 'BKS-003', 20000, true, '[]',
   'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=70', 2),
  ('33333333-3333-4333-8333-000000000004', '44444444-4444-4444-8444-000000000001', 'Kentang Goreng', 'BKS-004', 12000, true, '[]',
   'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=70', 3),
  ('33333333-3333-4333-8333-000000000005', '44444444-4444-4444-8444-000000000002', 'Es Teh Manis', 'BKM-001', 6000, true, '[]',
   'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=70', 0),
  ('33333333-3333-4333-8333-000000000006', '44444444-4444-4444-8444-000000000002', 'Kopi Susu', 'BKM-002', 15000, true, '[]',
   'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=70', 1)
) as v(id, cat, name, sku, price, avail, mods, img, sort)
on conflict (id) do update set
  store_id = excluded.store_id, category_id = excluded.category_id, name = excluded.name, sku = excluded.sku, price = excluded.price,
  is_available = excluded.is_available, modifiers = excluded.modifiers, image_url = excluded.image_url, sort = excluded.sort;

-- ===== Data Promo & Diskon =====
do $$
declare
  s1 uuid := (select id from stores where slug = 'warkop-nusantara');
begin
  delete from promotions where store_id = s1;

  insert into promotions (store_id, name, type, scope, target_id, discount_percent, discount_amount, min_spend, code, is_active)
  values
    (s1, 'Diskon Spesial 10%', 'PERCENTAGE', 'CART_TOTAL', null, 10, 0, 30000, 'DISKON10', true),
    (s1, 'Potongan Rp 5.000 Min 50rb', 'FIXED_AMOUNT', 'CART_TOTAL', null, 0, 5000, 50000, null, true),
    (s1, 'Diskon Latte 15%', 'PERCENTAGE', 'PRODUCT', '22222222-2222-4222-8222-000000000010'::uuid, 15, 0, 0, null, true),
    (s1, 'Beli 2 Donat Gratis 1', 'BUY_X_GET_Y', 'PRODUCT', '22222222-2222-4222-8222-000000000013'::uuid, 0, 0, 0, null, true);
end $$;

-- ===== Transaksi Dummy Komprehensif (Semua Status, Jenis, dan Rentang Waktu) =====
create or replace function pg_temp.seed_order(
  p_store_id uuid,
  p_customer_name text,
  p_order_type order_type,
  p_table_no text,
  p_lines jsonb,
  p_status order_status,
  p_payment_method payment_method default null,
  p_cash_received int default null,
  p_days_ago int default 0,
  p_hours_ago int default 0,
  p_discount int default 0,
  p_promo_name text default null,
  p_promo_code text default null
) returns uuid
language plpgsql as $$
declare
  d date := ((now() at time zone 'Asia/Jakarta') - (p_days_ago || ' days')::interval)::date;
  t_created timestamptz := (now() - (p_days_ago || ' days')::interval - (p_hours_ago || ' hours')::interval);
  t_paid timestamptz := case when p_status in ('IN_KITCHEN', 'READY', 'COMPLETED') then t_created + interval '2 minutes' else null end;
  seq int;
  order_id uuid := gen_random_uuid();
  calculated_items jsonb := '[]'::jsonb;
  sub_total int := 0;
  final_total int;
  l jsonb;
  prod record;
  qty int;
  c jsonb;
  opt jsonb;
  unit int;
  choices jsonb;
begin
  for l in select value from jsonb_array_elements(p_lines) loop
    select * into prod from products where id = (l->>'product_id')::uuid and store_id = p_store_id;
    if prod.id is null then
      raise exception 'product % not found in store %', l->>'product_id', p_store_id;
    end if;

    qty := greatest(1, coalesce((l->>'qty')::int, 1));
    unit := prod.price;
    choices := '[]'::jsonb;

    if l->'choices' is not null then
      for c in select value from jsonb_array_elements(l->'choices') loop
        select o.value into opt
        from jsonb_array_elements(prod.modifiers) grp,
             jsonb_array_elements(grp.value->'options') o
        where grp.value->>'name' = c->>'group' and o.value->>'name' = c->>'option';

        unit := unit + coalesce((opt->>'price')::int, 0);
        choices := choices || jsonb_build_object('group', c->>'group', 'option', c->>'option', 'price', coalesce((opt->>'price')::int, 0));
      end loop;
    end if;

    calculated_items := calculated_items || jsonb_build_object(
      'product_id', prod.id,
      'name', prod.name,
      'qty', qty,
      'unit_price', unit,
      'choices', choices,
      'note', left(coalesce(l->>'note', ''), 200),
      'subtotal', unit * qty
    );
    sub_total := sub_total + (unit * qty);
  end loop;

  final_total := greatest(0, sub_total - coalesce(p_discount, 0));

  insert into daily_counters as dc (store_id, day, n) values (p_store_id, d, 1)
    on conflict (store_id, day) do update set n = dc.n + 1
    returning dc.n into seq;

  insert into orders (
    id, store_id, queue_code, business_day, customer_name, order_type, table_no,
    items, total, status, payment_method, cash_received, discount_amount, promo_name, promo_code,
    created_at, paid_at
  ) values (
    order_id, p_store_id,
    'A-' || case when seq < 1000 then lpad(seq::text, 3, '0') else seq::text end,
    d, p_customer_name, p_order_type,
    case when p_order_type = 'DINE_IN' then left(btrim(p_table_no), 10) else null end,
    calculated_items, final_total, p_status, p_payment_method, p_cash_received,
    coalesce(p_discount, 0), p_promo_name, p_promo_code,
    t_created, t_paid
  );

  return order_id;
end;
$$;

do $$
declare
  s1 uuid := (select id from stores where slug = 'warkop-nusantara');
  s2 uuid := (select id from stores where slug = 'bakso-mas-joko');
begin
  -- Bersihkan pesanan lama agar seeder bersih, konsisten, dan idempotent
  delete from orders where store_id in (s1, s2);
  delete from daily_counters where store_id in (s1, s2);

  -- =========================================================================
  -- 1. HARI INI (TODAY): SEMUA STATUS AKTIF DI KASIR & DAPUR
  -- =========================================================================

  -- [UNPAID] Masuk di Antrean Kasir (Pesanan Pelanggan WA belum bayar)
  perform pg_temp.seed_order(s1, 'Budi Santoso', 'DINE_IN', '5',
    '[{"product_id":"22222222-2222-4222-8222-000000000001","qty":2,"choices":[{"group":"Level Pedas","option":"Pedas"},{"group":"Tambahan","option":"Telur ceplok"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":2,"choices":[{"group":"Gula","option":"Normal"}],"note":""}]',
    'UNPAID', null, null, 0, 1);

  perform pg_temp.seed_order(s1, 'Siti Sarah', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000010","qty":1,"choices":[{"group":"Suhu","option":"Es"},{"group":"Tambahan","option":"Oat milk"}],"note":"es sedikit"},
      {"product_id":"22222222-2222-4222-8222-000000000013","qty":2,"choices":[],"note":""}]',
    'UNPAID', null, null, 0, 1);

  perform pg_temp.seed_order(s1, 'Dimas Anggara', 'DINE_IN', '8',
    '[{"product_id":"22222222-2222-4222-8222-000000000006","qty":1,"choices":[{"group":"Tambahan","option":"Extra patty"}],"note":"tanpa selada"},
      {"product_id":"22222222-2222-4222-8222-000000000012","qty":1,"choices":[{"group":"Saus","option":"Saus keju"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000010","qty":1,"choices":[{"group":"Suhu","option":"Panas"},{"group":"Gula","option":"Normal"}],"note":""}]',
    'UNPAID', null, null, 0, 0);

  -- [IN_KITCHEN] Sedang Dimasak di Layar Dapur KDS
  perform pg_temp.seed_order(s1, 'Andi Wicaksono', 'DINE_IN', '2',
    '[{"product_id":"22222222-2222-4222-8222-000000000006","qty":1,"choices":[{"group":"Tambahan","option":"Extra keju"}],"note":"bawang bombay matang"},
      {"product_id":"22222222-2222-4222-8222-000000000012","qty":1,"choices":[],"note":""}]',
    'IN_KITCHEN', 'QRIS_STATIC', null, 0, 0);

  perform pg_temp.seed_order(s1, 'Nadia Putri', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000003","qty":1,"choices":[],"note":"kuah dipisah"},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":1,"choices":[{"group":"Gula","option":"Less sugar"}],"note":""}]',
    'IN_KITCHEN', 'CASH', 50000, 0, 0);

  perform pg_temp.seed_order(s1, 'Hendra Setiawan', 'DINE_IN', '1',
    '[{"product_id":"22222222-2222-4222-8222-000000000002","qty":2,"choices":[{"group":"Level Pedas","option":"Pedas"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000010","qty":2,"choices":[{"group":"Suhu","option":"Es"}],"note":""}]',
    'IN_KITCHEN', 'EDC_CARD', null, 0, 0);

  -- [READY] Siap Diambil di Dapur & Kasir
  perform pg_temp.seed_order(s1, 'Farhan Maulana', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000003","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000014","qty":2,"choices":[],"note":""}]',
    'READY', 'QRIS_STATIC', null, 0, 0);

  perform pg_temp.seed_order(s1, 'Aulia Rahma', 'DINE_IN', '4',
    '[{"product_id":"22222222-2222-4222-8222-000000000007","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":2,"choices":[{"group":"Gula","option":"Normal"}],"note":""}]',
    'READY', 'EDC_CARD', null, 0, 1);

  -- [COMPLETED Hari Ini] Masuk Omzet Dashboard & Laporan Hari Ini
  perform pg_temp.seed_order(s1, 'Dewi Lestari', 'DINE_IN', '7',
    '[{"product_id":"22222222-2222-4222-8222-000000000007","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000013","qty":3,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 100000, 0, 2, 5000, 'Potongan Rp 5.000 Min 50rb', null);

  perform pg_temp.seed_order(s1, 'Rian Ardiansyah', 'DINE_IN', '3',
    '[{"product_id":"22222222-2222-4222-8222-000000000001","qty":1,"choices":[{"group":"Level Pedas","option":"Sedang"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000004","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":2,"choices":[{"group":"Gula","option":"Normal"}],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 0, 3, 7300, 'Diskon Spesial 10%', 'DISKON10');

  perform pg_temp.seed_order(s1, 'Maya Anggraini', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000010","qty":2,"choices":[{"group":"Suhu","option":"Es"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000015","qty":1,"choices":[],"note":""}]',
    'COMPLETED', 'EDC_CARD', null, 0, 4, 6600, 'Diskon Latte 15%', null);

  perform pg_temp.seed_order(s1, 'Bambang Pamungkas', 'DINE_IN', '9',
    '[{"product_id":"22222222-2222-4222-8222-000000000008","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000012","qty":1,"choices":[{"group":"Saus","option":"Mayones"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":2,"choices":[{"group":"Gula","option":"Normal"}],"note":""}]',
    'COMPLETED', 'CASH', 150000, 0, 5, 0, null, null);

  perform pg_temp.seed_order(s1, 'Fajar Nugraha', 'DINE_IN', '10',
    '[{"product_id":"22222222-2222-4222-8222-000000000009","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000010","qty":1,"choices":[{"group":"Suhu","option":"Panas"}],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 0, 6, 0, null, null);

  perform pg_temp.seed_order(s1, 'Gita Gutawa', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000013","qty":3,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 50000, 0, 7, 12000, 'Beli 2 Donat Gratis 1', null);

  -- [CANCELLED] Pesanan Dibatalkan Pelanggan
  perform pg_temp.seed_order(s1, 'Gilang Ramadan', 'DINE_IN', '6',
    '[{"product_id":"22222222-2222-4222-8222-000000000001","qty":1,"choices":[],"note":"batal pesan"}]',
    'CANCELLED', null, null, 0, 1);

  -- [EXPIRED] Pesanan WA Melebihi Batas Waktu Bayar
  perform pg_temp.seed_order(s1, 'Pelanggan WA 0812', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000002","qty":1,"choices":[],"note":""}]',
    'EXPIRED', null, null, 0, 8);

  -- =========================================================================
  -- 2. KEMARIN (YESTERDAY / H-1): LAPORAN FILTER KEMARIN
  -- =========================================================================
  perform pg_temp.seed_order(s1, 'Dodi Pratama', 'DINE_IN', '3',
    '[{"product_id":"22222222-2222-4222-8222-000000000002","qty":2,"choices":[{"group":"Level Pedas","option":"Pedas"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 70000, 1, 2, 0, null, null);

  perform pg_temp.seed_order(s1, 'Siska Amelia', 'DINE_IN', '5',
    '[{"product_id":"22222222-2222-4222-8222-000000000007","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000010","qty":2,"choices":[{"group":"Suhu","option":"Es"}],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 1, 4, 13400, 'Diskon Spesial 10%', 'DISKON10');

  perform pg_temp.seed_order(s1, 'Taufik Hidayat', 'DINE_IN', '1',
    '[{"product_id":"22222222-2222-4222-8222-000000000006","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000012","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'EDC_CARD', null, 1, 5, 5000, 'Potongan Rp 5.000 Min 50rb', null);

  perform pg_temp.seed_order(s1, 'Ratna Sari', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000003","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 100000, 1, 6, 0, null, null);

  perform pg_temp.seed_order(s1, 'Eko Prasetyo', 'DINE_IN', '2',
    '[{"product_id":"22222222-2222-4222-8222-000000000001","qty":3,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":3,"choices":[],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 1, 7, 0, null, null);

  perform pg_temp.seed_order(s1, 'Lia Permata', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000015","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000014","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'EDC_CARD', null, 1, 8, 0, null, null);

  -- =========================================================================
  -- 3. H-2 S/D H-6 (MINGGU INI): GRAFIK TREN PENJUALAN 7 HARI
  -- =========================================================================
  -- H-2
  perform pg_temp.seed_order(s1, 'Wahyu Ramadhan', 'DINE_IN', '4',
    '[{"product_id":"22222222-2222-4222-8222-000000000009","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000010","qty":2,"choices":[{"group":"Suhu","option":"Es"}],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 2, 3, 12800, 'Diskon Spesial 10%', 'DISKON10');

  perform pg_temp.seed_order(s1, 'Indah Pratiwi', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000008","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000012","qty":1,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 50000, 2, 5, 0, null, null);

  perform pg_temp.seed_order(s1, 'Bagus Tri', 'DINE_IN', '6',
    '[{"product_id":"22222222-2222-4222-8222-000000000006","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000013","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'EDC_CARD', null, 2, 7, 0, null, null);

  -- H-3
  perform pg_temp.seed_order(s1, 'Panji Gumilang', 'DINE_IN', '1',
    '[{"product_id":"22222222-2222-4222-8222-000000000001","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000010","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 100000, 3, 2, 5000, 'Potongan Rp 5.000 Min 50rb', null);

  perform pg_temp.seed_order(s1, 'Rina Nose', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000004","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 3, 6, 0, null, null);

  -- H-4
  perform pg_temp.seed_order(s1, 'Lukman Hakim', 'DINE_IN', '8',
    '[{"product_id":"22222222-2222-4222-8222-000000000007","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000012","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'EDC_CARD', null, 4, 3, 12600, 'Diskon Spesial 10%', 'DISKON10');

  perform pg_temp.seed_order(s1, 'Siti Nurhaliza', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000002","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":1,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 40000, 4, 5, 0, null, null);

  -- H-5
  perform pg_temp.seed_order(s1, 'Agus Salim', 'DINE_IN', '2',
    '[{"product_id":"22222222-2222-4222-8222-000000000003","qty":2,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000015","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 5, 4, 5000, 'Potongan Rp 5.000 Min 50rb', null);

  -- H-6
  perform pg_temp.seed_order(s1, 'Rudi Hartono', 'DINE_IN', '5',
    '[{"product_id":"22222222-2222-4222-8222-000000000001","qty":3,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":3,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 120000, 6, 2, 0, null, null);

  perform pg_temp.seed_order(s1, 'Yuni Shara', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000013","qty":3,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000010","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'EDC_CARD', null, 6, 6, 12000, 'Beli 2 Donat Gratis 1', null);

  -- =========================================================================
  -- 4. TOKO 2: BAKSO MAS JOKO (ISOLASI DATA MULTI-TENANT)
  -- =========================================================================
  perform pg_temp.seed_order(s2, 'Joko Widodo', 'DINE_IN', '1',
    '[{"product_id":"33333333-3333-4333-8333-000000000001","qty":2,"choices":[{"group":"Tambahan","option":"Pangsit goreng"}],"note":""},
      {"product_id":"33333333-3333-4333-8333-000000000005","qty":2,"choices":[],"note":""}]',
    'COMPLETED', 'CASH', 100000, 0, 1, 0, null, null);

  perform pg_temp.seed_order(s2, 'Tini Martini', 'TAKEAWAY', null,
    '[{"product_id":"33333333-3333-4333-8333-000000000002","qty":1,"choices":[],"note":""},
      {"product_id":"33333333-3333-4333-8333-000000000005","qty":1,"choices":[],"note":""}]',
    'COMPLETED', 'QRIS_STATIC', null, 0, 2, 0, null, null);

  perform pg_temp.seed_order(s2, 'Agus Mulyono', 'DINE_IN', '3',
    '[{"product_id":"33333333-3333-4333-8333-000000000001","qty":2,"choices":[],"note":""}]',
    'IN_KITCHEN', 'QRIS_STATIC', null, 0, 0, 0, null, null);

  perform pg_temp.seed_order(s2, 'Siti Aminah', 'TAKEAWAY', null,
    '[{"product_id":"33333333-3333-4333-8333-000000000002","qty":1,"choices":[],"note":""}]',
    'UNPAID', null, null, 0, 0, 0, null, null);

end $$;

-- ===== Akun demo (password di-hash bcrypt, email langsung terkonfirmasi) =====
--   super@pos.test  / super12345  → super admin (kelola toko di /super)
--   admin@pos.test  / admin12345  → owner Warung Kopi Nusantara
--   kasir@pos.test  / kasir12345  → kasir Warung Kopi Nusantara
--   owner2@pos.test / owner212345 → owner Bakso Mas Joko
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v.email,
  extensions.crypt(v.pass, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('super@pos.test', 'super12345'), ('admin@pos.test', 'admin12345'),
  ('kasir@pos.test', 'kasir12345'), ('owner2@pos.test', 'owner212345')
) v(email, pass)
where not exists (select 1 from auth.users u where u.email = v.email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email in ('super@pos.test', 'admin@pos.test', 'kasir@pos.test', 'owner2@pos.test')
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- trigger handle_new_user sudah membuat baris profiles; tetapkan toko & perannya
update profiles p set
  store_id = case u.email
    when 'owner2@pos.test' then (select id from stores where slug = 'bakso-mas-joko')
    when 'super@pos.test' then null
    else (select id from stores where slug = 'warkop-nusantara') end,
  role = (case u.email when 'admin@pos.test' then 'owner' when 'owner2@pos.test' then 'owner' when 'kasir@pos.test' then 'cashier' else null end)::staff_role,
  is_super_admin = (u.email = 'super@pos.test')
from auth.users u
where u.id = p.user_id and u.email in ('super@pos.test', 'admin@pos.test', 'kasir@pos.test', 'owner2@pos.test');

-- GoTrue gagal login bila kolom token bernilai NULL; rapikan juga akun demo yang sudah ada dari seed sebelumnya
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''), email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''), phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, '')
where email in ('super@pos.test', 'admin@pos.test', 'kasir@pos.test', 'owner2@pos.test');
