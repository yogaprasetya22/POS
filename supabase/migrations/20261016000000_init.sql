-- WA-Order Express POS: skema awal
create type order_status as enum ('UNPAID', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED');
create type order_type as enum ('DINE_IN', 'TAKEAWAY');
create type payment_method as enum ('CASH', 'QRIS_STATIC', 'EDC_CARD');
create type staff_role as enum ('owner', 'cashier');

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  role staff_role not null
);

create table settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'Toko Saya',
  wa_number text not null default '6280000000000'
);
insert into settings default values;

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories on delete set null,
  name text not null,
  sku text unique,
  price int not null check (price >= 0),
  is_available boolean not null default true,
  -- [{name, required, multiple, options:[{name, price}]}], divalidasi ModifierGroupSchema di client
  modifiers jsonb not null default '[]',
  image_url text,
  sort int not null default 0
);

create table daily_counters (
  day date primary key,
  n int not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  queue_code text not null,
  business_day date not null,
  customer_name text not null,
  order_type order_type not null,
  table_no text,
  -- snapshot harga saat order: [{product_id, name, qty, unit_price, choices, note, subtotal}]
  items jsonb not null,
  total int not null check (total >= 0),
  status order_status not null default 'UNPAID',
  payment_method payment_method,
  cash_received int,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (business_day, queue_code)
);
create index orders_status_idx on orders (status, created_at);

-- ===== Helpers =====
create function my_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from profiles where user_id = auth.uid()
$$;

-- Satu-satunya tempat harga dihitung. Client tidak pernah mengirim harga.
create function price_lines(p_lines jsonb, out items jsonb, out total int)
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
    select * into p from products where id = (l->>'product_id')::uuid;
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

-- ===== RPC publik =====
create function create_order(p_customer_name text, p_order_type order_type, p_table_no text, p_lines jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Jakarta')::date;
  n int; priced record; r jsonb;
begin
  p_customer_name := btrim(coalesce(p_customer_name, ''));
  if p_customer_name = '' or length(p_customer_name) > 40 then raise exception 'invalid name'; end if;
  if p_order_type = 'DINE_IN' and coalesce(btrim(p_table_no), '') = '' then raise exception 'table required'; end if;

  select * into priced from price_lines(p_lines);

  insert into daily_counters as dc values (d, 1)
    on conflict (day) do update set n = dc.n + 1
    returning dc.n into n;

  insert into orders (queue_code, business_day, customer_name, order_type, table_no, items, total)
  values (
    'A-' || case when n < 1000 then lpad(n::text, 3, '0') else n::text end,
    d, p_customer_name, p_order_type,
    case when p_order_type = 'DINE_IN' then left(btrim(p_table_no), 10) end,
    priced.items, priced.total)
  returning jsonb_build_object('id', id, 'queue_code', queue_code, 'total', total) into r;
  return r;
end $$;

-- ===== RPC staff =====
create function update_order_lines(p_order_id uuid, p_lines jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare priced record;
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  select * into priced from price_lines(p_lines);
  update orders set items = priced.items, total = priced.total
    where id = p_order_id and status = 'UNPAID';
  if not found then raise exception 'Pesanan tidak bisa diubah'; end if;
end $$;

create function pay_order(p_order_id uuid, p_method payment_method, p_cash_received int) returns orders
language plpgsql volatile security definer set search_path = public as $$
declare o orders;
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  update orders set
      status = 'IN_KITCHEN', paid_at = now(), payment_method = p_method,
      cash_received = case when p_method = 'CASH' then p_cash_received end
    where id = p_order_id and status = 'UNPAID'
      and (p_method <> 'CASH' or coalesce(p_cash_received, 0) >= total)
    returning * into o;
  if o.id is null then raise exception 'Pembayaran gagal (sudah dibayar, dibatalkan, atau uang kurang)'; end if;
  return o;
end $$;

create function advance_order(p_order_id uuid, p_to order_status) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  update orders set status = p_to
    where id = p_order_id
      and status::text || '>' || p_to::text in ('UNPAID>CANCELLED', 'IN_KITCHEN>READY', 'READY>COMPLETED');
  if not found then raise exception 'Perubahan status tidak valid'; end if;
end $$;

create function expire_stale_orders() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  update orders set status = 'CANCELLED'
    where status = 'UNPAID' and created_at < now() - interval '45 minutes';
end $$;

-- Supabase memberi EXECUTE ke anon secara default; persempit secara eksplisit.
revoke execute on function price_lines(jsonb) from public, anon, authenticated;
revoke execute on function update_order_lines(uuid, jsonb), pay_order(uuid, payment_method, int),
  advance_order(uuid, order_status), expire_stale_orders() from public, anon;
grant execute on function update_order_lines(uuid, jsonb), pay_order(uuid, payment_method, int),
  advance_order(uuid, order_status), expire_stale_orders() to authenticated;
grant execute on function create_order(text, order_type, text, jsonb) to anon, authenticated;

-- ===== RLS =====
alter table profiles enable row level security;
alter table settings enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table daily_counters enable row level security;
alter table orders enable row level security;

create policy profiles_read on profiles for select to authenticated
  using (user_id = auth.uid() or my_role() = 'owner');

create policy settings_read on settings for select using (true);
create policy settings_owner on settings for update to authenticated
  using (my_role() = 'owner') with check (my_role() = 'owner');

create policy categories_read on categories for select using (true);
create policy categories_owner on categories for all to authenticated
  using (my_role() = 'owner') with check (my_role() = 'owner');

create policy products_read on products for select using (true);
create policy products_owner on products for all to authenticated
  using (my_role() = 'owner') with check (my_role() = 'owner');

-- orders: staff hanya baca; semua tulis lewat RPC di atas. anon tidak bisa baca order.
create policy orders_staff_read on orders for select to authenticated
  using (my_role() is not null);

alter publication supabase_realtime add table orders;

-- ===== Storage foto produk =====
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do nothing;
-- storage.objects tidak ikut terhapus oleh reset/down; jaga agar migrasi bisa diulang
drop policy if exists product_images_owner on storage.objects;
create policy product_images_owner on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.my_role() = 'owner')
  with check (bucket_id = 'product-images' and public.my_role() = 'owner');
