-- Promo & Diskon (Buy X Get Y, Diskon Persen, Diskon Nominal)
-- Mendukung scope: PRODUCT, CATEGORY, CART_TOTAL

create table promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  type text not null check (type in ('BUY_X_GET_Y', 'PERCENTAGE', 'FIXED_AMOUNT')),
  scope text not null check (scope in ('PRODUCT', 'CATEGORY', 'CART_TOTAL')),
  target_id uuid,
  buy_qty int not null default 2 check (buy_qty >= 1),
  get_qty int not null default 1 check (get_qty >= 1),
  discount_percent int not null default 0 check (discount_percent between 0 and 100),
  discount_amount int not null default 0 check (discount_amount >= 0),
  min_spend int not null default 0 check (min_spend >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index promotions_store_active_idx on promotions (store_id, is_active);

alter table promotions enable row level security;

-- Public can see active promotions for the store
create policy promotions_public_select on promotions for select using (is_active = true);

-- Staff with owner role can manage their store's promotions
create policy promotions_owner_all on promotions for all using (
  store_id = my_store() and my_role() = 'owner'
) with check (
  store_id = my_store() and my_role() = 'owner'
);

-- Super admin can read all promotions
create policy promotions_super_select on promotions for select using (is_super());

-- Add discount tracking to orders table
alter table orders add column if not exists discount_amount int not null default 0 check (discount_amount >= 0);
alter table orders add column if not exists promo_name text;

-- Helper to calculate the best promo discount for an order in database
create or replace function calculate_order_promo(
  p_store_id uuid,
  p_items jsonb,
  p_subtotal int,
  out discount_amount int,
  out promo_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  p record;
  it jsonb;
  prod products;
  applicable_discount int;
  matched_qty int;
  best_discount int := 0;
  best_promo_name text := null;
  prod_unit int;
  free_count int;
  group_total int;
begin
  for p in select * from promotions where store_id = p_store_id and is_active = true loop
    applicable_discount := 0;

    -- Check min spend
    if p_subtotal < coalesce(p.min_spend, 0) then
      continue;
    end if;

    if p.type = 'BUY_X_GET_Y' then
      -- Count matching items
      matched_qty := 0;
      prod_unit := 0;

      for it in select value from jsonb_array_elements(p_items) loop
        select * into prod from products where id = (it->>'product_id')::uuid;
        if found then
          if (p.scope = 'PRODUCT' and prod.id = p.target_id)
             or (p.scope = 'CATEGORY' and prod.category_id = p.target_id)
             or (p.scope = 'CART_TOTAL') then
            matched_qty := matched_qty + (it->>'qty')::int;
            if prod_unit = 0 or (it->>'unit_price')::int < prod_unit then
              prod_unit := (it->>'unit_price')::int;
            end if;
          end if;
        end if;
      end loop;

      if matched_qty >= (p.buy_qty + p.get_qty) and prod_unit > 0 then
        free_count := (matched_qty / (p.buy_qty + p.get_qty)) * p.get_qty;
        applicable_discount := free_count * prod_unit;
      end if;

    elsif p.type = 'PERCENTAGE' then
      if p.scope = 'CART_TOTAL' then
        applicable_discount := (p_subtotal * p.discount_percent) / 100;
      else
        group_total := 0;
        for it in select value from jsonb_array_elements(p_items) loop
          select * into prod from products where id = (it->>'product_id')::uuid;
          if found then
            if (p.scope = 'PRODUCT' and prod.id = p.target_id)
               or (p.scope = 'CATEGORY' and prod.category_id = p.target_id) then
              group_total := group_total + (it->>'subtotal')::int;
            end if;
          end if;
        end loop;
        applicable_discount := (group_total * p.discount_percent) / 100;
      end if;

    elsif p.type = 'FIXED_AMOUNT' then
      if p.scope = 'CART_TOTAL' then
        applicable_discount := p.discount_amount;
      else
        for it in select value from jsonb_array_elements(p_items) loop
          select * into prod from products where id = (it->>'product_id')::uuid;
          if found then
            if (p.scope = 'PRODUCT' and prod.id = p.target_id)
               or (p.scope = 'CATEGORY' and prod.category_id = p.target_id) then
              applicable_discount := applicable_discount + p.discount_amount;
            end if;
          end if;
        end loop;
      end if;
    end if;

    -- Cap discount to subtotal
    applicable_discount := least(applicable_discount, p_subtotal);

    -- Keep best deal
    if applicable_discount > best_discount then
      best_discount := applicable_discount;
      best_promo_name := p.name;
    end if;
  end loop;

  discount_amount := best_discount;
  promo_name := best_promo_name;
end $$;

-- Update create_order to calculate promo discount automatically
create or replace function create_order(
  p_store_id uuid,
  p_customer_name text,
  p_order_type order_type,
  p_table_no text,
  p_lines jsonb
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Jakarta')::date;
  seq int; open_ boolean; unpaid int; priced record; promo record; r jsonb;
  final_total int;
begin
  select is_active into open_ from stores where id = p_store_id;
  if open_ is null then raise exception 'Toko tidak ditemukan'; end if;
  if not open_ then raise exception 'Toko sedang tutup'; end if;

  p_customer_name := btrim(coalesce(p_customer_name, ''));
  if p_customer_name = '' or length(p_customer_name) > 40 then raise exception 'invalid name'; end if;
  if p_order_type = 'DINE_IN' and coalesce(btrim(p_table_no), '') = '' then raise exception 'table required'; end if;

  update orders set status = 'EXPIRED'
    where store_id = p_store_id and status = 'UNPAID' and created_at < now() - interval '45 minutes';
  select count(*) into unpaid from orders where store_id = p_store_id and status = 'UNPAID';
  if unpaid >= 40 then raise exception 'Antrean sedang penuh, coba lagi beberapa menit lagi'; end if;

  select * into priced from price_lines(p_store_id, p_lines);
  select * into promo from calculate_order_promo(p_store_id, priced.items, priced.total);

  final_total := greatest(0, priced.total - coalesce(promo.discount_amount, 0));

  insert into daily_counters as dc (store_id, day, n) values (p_store_id, d, 1)
    on conflict (store_id, day) do update set n = dc.n + 1
    returning dc.n into seq;

  insert into orders (
    store_id, queue_code, business_day, customer_name, order_type, table_no,
    items, total, discount_amount, promo_name
  )
  values (
    p_store_id,
    'A-' || case when seq < 1000 then lpad(seq::text, 3, '0') else seq::text end,
    d, p_customer_name, p_order_type,
    case when p_order_type = 'DINE_IN' then left(btrim(p_table_no), 10) end,
    priced.items, final_total, coalesce(promo.discount_amount, 0), promo.promo_name
  )
  returning jsonb_build_object(
    'id', id,
    'queue_code', queue_code,
    'total', total,
    'discount_amount', discount_amount,
    'promo_name', promo_name
  ) into r;
  return r;
end $$;

-- Update update_order_lines to recalculate promo
create or replace function update_order_lines(p_order_id uuid, p_lines jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  priced record;
  promo record;
  final_total int;
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  select * into priced from price_lines(my_store(), p_lines);
  select * into promo from calculate_order_promo(my_store(), priced.items, priced.total);

  final_total := greatest(0, priced.total - coalesce(promo.discount_amount, 0));

  update orders set
    items = priced.items,
    total = final_total,
    discount_amount = coalesce(promo.discount_amount, 0),
    promo_name = promo.promo_name
  where id = p_order_id and status = 'UNPAID' and store_id = my_store();
  if not found then raise exception 'Pesanan tidak bisa diubah'; end if;
end $$;
