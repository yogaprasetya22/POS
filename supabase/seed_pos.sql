-- Data demo untuk fitur POS inti (role baru, meja, member, voucher, stok, PIN). Aman dijalankan berulang.
-- Jangan dijalankan di database produksi.
--   manager@pos.test / manager12345  → manager Warung Kopi Nusantara
--   dapur@pos.test   / dapur12345    → staf dapur
--   pelayan@pos.test / pelayan12345  → pelayan
-- PIN supervisor demo Warung Kopi Nusantara: 1234

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
  ('manager@pos.test', 'manager12345'), ('dapur@pos.test', 'dapur12345'), ('pelayan@pos.test', 'pelayan12345')
) v(email, pass)
where not exists (select 1 from auth.users u where u.email = v.email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email in ('manager@pos.test', 'dapur@pos.test', 'pelayan@pos.test')
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

update profiles p set
  store_id = (select id from stores where slug = 'warkop-nusantara'),
  role = (case u.email when 'manager@pos.test' then 'manager' when 'dapur@pos.test' then 'kitchen' else 'waiter' end)::staff_role
from auth.users u
where u.id = p.user_id and u.email in ('manager@pos.test', 'dapur@pos.test', 'pelayan@pos.test');

update auth.users set
  confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''), email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''), phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, '')
where email in ('manager@pos.test', 'dapur@pos.test', 'pelayan@pos.test');

do $$
declare w uuid := (select id from stores where slug = 'warkop-nusantara');
        b uuid := (select id from stores where slug = 'bakso-mas-joko');
begin
  -- Pengaturan: Warkop memakai poin loyalti; Bakso Mas Joko memakai PB1 10% + pembulatan Rp100
  update stores set points_earn_per = 10000, points_value = 100,
      address = 'Jl. Contoh No. 1, Jakarta', receipt_footer = 'Terima kasih, sampai jumpa lagi!'
    where id = w;
  update stores set tax_bp = 1000, rounding_to = 100, address = 'Jl. Contoh No. 2, Jakarta' where id = b;

  insert into store_secrets (store_id, supervisor_pin_hash)
    values (w, extensions.crypt('1234', extensions.gen_salt('bf')))
    on conflict (store_id) do nothing;

  insert into store_tables (store_id, label, sort)
    select w, 'T' || n, n from generate_series(1, 8) n
    on conflict do nothing;

  insert into members (store_id, phone, name, points, visits, total_spent) values
    (w, '6281200000001', 'Budi Santoso', 120, 6, 480000),
    (w, '6281200000002', 'Citra Dewi', 30, 2, 90000),
    (w, '6281200000003', 'Dimas Prakoso', 0, 0, 0)
    on conflict do nothing;

  insert into vouchers (store_id, code, kind, value, expires_at, note) values
    (w, 'WELCOME10', 'PERCENT', 10, now() + interval '90 days', 'Diskon 10% pelanggan baru'),
    (w, 'HEMAT5K', 'AMOUNT', 5000, now() + interval '90 days', 'Potongan Rp5.000')
    on conflict do nothing;

  insert into ingredients (store_id, name, unit, stock, min_stock, cost) values
    (w, 'Biji kopi', 'gram', 5000, 1000, 0.25),
    (w, 'Susu', 'ml', 12000, 3000, 0.02),
    (w, 'Gula aren', 'gram', 3000, 500, 0.03),
    (w, 'Beras', 'gram', 20000, 5000, 0.015),
    (w, 'Telur', 'pcs', 60, 20, 2200)
    on conflict do nothing;

  insert into recipes (product_id, ingredient_id, store_id, qty)
    select p.id, i.id, w, r.qty
    from (values
      ('Cafe Latte', 'Biji kopi', 18), ('Cafe Latte', 'Susu', 150),
      ('Nasi Goreng Spesial', 'Beras', 200), ('Nasi Goreng Spesial', 'Telur', 1)
    ) r(product, ingredient, qty)
    join products p on p.store_id = w and p.name = r.product
    join ingredients i on i.store_id = w and i.name = r.ingredient
    on conflict do nothing;
end $$;
