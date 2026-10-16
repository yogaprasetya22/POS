-- Multi-tenant: satu database, setiap baris data milik satu toko (store_id), dijaga RLS.

create table stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  name text not null check (length(btrim(name)) > 0),
  wa_number text not null check (wa_number ~ '^62\d{8,13}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Toko awal = settings yang sudah ada; semua data lama pindah ke sini.
insert into stores (slug, name, wa_number) select 'warkop-nusantara', store_name, wa_number from settings;

alter table categories add column store_id uuid references stores;
alter table products add column store_id uuid references stores;
alter table daily_counters add column store_id uuid references stores;
alter table orders add column store_id uuid references stores;
update categories set store_id = (select id from stores where slug = 'warkop-nusantara');
update products set store_id = (select id from stores where slug = 'warkop-nusantara');
update daily_counters set store_id = (select id from stores where slug = 'warkop-nusantara');
update orders set store_id = (select id from stores where slug = 'warkop-nusantara');
alter table categories alter column store_id set not null;
alter table products alter column store_id set not null;
alter table daily_counters alter column store_id set not null;
alter table orders alter column store_id set not null;

-- Nomor antrean mulai dari awal per toko per hari
alter table daily_counters drop constraint daily_counters_pkey;
alter table daily_counters add primary key (store_id, day);
alter table orders drop constraint orders_business_day_queue_code_key;
alter table orders add unique (store_id, business_day, queue_code);
create index orders_store_status_idx on orders (store_id, status, created_at);
drop index orders_status_idx;
create index products_store_idx on products (store_id);
create index categories_store_idx on categories (store_id);

-- Staf terikat tepat ke satu toko. Super admin tidak punya toko/role (hanya mengelola toko).
alter table profiles add column store_id uuid references stores;
alter table profiles add column is_super_admin boolean not null default false;
update profiles set store_id = (select id from stores where slug = 'warkop-nusantara') where role is not null;
alter table profiles add constraint profiles_role_needs_store check (role is null or store_id is not null);
update profiles set is_super_admin = true where lower(email) = 'yogaagle123z@gmail.com';

drop policy if exists settings_read on settings;
drop policy if exists settings_owner on settings;
drop table settings;

-- ===== Helpers =====
create function my_store() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from profiles where user_id = auth.uid()
$$;

create function is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from profiles where user_id = auth.uid()), false)
$$;

-- User baru belum terikat toko; owner/super admin yang menghubungkannya.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, email) values (new.id, new.email);
  return new;
end $$;

-- ===== Pricing & order (semua sekarang per toko) =====
drop function create_order(text, order_type, text, jsonb);
drop function price_lines(jsonb);

-- Satu-satunya tempat harga dihitung. Produk harus milik toko yang sama.
create function price_lines(p_store uuid, p_lines jsonb, out items jsonb, out total int)
language plpgsql stable security definer set search_path = public as $$
declare
  l jsonb; c jsonb; g jsonb; opt jsonb; choices jsonb;
  p products; qty int; unit int; n int;
begin
  items := '[]'; total := 0;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then
    raise exception 'invalid lines';
  end if;
  for l in select value from jsonb_array_elements(p_lines) loop
    select * into p from products where id = (l->>'product_id')::uuid and store_id = p_store;
    if not found or not p.is_available then
      raise exception 'Menu tidak tersedia: %', coalesce(p.name, l->>'product_id');
    end if;
    qty := (l->>'qty')::int;
    if qty is null or qty not between 1 and 99 then raise exception 'invalid qty'; end if;

    unit := p.price; choices := '[]';
    for c in select value from jsonb_array_elements(coalesce(l->'choices', '[]')) loop
      select o.value into opt
        from jsonb_array_elements(p.modifiers) grp, jsonb_array_elements(grp.value->'options') o
        where grp.value->>'name' = c->>'group' and o.value->>'name' = c->>'option';
      if opt is null then raise exception 'invalid modifier: %', c; end if;
      unit := unit + (opt->>'price')::int;
      choices := choices || jsonb_build_object('group', c->>'group', 'option', c->>'option', 'price', (opt->>'price')::int);
    end loop;

    for g in select value from jsonb_array_elements(p.modifiers) loop
      select count(*) into n from jsonb_array_elements(choices) x where x->>'group' = g->>'name';
      if (coalesce((g->>'required')::boolean, false) and n = 0)
         or (not coalesce((g->>'multiple')::boolean, false) and n > 1) then
        raise exception 'Pilihan "%" tidak valid untuk %', g->>'name', p.name;
      end if;
    end loop;

    items := items || jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'qty', qty, 'unit_price', unit,
      'choices', choices, 'note', left(coalesce(l->>'note', ''), 200), 'subtotal', unit * qty);
    total := total + unit * qty;
  end loop;
end $$;

create function create_order(p_store_id uuid, p_customer_name text, p_order_type order_type, p_table_no text, p_lines jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Jakarta')::date;
  seq int; open_ boolean; priced record; r jsonb;
begin
  select is_active into open_ from stores where id = p_store_id;
  if open_ is null then raise exception 'Toko tidak ditemukan'; end if;
  if not open_ then raise exception 'Toko sedang tutup'; end if;

  p_customer_name := btrim(coalesce(p_customer_name, ''));
  if p_customer_name = '' or length(p_customer_name) > 40 then raise exception 'invalid name'; end if;
  if p_order_type = 'DINE_IN' and coalesce(btrim(p_table_no), '') = '' then raise exception 'table required'; end if;

  select * into priced from price_lines(p_store_id, p_lines);

  insert into daily_counters as dc (store_id, day, n) values (p_store_id, d, 1)
    on conflict (store_id, day) do update set n = dc.n + 1
    returning dc.n into seq;

  insert into orders (store_id, queue_code, business_day, customer_name, order_type, table_no, items, total)
  values (
    p_store_id,
    'A-' || case when seq < 1000 then lpad(seq::text, 3, '0') else seq::text end,
    d, p_customer_name, p_order_type,
    case when p_order_type = 'DINE_IN' then left(btrim(p_table_no), 10) end,
    priced.items, priced.total)
  returning jsonb_build_object('id', id, 'queue_code', queue_code, 'total', total) into r;
  return r;
end $$;

create or replace function update_order_lines(p_order_id uuid, p_lines jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare priced record;
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  select * into priced from price_lines(my_store(), p_lines);
  update orders set items = priced.items, total = priced.total
    where id = p_order_id and status = 'UNPAID' and store_id = my_store();
  if not found then raise exception 'Pesanan tidak bisa diubah'; end if;
end $$;

create or replace function pay_order(p_order_id uuid, p_method payment_method, p_cash_received int) returns orders
language plpgsql volatile security definer set search_path = public as $$
declare o orders;
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  update orders set
      status = 'IN_KITCHEN', paid_at = now(), payment_method = p_method,
      cash_received = case when p_method = 'CASH' then p_cash_received end
    where id = p_order_id and status = 'UNPAID' and store_id = my_store()
      and (p_method <> 'CASH' or coalesce(p_cash_received, 0) >= total)
    returning * into o;
  if o.id is null then raise exception 'Pembayaran gagal (sudah dibayar, dibatalkan, atau uang kurang)'; end if;
  return o;
end $$;

create or replace function advance_order(p_order_id uuid, p_to order_status) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  update orders set status = p_to
    where id = p_order_id and store_id = my_store()
      and status::text || '>' || p_to::text in ('UNPAID>CANCELLED', 'IN_KITCHEN>READY', 'READY>COMPLETED');
  if not found then raise exception 'Perubahan status tidak valid'; end if;
end $$;

create or replace function expire_stale_orders() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  update orders set status = 'CANCELLED'
    where status = 'UNPAID' and created_at < now() - interval '45 minutes' and store_id = my_store();
end $$;

-- ===== Staf (owner, hanya tokonya sendiri) =====
create function add_staff(p_email text, p_role staff_role) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_role is null then raise exception 'role wajib diisi'; end if;
  update profiles set store_id = my_store(), role = p_role
    where lower(email) = lower(btrim(p_email)) and store_id is null and not is_super_admin;
  if not found then raise exception 'Email belum terdaftar atau sudah terikat ke toko lain'; end if;
end $$;

-- p_role null = keluarkan dari toko
create function set_staff_role(p_user_id uuid, p_role staff_role) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'Tidak bisa mengubah akun sendiri'; end if;
  update profiles set role = p_role, store_id = case when p_role is null then null else store_id end
    where user_id = p_user_id and store_id = my_store();
  if not found then raise exception 'Staf tidak ditemukan'; end if;
end $$;

-- ===== Super admin =====
create function save_store(p_id uuid, p_slug text, p_name text, p_wa text, p_active boolean) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare r uuid;
begin
  if not is_super() then raise exception 'forbidden'; end if;
  if p_id is null then
    insert into stores (slug, name, wa_number, is_active)
      values (lower(btrim(p_slug)), btrim(p_name), p_wa, coalesce(p_active, true)) returning id into r;
  else
    update stores set slug = lower(btrim(p_slug)), name = btrim(p_name), wa_number = p_wa, is_active = coalesce(p_active, true)
      where id = p_id returning id into r;
    if r is null then raise exception 'Toko tidak ditemukan'; end if;
  end if;
  return r;
end $$;

create function assign_owner(p_store_id uuid, p_email text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'forbidden'; end if;
  update profiles set store_id = p_store_id, role = 'owner'
    where lower(email) = lower(btrim(p_email)) and (store_id is null or store_id = p_store_id);
  if not found then raise exception 'Email belum terdaftar atau sudah terikat ke toko lain'; end if;
end $$;

-- Super admin tidak membaca tabel orders; hanya ringkasan omzet hari ini lewat fungsi ini.
create function list_stores_with_sales()
returns table (id uuid, slug text, name text, wa_number text, is_active boolean, owner_emails text, orders_today bigint, sales_today bigint)
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not is_super() then raise exception 'forbidden'; end if;
  return query
    select s.id, s.slug, s.name, s.wa_number, s.is_active,
      (select string_agg(p.email, ', ') from profiles p where p.store_id = s.id and p.role = 'owner'),
      (select count(*) from orders o where o.store_id = s.id and o.business_day = d and o.paid_at is not null),
      (select coalesce(sum(o.total), 0) from orders o where o.store_id = s.id and o.business_day = d and o.paid_at is not null)
    from stores s order by s.created_at;
end $$;

-- ===== Hak akses fungsi =====
revoke execute on function price_lines(uuid, jsonb), handle_new_user() from public, anon, authenticated;
revoke execute on function add_staff(text, staff_role), set_staff_role(uuid, staff_role), save_store(uuid, text, text, text, boolean),
  assign_owner(uuid, text), list_stores_with_sales() from public, anon;
grant execute on function add_staff(text, staff_role), set_staff_role(uuid, staff_role), save_store(uuid, text, text, text, boolean),
  assign_owner(uuid, text), list_stores_with_sales() to authenticated;
grant execute on function create_order(uuid, text, order_type, text, jsonb) to anon, authenticated;

-- ===== RLS =====
alter table stores enable row level security;
create policy stores_read on stores for select using (true);
-- owner hanya boleh ubah nama & nomor WA tokonya; slug/is_active lewat super admin (save_store)
create policy stores_owner_update on stores for update to authenticated
  using (id = my_store() and my_role() = 'owner') with check (id = my_store() and my_role() = 'owner');
revoke update on stores from anon, authenticated;
grant update (name, wa_number) on stores to authenticated;

drop policy categories_read on categories;
drop policy categories_owner on categories;
drop policy products_read on products;
drop policy products_owner on products;
drop policy orders_staff_read on orders;
drop policy profiles_read on profiles;
drop policy profiles_owner_update on profiles;

-- menu publik hanya untuk toko aktif; staf toko itu tetap bisa melihat
create policy categories_read on categories for select
  using (store_id = my_store() or exists (select 1 from stores s where s.id = store_id and s.is_active));
create policy categories_owner on categories for all to authenticated
  using (my_role() = 'owner' and store_id = my_store()) with check (my_role() = 'owner' and store_id = my_store());

create policy products_read on products for select
  using (store_id = my_store() or exists (select 1 from stores s where s.id = store_id and s.is_active));
create policy products_owner on products for all to authenticated
  using (my_role() = 'owner' and store_id = my_store()) with check (my_role() = 'owner' and store_id = my_store());

create policy orders_staff_read on orders for select to authenticated
  using (my_role() is not null and store_id = my_store());

create policy profiles_read on profiles for select to authenticated
  using (user_id = auth.uid() or is_super() or (my_role() = 'owner' and store_id = my_store()));

-- Storage: foto di folder {store_id}/…
drop policy if exists product_images_owner on storage.objects;
create policy product_images_owner on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.my_role() = 'owner' and (storage.foldername(name))[1] = public.my_store()::text)
  with check (bucket_id = 'product-images' and public.my_role() = 'owner' and (storage.foldername(name))[1] = public.my_store()::text);
