-- Tambah dukungan kode promo dan periode kampanye (validitas tanggal)
alter table promotions add column if not exists code text check (code is null or length(btrim(code)) >= 2);
alter table promotions add column if not exists start_at timestamptz;
alter table promotions add column if not exists end_at timestamptz;

-- Index untuk kode promo unik per store jika ada kodenya
create unique index if not exists promotions_store_code_idx on promotions (store_id, upper(btrim(code))) where code is not null;

-- Tambah promo_code di tabel orders
alter table orders add column if not exists promo_code text;

-- Drop function calculate_order_promo lama agar signature baru dapat terpasang
drop function if exists calculate_order_promo(uuid, jsonb, int);

-- Helper to calculate the best promo discount for an order in database with promo code & period support
create or replace function calculate_order_promo(
  p_store_id uuid,
  p_items jsonb,
  p_subtotal int,
  p_promo_code text default null,
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
  now_ts timestamptz := now();
  norm_code text := upper(btrim(coalesce(p_promo_code, '')));
begin
  for p in select * from promotions where store_id = p_store_id and is_active = true loop
    applicable_discount := 0;

    -- Check campaign period
    if p.start_at is not null and now_ts < p.start_at then
      continue;
    end if;
    if p.end_at is not null and now_ts > p.end_at then
      continue;
    end if;

    -- Check promo code requirement:
    -- Jika promo memiliki kode, pelanggan wajib memasukkan kode yang cocok.
    if p.code is not null and btrim(p.code) <> '' then
      if upper(btrim(p.code)) <> norm_code then
        continue;
      end if;
    end if;

    -- Check min spend
    if p_subtotal < coalesce(p.min_spend, 0) then
      continue;
    end if;

    if p.type = 'BUY_X_GET_Y' then
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

-- Drop function create_order lama jika diperlukan untuk default param baru
drop function if exists create_order(uuid, text, order_type, text, jsonb);

-- Update create_order to calculate promo discount with promo code & store promo_code
create or replace function create_order(
  p_store_id uuid,
  p_customer_name text,
  p_order_type order_type,
  p_table_no text,
  p_lines jsonb,
  p_promo_code text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Jakarta')::date;
  seq int; open_ boolean; unpaid int; priced record; promo record; r jsonb;
  final_total int;
  norm_code text := upper(btrim(coalesce(p_promo_code, '')));
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
  select * into promo from calculate_order_promo(p_store_id, priced.items, priced.total, p_promo_code);

  final_total := greatest(0, priced.total - coalesce(promo.discount_amount, 0));

  insert into daily_counters as dc (store_id, day, n) values (p_store_id, d, 1)
    on conflict (store_id, day) do update set n = dc.n + 1
    returning dc.n into seq;

  insert into orders (
    store_id, queue_code, business_day, customer_name, order_type, table_no,
    items, total, discount_amount, promo_name, promo_code
  )
  values (
    p_store_id,
    'A-' || case when seq < 1000 then lpad(seq::text, 3, '0') else seq::text end,
    d, p_customer_name, p_order_type,
    case when p_order_type = 'DINE_IN' then left(btrim(p_table_no), 10) end,
    priced.items, final_total, coalesce(promo.discount_amount, 0), promo.promo_name,
    case when norm_code <> '' then norm_code else null end
  )
  returning jsonb_build_object(
    'id', id,
    'queue_code', queue_code,
    'total', total,
    'discount_amount', discount_amount,
    'promo_name', promo_name,
    'promo_code', promo_code
  ) into r;
  return r;
end $$;
