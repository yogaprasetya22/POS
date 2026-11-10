-- POS inti: role & izin, audit, pajak/service, shift kasir, void/refund + PIN, meja, split/gabung bill,
-- stok bahan & resep, member/poin/voucher, paket langganan, laporan. Semua uang dihitung di database.

-- ===== Pengaturan toko =====
alter table stores
  add column tax_bp int not null default 0 check (tax_bp between 0 and 3000),            -- basis poin: 1100 = 11%
  add column tax_inclusive boolean not null default false,
  add column service_bp int not null default 0 check (service_bp between 0 and 3000),
  add column rounding_to int not null default 1 check (rounding_to in (1, 100, 500, 1000)),
  add column points_earn_per int not null default 0 check (points_earn_per >= 0),        -- Rp belanja per 1 poin (0 = nonaktif)
  add column points_value int not null default 0 check (points_value >= 0),              -- Rp potongan per 1 poin ditukar
  add column receipt_footer text not null default '' check (length(receipt_footer) <= 200),
  add column address text not null default '' check (length(address) <= 200),
  add column plan text not null default 'trial' check (plan in ('trial', 'basic', 'pro')),
  add column plan_expires_at timestamptz;                                                -- null = tanpa batas

-- Rahasia toko: stores bisa dibaca publik, jadi hash PIN disimpan terpisah tanpa akses API.
create table store_secrets (
  store_id uuid primary key references stores on delete cascade,
  supervisor_pin_hash text,
  pin_fails int not null default 0,
  pin_locked_until timestamptz
);
alter table store_secrets enable row level security;
revoke all on store_secrets from anon, authenticated;

-- ===== Helper izin =====
create function role_in(p_roles staff_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = any (p_roles), false)
$$;

create function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('owner', 'manager'), false)
$$;

create function today_jkt() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- ===== Audit =====
create table audit_log (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores on delete cascade,
  user_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_store_idx on audit_log (store_id, created_at desc);
alter table audit_log enable row level security;
create policy audit_read on audit_log for select to authenticated using (is_manager() and store_id = my_store());
revoke all on audit_log from anon;
revoke insert, update, delete on audit_log from authenticated;

create function audit(p_store uuid, p_action text, p_entity text, p_entity_id uuid, p_detail jsonb default '{}')
returns void language sql volatile security definer set search_path = public as $$
  insert into audit_log (store_id, user_id, action, entity, entity_id, detail)
  values (p_store, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'))
$$;

-- ===== Meja =====
create table store_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 10),
  sort int not null default 0,
  is_active boolean not null default true
);
create unique index store_tables_label_idx on store_tables (store_id, lower(label));
alter table store_tables enable row level security;
create policy store_tables_read on store_tables for select to authenticated using (store_id = my_store());
create policy store_tables_manage on store_tables for all to authenticated
  using (is_manager() and store_id = my_store()) with check (is_manager() and store_id = my_store());
revoke all on store_tables from anon;

-- ===== Member, poin, voucher =====
create table members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  phone text not null check (phone ~ '^62\d{8,13}$'),
  name text not null check (length(btrim(name)) between 1 and 60),
  points int not null default 0 check (points >= 0),
  visits int not null default 0,
  total_spent bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, phone)
);
alter table members enable row level security;
create policy members_read on members for select to authenticated using (my_role() is not null and store_id = my_store());
revoke all on members from anon;
revoke insert, update, delete on members from authenticated;

create table point_ledger (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores on delete cascade,
  member_id uuid not null references members on delete cascade,
  order_id uuid,
  delta int not null,
  reason text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index point_ledger_member_idx on point_ledger (member_id, created_at desc);
alter table point_ledger enable row level security;
create policy point_ledger_read on point_ledger for select to authenticated using (my_role() is not null and store_id = my_store());
revoke all on point_ledger from anon;
revoke insert, update, delete on point_ledger from authenticated;

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  code text not null check (code ~ '^[A-Za-z0-9-]{3,20}$'),
  kind text not null check (kind in ('AMOUNT', 'PERCENT')),
  value int not null check (value > 0),
  member_id uuid references members on delete set null,
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_order_id uuid,
  note text not null default '' check (length(note) <= 100),
  created_by uuid,
  created_at timestamptz not null default now(),
  check (kind <> 'PERCENT' or value <= 100)
);
create unique index vouchers_code_idx on vouchers (store_id, upper(code));
alter table vouchers enable row level security;
create policy vouchers_read on vouchers for select to authenticated using (is_manager() and store_id = my_store());
revoke all on vouchers from anon;
revoke insert, update, delete on vouchers from authenticated;

-- ===== Shift kasir =====
create table shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  opened_by uuid not null,
  opened_at timestamptz not null default now(),
  opening_cash int not null check (opening_cash >= 0),
  closed_at timestamptz,
  closed_by uuid,
  counted_cash int,
  expected_cash int,
  difference int,
  note text not null default ''
);
create unique index shifts_one_open_idx on shifts (store_id, opened_by) where closed_at is null;
create index shifts_store_idx on shifts (store_id, opened_at desc);
alter table shifts enable row level security;
create policy shifts_read on shifts for select to authenticated
  using (store_id = my_store() and (is_manager() or opened_by = auth.uid()));
revoke all on shifts from anon;
revoke insert, update, delete on shifts from authenticated;

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts on delete cascade,
  store_id uuid not null references stores on delete cascade,
  kind text not null check (kind in ('IN', 'OUT')),
  amount int not null check (amount > 0),
  reason text not null check (length(btrim(reason)) between 3 and 100),
  user_id uuid,
  created_at timestamptz not null default now()
);
alter table cash_movements enable row level security;
create policy cash_movements_read on cash_movements for select to authenticated
  using (store_id = my_store() and (is_manager() or user_id = auth.uid()));
revoke all on cash_movements from anon;
revoke insert, update, delete on cash_movements from authenticated;

-- ===== Stok bahan & resep =====
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  unit text not null default 'pcs' check (length(btrim(unit)) between 1 and 12),
  stock numeric(12, 3) not null default 0,
  min_stock numeric(12, 3) not null default 0 check (min_stock >= 0),
  cost numeric(12, 2) not null default 0 check (cost >= 0),   -- harga beli per satuan, untuk HPP
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index ingredients_name_idx on ingredients (store_id, lower(name));
alter table ingredients enable row level security;
create policy ingredients_read on ingredients for select to authenticated using (my_role() is not null and store_id = my_store());
create policy ingredients_manage on ingredients for all to authenticated
  using (is_manager() and store_id = my_store()) with check (is_manager() and store_id = my_store());
revoke all on ingredients from anon;
-- jumlah stok hanya berubah lewat stock_adjust() / penjualan agar selalu tercatat
revoke insert, update on ingredients from authenticated;
grant insert (store_id, name, unit, min_stock, cost, is_active) on ingredients to authenticated;
grant update (name, unit, min_stock, cost, is_active) on ingredients to authenticated;

create table recipes (
  product_id uuid not null references products on delete cascade,
  ingredient_id uuid not null references ingredients on delete cascade,
  store_id uuid not null references stores on delete cascade,
  qty numeric(12, 3) not null check (qty > 0),
  primary key (product_id, ingredient_id)
);
alter table recipes enable row level security;
create policy recipes_read on recipes for select to authenticated using (my_role() is not null and store_id = my_store());
create policy recipes_manage on recipes for all to authenticated
  using (is_manager() and store_id = my_store()) with check (is_manager() and store_id = my_store());
revoke all on recipes from anon;

create table stock_movements (
  id bigint generated always as identity primary key,
  store_id uuid not null references stores on delete cascade,
  ingredient_id uuid not null references ingredients on delete cascade,
  delta numeric(12, 3) not null,
  reason text not null check (reason in ('SALE', 'VOID', 'RESTOCK', 'ADJUST')),
  note text not null default '',
  order_id uuid,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_idx on stock_movements (ingredient_id, created_at desc);
alter table stock_movements enable row level security;
create policy stock_movements_read on stock_movements for select to authenticated using (is_manager() and store_id = my_store());
revoke all on stock_movements from anon;
revoke insert, update, delete on stock_movements from authenticated;

-- ===== Kolom pesanan =====
alter table orders
  add column subtotal int not null default 0,
  add column voucher_id uuid references vouchers,
  add column voucher_discount int not null default 0,
  add column member_id uuid references members,
  add column points_redeemed int not null default 0,
  add column points_discount int not null default 0,
  add column points_earned int not null default 0,
  add column service_amount int not null default 0,
  add column tax_amount int not null default 0,
  add column rounding_amount int not null default 0,
  add column shift_id uuid references shifts,
  add column paid_by uuid,
  add column created_by uuid,                -- null = pesanan publik (QR/link), terisi = dibuat staf
  add column void_reason text,
  add column voided_at timestamptz,
  add column voided_by uuid,
  add column reversal_shift_id uuid references shifts;
update orders set subtotal = total + discount_amount where subtotal = 0;
create index orders_shift_idx on orders (shift_id) where shift_id is not null;

-- ===== Perhitungan uang (satu-satunya tempat) =====
-- service dihitung dari dasar, pajak dari (dasar + service); pembulatan di akhir.
create function calc_charges(p_store uuid, p_base int, out service int, out tax int, out rounding int, out total int)
language plpgsql stable security definer set search_path = public as $$
declare s stores; b bigint := greatest(p_base, 0); t_base bigint; tt bigint;
begin
  select * into s from stores where id = p_store;
  service := ((b * s.service_bp + 5000) / 10000)::int;
  t_base := b + service;
  if s.tax_inclusive then
    tax := (t_base - ((t_base * 10000 + (10000 + s.tax_bp) / 2) / (10000 + s.tax_bp)))::int;
    tt := t_base;
  else
    tax := ((t_base * s.tax_bp + 5000) / 10000)::int;
    tt := t_base + tax;
  end if;
  if s.rounding_to > 1 then
    rounding := (((tt + s.rounding_to / 2) / s.rounding_to) * s.rounding_to - tt)::int;
  else
    rounding := 0;
  end if;
  total := (tt + rounding)::int;
end $$;

create function compute_from_items(p_store uuid, p_items jsonb, p_code text, p_member uuid, p_redeem int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s stores; sub int; promo record; after_promo int; norm text := upper(btrim(coalesce(p_code, '')));
  v vouchers; v_disc int := 0; after_v int; m members; red int := 0; pts_disc int := 0;
  ch record; base int; earned int := 0;
begin
  select * into s from stores where id = p_store;
  select coalesce(sum((i->>'subtotal')::int), 0) into sub from jsonb_array_elements(p_items) i;
  select * into promo from calculate_order_promo(p_store, p_items, sub, p_code);
  after_promo := greatest(0, sub - coalesce(promo.discount_amount, 0));

  if norm <> '' then
    select * into v from vouchers vo
      where vo.store_id = p_store and upper(vo.code) = norm and vo.redeemed_at is null
        and (vo.expires_at is null or vo.expires_at > now())
        and (vo.member_id is null or vo.member_id = p_member)
      limit 1;
    if found then
      v_disc := least(after_promo, case v.kind when 'AMOUNT' then v.value else (after_promo * v.value) / 100 end);
    end if;
  end if;
  after_v := after_promo - v_disc;

  if p_member is not null then
    if my_role() is null then raise exception 'forbidden'; end if;
    select * into m from members where id = p_member and store_id = p_store;
    if not found then raise exception 'Member tidak ditemukan'; end if;
    if coalesce(p_redeem, 0) > 0 and s.points_value > 0 then
      red := least(p_redeem, m.points, (after_v + s.points_value - 1) / s.points_value);
      pts_disc := least(after_v, red * s.points_value);
    end if;
  end if;

  base := after_v - pts_disc;
  select * into ch from calc_charges(p_store, base);
  if p_member is not null and s.points_earn_per > 0 then earned := ch.total / s.points_earn_per; end if;

  return jsonb_build_object(
    'items', p_items, 'subtotal', sub,
    'promo_discount', coalesce(promo.discount_amount, 0), 'promo_name', promo.promo_name,
    'voucher_id', case when v.id is not null and v_disc > 0 then v.id end, 'voucher_discount', v_disc,
    'member_id', p_member, 'points_redeemed', red, 'points_discount', pts_disc, 'points_earned', earned,
    'service', ch.service, 'tax', ch.tax, 'rounding', ch.rounding, 'total', ch.total);
end $$;

create function compute_order(p_store uuid, p_lines jsonb, p_code text, p_member uuid, p_redeem int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare priced record;
begin
  select * into priced from price_lines(p_store, p_lines);
  return compute_from_items(p_store, priced.items, p_code, p_member, p_redeem);
end $$;

-- Pratinjau total tanpa membuat pesanan (dipakai layar kasir & checkout pelanggan).
create function quote_order(p_store_id uuid, p_lines jsonb, p_promo_code text default null, p_member_id uuid default null, p_redeem_points int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select compute_order(p_store_id, p_lines, p_promo_code, p_member_id, p_redeem_points)
$$;

create function apply_amounts(p_order uuid, c jsonb) returns void
language sql volatile security definer set search_path = public as $$
  update orders set
    items = c->'items', subtotal = (c->>'subtotal')::int,
    discount_amount = (c->>'promo_discount')::int, promo_name = c->>'promo_name',
    voucher_id = (c->>'voucher_id')::uuid, voucher_discount = (c->>'voucher_discount')::int,
    points_redeemed = (c->>'points_redeemed')::int, points_discount = (c->>'points_discount')::int,
    points_earned = (c->>'points_earned')::int,
    service_amount = (c->>'service')::int, tax_amount = (c->>'tax')::int,
    rounding_amount = (c->>'rounding')::int, total = (c->>'total')::int
  where id = p_order
$$;

create function next_queue_code(p_store uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare seq int;
begin
  insert into daily_counters as dc (store_id, day, n) values (p_store, today_jkt(), 1)
    on conflict (store_id, day) do update set n = dc.n + 1
    returning dc.n into seq;
  return 'A-' || case when seq < 1000 then lpad(seq::text, 3, '0') else seq::text end;
end $$;

-- ===== Pesanan =====
drop function if exists create_order(uuid, text, order_type, text, jsonb, text);
create function create_order(
  p_store_id uuid, p_customer_name text, p_order_type order_type, p_table_no text, p_lines jsonb,
  p_promo_code text default null, p_member_id uuid default null, p_redeem_points int default 0
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s stores; unpaid int; c jsonb; tbl text; here boolean; r jsonb; oid uuid;
  norm text := upper(btrim(coalesce(p_promo_code, '')));
begin
  select * into s from stores where id = p_store_id;
  if not found then raise exception 'Toko tidak ditemukan'; end if;
  if not s.is_active then raise exception 'Toko sedang tutup'; end if;
  if s.plan_expires_at is not null and s.plan_expires_at < now() then raise exception 'Langganan toko berakhir'; end if;
  here := my_role() is not null and my_store() = p_store_id;   -- staf toko ini; selain itu diperlakukan sebagai publik

  p_customer_name := btrim(coalesce(p_customer_name, ''));
  if p_customer_name = '' or length(p_customer_name) > 40 then raise exception 'invalid name'; end if;
  tbl := btrim(coalesce(p_table_no, ''));
  if p_order_type = 'DINE_IN' then
    if tbl = '' then raise exception 'table required'; end if;
    if not here and exists (select 1 from store_tables where store_id = p_store_id and is_active) then
      select label into tbl from store_tables where store_id = p_store_id and is_active and lower(label) = lower(tbl);
      if tbl is null then raise exception 'Nomor meja tidak terdaftar'; end if;
    end if;
  end if;

  if not here then
    -- pesanan publik menggantung > 45 menit kedaluwarsa; batasi antrean & pesanan per meja (anti-spam)
    update orders set status = 'EXPIRED'
      where store_id = p_store_id and status = 'UNPAID' and created_by is null and created_at < now() - interval '45 minutes';
    select count(*) into unpaid from orders where store_id = p_store_id and status = 'UNPAID' and created_by is null;
    if unpaid >= 40 then raise exception 'Antrean sedang penuh, coba lagi beberapa menit lagi'; end if;
    if p_order_type = 'DINE_IN' and (select count(*) from orders where store_id = p_store_id and status = 'UNPAID'
         and created_by is null and table_no = left(tbl, 10) and created_at > now() - interval '10 minutes') >= 3 then
      raise exception 'Meja ini sudah punya pesanan menunggu pembayaran';
    end if;
  end if;

  c := compute_order(p_store_id, p_lines, p_promo_code,
                     case when here then p_member_id end, case when here then p_redeem_points end);

  oid := gen_random_uuid();
  insert into orders (
    id, store_id, queue_code, business_day, customer_name, order_type, table_no, items,
    subtotal, discount_amount, promo_name, promo_code, voucher_id, voucher_discount,
    member_id, points_redeemed, points_discount, points_earned,
    service_amount, tax_amount, rounding_amount, total, created_by
  ) values (
    oid, p_store_id, next_queue_code(p_store_id), today_jkt(), p_customer_name, p_order_type,
    case when p_order_type = 'DINE_IN' then left(tbl, 10) end, c->'items',
    (c->>'subtotal')::int, (c->>'promo_discount')::int, c->>'promo_name',
    case when norm <> '' then norm end, (c->>'voucher_id')::uuid, (c->>'voucher_discount')::int,
    (c->>'member_id')::uuid, (c->>'points_redeemed')::int, (c->>'points_discount')::int, (c->>'points_earned')::int,
    (c->>'service')::int, (c->>'tax')::int, (c->>'rounding')::int, (c->>'total')::int,
    case when here then auth.uid() end)
  returning jsonb_build_object('id', id, 'queue_code', queue_code, 'total', total,
    'discount_amount', discount_amount, 'promo_name', promo_name, 'promo_code', promo_code) into r;
  return r;
end $$;

create or replace function update_order_lines(p_order_id uuid, p_lines jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare o orders; c jsonb;
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order_id and store_id = my_store() and status = 'UNPAID' for update;
  if not found then raise exception 'Pesanan tidak bisa diubah'; end if;
  c := compute_order(o.store_id, p_lines, o.promo_code, o.member_id, o.points_redeemed);
  perform apply_amounts(o.id, c);
end $$;

-- Pasang kode promo/voucher, member, dan tukar poin pada pesanan yang belum dibayar.
create function apply_order_extras(p_order_id uuid, p_promo_code text, p_member_id uuid, p_redeem_points int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare o orders; c jsonb; norm text := upper(btrim(coalesce(p_promo_code, '')));
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order_id and store_id = my_store() and status = 'UNPAID' for update;
  if not found then raise exception 'Pesanan tidak bisa diubah'; end if;
  c := compute_from_items(o.store_id, o.items, p_promo_code, p_member_id, p_redeem_points);
  perform apply_amounts(o.id, c);
  update orders set promo_code = case when norm <> '' then norm end, member_id = p_member_id where id = o.id;
end $$;

create or replace function expire_stale_orders() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  update orders set status = 'EXPIRED'
    where status = 'UNPAID' and created_by is null and created_at < now() - interval '45 minutes' and store_id = my_store();
end $$;

create or replace function advance_order(p_order_id uuid, p_to order_status) returns void
language plpgsql volatile security definer set search_path = public as $$
declare o orders; step text;
begin
  select * into o from orders where id = p_order_id and store_id = my_store() for update;
  if not found then raise exception 'Perubahan status tidak valid'; end if;
  step := o.status::text || '>' || p_to::text;
  if step = 'UNPAID>CANCELLED' and role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then null;
  elsif step = 'IN_KITCHEN>READY' and role_in(array['owner', 'manager', 'cashier', 'kitchen']::staff_role[]) then null;
  elsif step = 'READY>COMPLETED' and role_in(array['owner', 'manager', 'cashier', 'kitchen', 'waiter']::staff_role[]) then null;
  else raise exception 'Perubahan status tidak valid'; end if;
  update orders set status = p_to where id = o.id;
  if p_to = 'CANCELLED' then perform audit(o.store_id, 'order.cancel', 'order', o.id, jsonb_build_object('queue', o.queue_code)); end if;
end $$;

create or replace function pay_order(p_order_id uuid, p_method payment_method, p_cash_received int) returns orders
language plpgsql volatile security definer set search_path = public as $$
declare o orders; sh uuid; s stores; it jsonb; rc record; q numeric;
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  select * into s from stores where id = my_store();
  if s.plan_expires_at is not null and s.plan_expires_at < now() then raise exception 'Langganan toko berakhir'; end if;
  select id into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
  if sh is null then raise exception 'Buka shift kasir dulu'; end if;

  update orders set
      status = 'IN_KITCHEN', paid_at = now(), payment_method = p_method,
      cash_received = case when p_method = 'CASH' then p_cash_received end, shift_id = sh, paid_by = auth.uid()
    where id = p_order_id and status = 'UNPAID' and store_id = my_store()
      and (p_method <> 'CASH' or coalesce(p_cash_received, 0) >= total)
    returning * into o;
  if o.id is null then raise exception 'Pembayaran gagal (sudah dibayar, dibatalkan, atau uang kurang)'; end if;

  if o.voucher_id is not null then
    update vouchers set redeemed_at = now(), redeemed_order_id = o.id where id = o.voucher_id and redeemed_at is null;
    if not found then raise exception 'Voucher sudah dipakai'; end if;
  end if;

  if o.member_id is not null then
    update members set points = points - o.points_redeemed + o.points_earned, visits = visits + 1,
        total_spent = total_spent + o.total
      where id = o.member_id and points >= o.points_redeemed;
    if not found then raise exception 'Poin member tidak cukup'; end if;
    if o.points_redeemed > 0 then
      insert into point_ledger (store_id, member_id, order_id, delta, reason, user_id)
        values (o.store_id, o.member_id, o.id, -o.points_redeemed, 'REDEEM', auth.uid());
    end if;
    if o.points_earned > 0 then
      insert into point_ledger (store_id, member_id, order_id, delta, reason, user_id)
        values (o.store_id, o.member_id, o.id, o.points_earned, 'EARN', auth.uid());
    end if;
  end if;

  for it in select value from jsonb_array_elements(o.items) loop
    for rc in select ingredient_id, qty from recipes where product_id = (it->>'product_id')::uuid loop
      q := rc.qty * (it->>'qty')::int;
      update ingredients set stock = stock - q where id = rc.ingredient_id;
      insert into stock_movements (store_id, ingredient_id, delta, reason, order_id, user_id)
        values (o.store_id, rc.ingredient_id, -q, 'SALE', o.id, auth.uid());
    end loop;
  end loop;

  perform audit(o.store_id, 'order.pay', 'order', o.id,
    jsonb_build_object('queue', o.queue_code, 'total', o.total, 'method', p_method));
  return o;
end $$;

-- ===== PIN supervisor & void/refund =====
create function set_supervisor_pin(p_pin text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_pin !~ '^\d{4,8}$' then raise exception 'PIN harus 4-8 angka'; end if;
  insert into store_secrets (store_id, supervisor_pin_hash) values (my_store(), extensions.crypt(p_pin, extensions.gen_salt('bf')))
    on conflict (store_id) do update set supervisor_pin_hash = excluded.supervisor_pin_hash, pin_fails = 0, pin_locked_until = null;
  perform audit(my_store(), 'pin.set', 'store', my_store(), '{}');
end $$;

-- true = PIN benar. Percobaan gagal dicatat; 5 kali salah mengunci 5 menit.
create function check_pin(p_pin text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare sec store_secrets;
begin
  select * into sec from store_secrets where store_id = my_store();
  if sec.supervisor_pin_hash is null then return 'PIN supervisor belum diatur owner'; end if;
  if sec.pin_locked_until is not null and sec.pin_locked_until > now() then return 'PIN terkunci sementara, coba lagi nanti'; end if;
  if p_pin is not null and extensions.crypt(p_pin, sec.supervisor_pin_hash) = sec.supervisor_pin_hash then
    update store_secrets set pin_fails = 0, pin_locked_until = null where store_id = my_store();
    return null;
  end if;
  update store_secrets set
      pin_locked_until = case when pin_fails + 1 >= 5 then now() + interval '5 minutes' end,
      pin_fails = case when pin_fails + 1 >= 5 then 0 else pin_fails + 1 end
    where store_id = my_store();
  return 'PIN salah';
end $$;

-- Mengembalikan {ok, error} (bukan exception) supaya hitungan PIN salah tetap tersimpan.
create function reverse_order(p_order_id uuid, p_kind text, p_reason text, p_pin text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare o orders; err text; sh uuid; mv record;
begin
  if p_kind not in ('VOID', 'REFUND') then raise exception 'invalid kind'; end if;
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then return jsonb_build_object('ok', false, 'error', 'Alasan wajib diisi'); end if;
  select * into o from orders where id = p_order_id and store_id = my_store() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Pesanan tidak ditemukan'); end if;
  if o.status not in ('IN_KITCHEN', 'READY', 'COMPLETED') then
    return jsonb_build_object('ok', false, 'error', 'Hanya pesanan yang sudah dibayar yang bisa di-void/refund');
  end if;
  if not is_manager() then
    err := check_pin(p_pin);
    if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  end if;

  select id into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
  update orders set status = case p_kind when 'VOID' then 'VOID'::order_status else 'REFUNDED'::order_status end,
      void_reason = btrim(p_reason), voided_at = now(), voided_by = auth.uid(), reversal_shift_id = sh
    where id = o.id;

  if o.member_id is not null then
    update members set points = greatest(0, points + o.points_redeemed - o.points_earned),
        total_spent = greatest(0, total_spent - o.total), visits = greatest(0, visits - 1) where id = o.member_id;
    insert into point_ledger (store_id, member_id, order_id, delta, reason, user_id)
      values (o.store_id, o.member_id, o.id, o.points_redeemed - o.points_earned, 'REVERSE', auth.uid());
  end if;
  if o.voucher_id is not null then
    update vouchers set redeemed_at = null, redeemed_order_id = null where id = o.voucher_id;
  end if;
  for mv in select ingredient_id, -delta as qty from stock_movements where order_id = o.id and reason = 'SALE' loop
    update ingredients set stock = stock + mv.qty where id = mv.ingredient_id;
    insert into stock_movements (store_id, ingredient_id, delta, reason, order_id, user_id)
      values (o.store_id, mv.ingredient_id, mv.qty, 'VOID', o.id, auth.uid());
  end loop;

  perform audit(o.store_id, 'order.' || lower(p_kind), 'order', o.id,
    jsonb_build_object('queue', o.queue_code, 'total', o.total, 'reason', btrim(p_reason), 'method', o.payment_method));
  return jsonb_build_object('ok', true);
end $$;

-- ===== Shift kasir =====
create function shift_totals(p_shift uuid, out opening int, out cash_sales int, out cash_in int, out cash_out int,
  out cash_reversals int, out expected int)
language plpgsql stable security definer set search_path = public as $$
begin
  select s.opening_cash into opening from shifts s where s.id = p_shift;
  select coalesce(sum(o.total), 0) into cash_sales from orders o
    where o.shift_id = p_shift and o.payment_method = 'CASH'
      and (o.status not in ('VOID', 'REFUNDED') or o.reversal_shift_id is distinct from p_shift);   -- void di shift yang sama saling meniadakan
  select coalesce(sum(m.amount) filter (where m.kind = 'IN'), 0), coalesce(sum(m.amount) filter (where m.kind = 'OUT'), 0)
    into cash_in, cash_out from cash_movements m where m.shift_id = p_shift;
  select coalesce(sum(o.total), 0) into cash_reversals from orders o
    where o.reversal_shift_id = p_shift and o.shift_id is distinct from p_shift and o.payment_method = 'CASH';
  expected := opening + cash_sales + cash_in - cash_out - cash_reversals;
end $$;

create function open_shift(p_opening_cash int) returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare r shifts;
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_opening_cash is null or p_opening_cash < 0 then raise exception 'Modal awal tidak valid'; end if;
  begin
    insert into shifts (store_id, opened_by, opening_cash) values (my_store(), auth.uid(), p_opening_cash) returning * into r;
  exception when unique_violation then raise exception 'Shift kamu sudah terbuka';
  end;
  perform audit(r.store_id, 'shift.open', 'shift', r.id, jsonb_build_object('opening_cash', p_opening_cash));
  return r;
end $$;

create function shift_summary(p_shift_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sh shifts; t record; by_method jsonb;
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_shift_id is null then
    select * into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
  else
    select * into sh from shifts where id = p_shift_id and store_id = my_store() and (is_manager() or opened_by = auth.uid());
  end if;
  if sh.id is null then return null; end if;
  select * into t from shift_totals(sh.id);
  select coalesce(jsonb_object_agg(payment_method, x), '{}') into by_method from (
    select payment_method, jsonb_build_object('count', count(*), 'total', sum(total)) x from orders
      where shift_id = sh.id and status not in ('VOID', 'REFUNDED') group by payment_method) q;
  return jsonb_build_object('id', sh.id, 'opened_at', sh.opened_at, 'closed_at', sh.closed_at, 'opening_cash', t.opening,
    'cash_sales', t.cash_sales, 'cash_in', t.cash_in, 'cash_out', t.cash_out, 'cash_reversals', t.cash_reversals,
    'expected_cash', case when sh.closed_at is null then t.expected else sh.expected_cash end,
    'counted_cash', sh.counted_cash, 'difference', sh.difference, 'by_method', by_method);
end $$;

create function cash_movement(p_kind text, p_amount int, p_reason text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare sh uuid;
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  select id into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
  if sh is null then raise exception 'Buka shift kasir dulu'; end if;
  insert into cash_movements (shift_id, store_id, kind, amount, reason, user_id) values (sh, my_store(), p_kind, p_amount, btrim(p_reason), auth.uid());
  perform audit(my_store(), 'cash.' || lower(p_kind), 'shift', sh, jsonb_build_object('amount', p_amount, 'reason', btrim(p_reason)));
end $$;

create function close_shift(p_counted_cash int, p_note text default '') returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare sh shifts; t record;
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_counted_cash is null or p_counted_cash < 0 then raise exception 'Jumlah uang tidak valid'; end if;
  select * into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null for update;
  if not found then raise exception 'Tidak ada shift yang terbuka'; end if;
  select * into t from shift_totals(sh.id);
  update shifts set closed_at = now(), closed_by = auth.uid(), counted_cash = p_counted_cash,
      expected_cash = t.expected, difference = p_counted_cash - t.expected, note = left(coalesce(p_note, ''), 200)
    where id = sh.id returning * into sh;
  perform audit(sh.store_id, 'shift.close', 'shift', sh.id,
    jsonb_build_object('expected', sh.expected_cash, 'counted', sh.counted_cash, 'difference', sh.difference));
  return sh;
end $$;

-- ===== Split & gabung bill =====
create function split_order(p_order_id uuid, p_indexes int[]) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare o orders; keep jsonb := '[]'; mv jsonb := '[]'; rec record; c1 jsonb; c2 jsonb; nid uuid := gen_random_uuid(); q text;
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order_id and store_id = my_store() and status = 'UNPAID' for update;
  if not found then raise exception 'Pesanan tidak bisa dipisah'; end if;
  for rec in select value, ord from jsonb_array_elements(o.items) with ordinality as t(value, ord) loop
    if (rec.ord - 1)::int = any (coalesce(p_indexes, '{}'::int[])) then mv := mv || rec.value; else keep := keep || rec.value; end if;
  end loop;
  if jsonb_array_length(mv) = 0 or jsonb_array_length(keep) = 0 then raise exception 'Pilih sebagian item saja untuk dipisah'; end if;

  c1 := compute_from_items(o.store_id, keep, o.promo_code, o.member_id, o.points_redeemed);
  perform apply_amounts(o.id, c1);
  c2 := compute_from_items(o.store_id, mv, null, null, 0);
  q := next_queue_code(o.store_id);
  insert into orders (id, store_id, queue_code, business_day, customer_name, order_type, table_no, items, subtotal,
      discount_amount, promo_name, voucher_discount, points_redeemed, points_discount, points_earned,
      service_amount, tax_amount, rounding_amount, total, created_by)
    values (nid, o.store_id, q, today_jkt(), o.customer_name, o.order_type, o.table_no, mv, (c2->>'subtotal')::int,
      (c2->>'promo_discount')::int, c2->>'promo_name', 0, 0, 0, 0,
      (c2->>'service')::int, (c2->>'tax')::int, (c2->>'rounding')::int, (c2->>'total')::int, auth.uid());
  perform audit(o.store_id, 'order.split', 'order', o.id, jsonb_build_object('queue', o.queue_code, 'new_queue', q));
  return jsonb_build_object('id', nid, 'queue_code', q);
end $$;

create function merge_orders(p_target uuid, p_source uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare t orders; s orders; c jsonb;
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_target = p_source then raise exception 'Pilih dua pesanan berbeda'; end if;
  select * into t from orders where id = p_target and store_id = my_store() and status = 'UNPAID' for update;
  select * into s from orders where id = p_source and store_id = my_store() and status = 'UNPAID' for update;
  if t.id is null or s.id is null then raise exception 'Pesanan tidak bisa digabung'; end if;
  c := compute_from_items(t.store_id, t.items || s.items, t.promo_code, t.member_id, t.points_redeemed);
  perform apply_amounts(t.id, c);
  update orders set status = 'CANCELLED' where id = s.id;
  perform audit(t.store_id, 'order.merge', 'order', t.id, jsonb_build_object('queue', t.queue_code, 'from', s.queue_code));
end $$;

-- ===== Member, poin, voucher =====
create function upsert_member(p_phone text, p_name text) returns members
language plpgsql volatile security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); r members;
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  if ph like '0%' then ph := '62' || substr(ph, 2); elsif ph like '8%' then ph := '62' || ph; end if;
  if ph !~ '^62\d{8,13}$' then raise exception 'Nomor HP tidak valid'; end if;
  insert into members (store_id, phone, name) values (my_store(), ph, btrim(p_name))
    on conflict (store_id, phone) do update set name = excluded.name
    returning * into r;
  return r;
end $$;

create function adjust_points(p_member uuid, p_delta int, p_reason text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_delta = 0 or length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Jumlah poin dan alasan wajib diisi'; end if;
  update members set points = points + p_delta where id = p_member and store_id = my_store() and points + p_delta >= 0;
  if not found then raise exception 'Member tidak ditemukan atau poin tidak cukup'; end if;
  insert into point_ledger (store_id, member_id, delta, reason, user_id) values (my_store(), p_member, p_delta, 'ADJUST: ' || btrim(p_reason), auth.uid());
  perform audit(my_store(), 'points.adjust', 'member', p_member, jsonb_build_object('delta', p_delta, 'reason', btrim(p_reason)));
end $$;

create function create_voucher(p_code text, p_kind text, p_value int, p_member uuid, p_expires timestamptz, p_note text default '')
returns vouchers language plpgsql volatile security definer set search_path = public as $$
declare r vouchers; cd text := upper(btrim(coalesce(p_code, '')));
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if cd = '' then cd := 'V-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)); end if;
  begin
    insert into vouchers (store_id, code, kind, value, member_id, expires_at, note, created_by)
      values (my_store(), cd, p_kind, p_value, p_member, p_expires, left(coalesce(p_note, ''), 100), auth.uid()) returning * into r;
  exception when unique_violation then raise exception 'Kode voucher sudah dipakai';
  end;
  perform audit(my_store(), 'voucher.create', 'voucher', r.id, jsonb_build_object('code', r.code, 'kind', p_kind, 'value', p_value));
  return r;
end $$;

create function delete_voucher(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  delete from vouchers where id = p_id and store_id = my_store() and redeemed_at is null;
  if not found then raise exception 'Voucher tidak ditemukan atau sudah dipakai'; end if;
end $$;

-- ===== Stok =====
create function stock_adjust(p_ingredient uuid, p_delta numeric, p_reason text, p_note text default '') returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not role_in(array['owner', 'manager', 'kitchen']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_reason not in ('RESTOCK', 'ADJUST') or p_delta = 0 then raise exception 'Data stok tidak valid'; end if;
  update ingredients set stock = stock + p_delta where id = p_ingredient and store_id = my_store();
  if not found then raise exception 'Bahan tidak ditemukan'; end if;
  insert into stock_movements (store_id, ingredient_id, delta, reason, note, user_id)
    values (my_store(), p_ingredient, p_delta, p_reason, left(coalesce(p_note, ''), 100), auth.uid());
end $$;

-- ===== Pengaturan toko & PIN =====
create function save_store_settings(
  p_tax_bp int, p_tax_inclusive boolean, p_service_bp int, p_rounding_to int,
  p_points_earn_per int, p_points_value int, p_receipt_footer text, p_address text
) returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  update stores set tax_bp = p_tax_bp, tax_inclusive = p_tax_inclusive, service_bp = p_service_bp, rounding_to = p_rounding_to,
      points_earn_per = p_points_earn_per, points_value = p_points_value,
      receipt_footer = left(coalesce(p_receipt_footer, ''), 200), address = left(coalesce(p_address, ''), 200)
    where id = my_store();
  perform audit(my_store(), 'store.settings', 'store', my_store(),
    jsonb_build_object('tax_bp', p_tax_bp, 'tax_inclusive', p_tax_inclusive, 'service_bp', p_service_bp, 'rounding_to', p_rounding_to));
end $$;

-- ===== Staf: role baru, tercatat di audit =====
create or replace function add_staff(p_email text, p_role staff_role) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_role is null then raise exception 'role wajib diisi'; end if;
  update profiles set store_id = my_store(), role = p_role
    where lower(email) = lower(btrim(p_email)) and store_id is null and not is_super_admin;
  if not found then raise exception 'Email belum terdaftar atau sudah terikat ke toko lain'; end if;
  perform audit(my_store(), 'staff.add', 'profile', null, jsonb_build_object('email', lower(btrim(p_email)), 'role', p_role));
end $$;

create or replace function set_staff_role(p_user_id uuid, p_role staff_role) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'Tidak bisa mengubah akun sendiri'; end if;
  update profiles set role = p_role, store_id = case when p_role is null then null else store_id end
    where user_id = p_user_id and store_id = my_store();
  if not found then raise exception 'Staf tidak ditemukan'; end if;
  perform audit(my_store(), 'staff.role', 'profile', p_user_id, jsonb_build_object('role', p_role));
end $$;

-- ===== Paket langganan & onboarding =====
create function register_store(p_name text, p_slug text, p_wa text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare r uuid;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  if my_store() is not null or is_super() then raise exception 'Akun ini sudah terhubung ke toko'; end if;
  begin
    insert into stores (slug, name, wa_number, plan, plan_expires_at)
      values (lower(btrim(p_slug)), btrim(p_name), p_wa, 'trial', now() + interval '14 days') returning id into r;
  exception when unique_violation then raise exception 'Slug sudah dipakai toko lain';
  end;
  update profiles set store_id = r, role = 'owner' where user_id = auth.uid();
  perform audit(r, 'store.register', 'store', r, jsonb_build_object('slug', lower(btrim(p_slug))));
  return r;
end $$;

create function set_store_plan(p_store uuid, p_plan text, p_expires timestamptz) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'forbidden'; end if;
  update stores set plan = p_plan, plan_expires_at = p_expires where id = p_store;
  if not found then raise exception 'Toko tidak ditemukan'; end if;
  perform audit(p_store, 'store.plan', 'store', p_store, jsonb_build_object('plan', p_plan, 'expires', p_expires));
end $$;

drop function if exists list_stores_with_sales();
create function list_stores_with_sales()
returns table (id uuid, slug text, name text, wa_number text, is_active boolean, owner_emails text,
  orders_today bigint, sales_today bigint, plan text, plan_expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare d date := today_jkt();
begin
  if not is_super() then raise exception 'forbidden'; end if;
  return query
    select s.id, s.slug, s.name, s.wa_number, s.is_active,
      (select string_agg(p.email, ', ') from profiles p where p.store_id = s.id and p.role = 'owner'),
      (select count(*) from orders o where o.store_id = s.id and o.business_day = d and o.paid_at is not null),
      (select coalesce(sum(o.total), 0) from orders o where o.store_id = s.id and o.business_day = d and o.paid_at is not null
         and o.status in ('IN_KITCHEN', 'READY', 'COMPLETED')),
      s.plan, s.plan_expires_at
    from stores s order by s.created_at;
end $$;

-- ===== Laporan =====
create function sales_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then raise exception 'Rentang tanggal tidak valid (maks. 366 hari)'; end if;
  with paid as (
    select * from orders where store_id = my_store() and business_day between p_from and p_to
      and paid_at is not null and status in ('IN_KITCHEN', 'READY', 'COMPLETED')
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object('orders', count(*),
        'gross', coalesce(sum(coalesce(nullif(subtotal, 0), total + discount_amount)), 0),
        'discount', coalesce(sum(discount_amount + voucher_discount + points_discount), 0),
        'service', coalesce(sum(service_amount), 0), 'tax', coalesce(sum(tax_amount), 0),
        'rounding', coalesce(sum(rounding_amount), 0), 'net', coalesce(sum(total), 0)) from paid),
    'voids', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(total), 0)) from orders
        where store_id = my_store() and business_day between p_from and p_to and status = 'VOID'),
    'refunds', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(total), 0)) from orders
        where store_id = my_store() and business_day between p_from and p_to and status = 'REFUNDED'),
    'daily', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day), '[]') from (
        select business_day as day, count(*) as orders, sum(total) as net from paid group by 1) x),
    'by_method', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select payment_method as method, count(*) as orders, sum(total) as net from paid group by 1) x),
    'by_cashier', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select coalesce(p.email, '-') as cashier, count(*) as orders, sum(paid.total) as net
        from paid left join profiles p on p.user_id = paid.paid_by group by 1 order by 3 desc) x),
    'top_products', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select i->>'name' as name, sum((i->>'qty')::int) as qty, sum((i->>'subtotal')::int) as revenue
        from paid, jsonb_array_elements(paid.items) i group by 1 order by 3 desc limit 20) x)
  ) into r;
  return r;
end $$;

-- ===== RLS: manager setara owner untuk katalog, promo, dan foto =====
drop policy categories_owner on categories;
create policy categories_owner on categories for all to authenticated
  using (is_manager() and store_id = my_store()) with check (is_manager() and store_id = my_store());
drop policy products_owner on products;
create policy products_owner on products for all to authenticated
  using (is_manager() and store_id = my_store()) with check (is_manager() and store_id = my_store());
drop policy promotions_owner_all on promotions;
create policy promotions_owner_all on promotions for all to authenticated
  using (is_manager() and store_id = my_store()) with check (is_manager() and store_id = my_store());
drop policy product_images_owner on storage.objects;
create policy product_images_owner on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.is_manager() and (storage.foldername(name))[1] = public.my_store()::text)
  with check (bucket_id = 'product-images' and public.is_manager() and (storage.foldername(name))[1] = public.my_store()::text);

-- Omzet lengkap hanya untuk owner/manager; staf lain hanya melihat pesanan kemarin & hari ini.
drop policy orders_staff_read on orders;
create policy orders_staff_read on orders for select to authenticated
  using (my_role() is not null and store_id = my_store() and (is_manager() or business_day >= today_jkt() - 1));
drop policy profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated
  using (user_id = auth.uid() or is_super() or (is_manager() and store_id = my_store()));

-- ===== Hak akses fungsi =====
do $$
declare r record;
begin
  -- internal: hanya dipanggil fungsi lain
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('calc_charges', 'compute_from_items', 'compute_order', 'apply_amounts', 'next_queue_code', 'audit', 'check_pin', 'shift_totals')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
  -- khusus staf login
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('apply_order_extras', 'reverse_order', 'open_shift', 'close_shift', 'shift_summary', 'cash_movement',
      'split_order', 'merge_orders', 'upsert_member', 'adjust_points', 'create_voucher', 'delete_voucher', 'stock_adjust',
      'save_store_settings', 'set_supervisor_pin', 'register_store', 'set_store_plan', 'sales_report', 'list_stores_with_sales',
      'update_order_lines', 'pay_order', 'advance_order', 'expire_stale_orders', 'add_staff', 'set_staff_role')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
  -- publik (pelanggan scan QR)
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('create_order', 'quote_order')
  loop
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;
end $$;
