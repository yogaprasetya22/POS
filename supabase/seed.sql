-- Data dummy WA-Order POS (2 toko demo). Katalog idempotent (ID tetap); pesanan contoh bertambah setiap seed dijalankan.
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

-- Gambar: Unsplash (lisensi bebas pakai), di-hotlink lewat CDN images.unsplash.com
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

-- ===== Pesanan contoh (lewat create_order: harga & kode antrean dihitung server, per toko) =====
do $$
declare s1 uuid := (select id from stores where slug = 'warkop-nusantara'); s2 uuid := (select id from stores where slug = 'bakso-mas-joko'); o jsonb;
begin
  -- Toko 1: belum bayar → tampil di Kasir
  perform create_order(s1, 'Budi', 'DINE_IN', '5',
    '[{"product_id":"22222222-2222-4222-8222-000000000001","qty":2,"choices":[{"group":"Level Pedas","option":"Pedas"},{"group":"Tambahan","option":"Telur ceplok"}],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000011","qty":2,"choices":[{"group":"Gula","option":"Normal"}],"note":""}]');
  perform create_order(s1, 'Sari', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000010","qty":1,"choices":[{"group":"Suhu","option":"Es"},{"group":"Gula","option":"Less sugar"}],"note":"es sedikit"}]');

  -- Toko 1: sedang dimasak → tampil di Dapur
  o := create_order(s1, 'Andi', 'DINE_IN', '2',
    '[{"product_id":"22222222-2222-4222-8222-000000000006","qty":1,"choices":[{"group":"Tambahan","option":"Extra keju"}],"note":"tanpa bawang"},
      {"product_id":"22222222-2222-4222-8222-000000000012","qty":1,"choices":[],"note":""}]');
  update orders set status = 'IN_KITCHEN', paid_at = now(), payment_method = 'QRIS_STATIC' where id = (o->>'id')::uuid;

  -- Toko 1: siap diambil
  o := create_order(s1, 'Rina', 'TAKEAWAY', null,
    '[{"product_id":"22222222-2222-4222-8222-000000000003","qty":1,"choices":[],"note":""}]');
  update orders set status = 'READY', paid_at = now(), payment_method = 'EDC_CARD' where id = (o->>'id')::uuid;

  -- Toko 1: selesai → masuk laporan penjualan
  o := create_order(s1, 'Dewi', 'DINE_IN', '7',
    '[{"product_id":"22222222-2222-4222-8222-000000000007","qty":1,"choices":[],"note":""},
      {"product_id":"22222222-2222-4222-8222-000000000013","qty":3,"choices":[],"note":""}]');
  update orders set status = 'COMPLETED', paid_at = now(), payment_method = 'CASH', cash_received = 100000 where id = (o->>'id')::uuid;

  -- Toko 2: untuk mengetes isolasi data (kode antrean juga mulai dari A-001 sendiri)
  perform create_order(s2, 'Joko', 'DINE_IN', '1',
    '[{"product_id":"33333333-3333-4333-8333-000000000001","qty":2,"choices":[{"group":"Tambahan","option":"Pangsit goreng"}],"note":""},
      {"product_id":"33333333-3333-4333-8333-000000000005","qty":2,"choices":[],"note":""}]');
  o := create_order(s2, 'Tini', 'TAKEAWAY', null,
    '[{"product_id":"33333333-3333-4333-8333-000000000002","qty":1,"choices":[],"note":""}]');
  update orders set status = 'COMPLETED', paid_at = now(), payment_method = 'CASH', cash_received = 50000 where id = (o->>'id')::uuid;
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
