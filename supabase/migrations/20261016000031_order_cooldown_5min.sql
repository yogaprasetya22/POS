-- 20261016000031_order_cooldown_5min.sql
-- Cooldown 5 menit untuk pesanan publik yang menunggu pembayaran

create or replace function expire_stale_orders() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update orders set status = 'EXPIRED'
    where status = 'UNPAID' and created_by is null and created_at < now() - interval '5 minutes';
end $$;

-- Update create_order untuk menerapkan batas kedaluwarsa 5 menit pada pesanan publik
create or replace function create_order(
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
    -- Pesanan publik belum dibayar > 5 menit otomatis kedaluwarsa (cooldown 5 menit)
    update orders set status = 'EXPIRED'
      where store_id = p_store_id and status = 'UNPAID' and created_by is null and created_at < now() - interval '5 minutes';

    select count(*) into unpaid from orders where store_id = p_store_id and status = 'UNPAID' and created_by is null;
    if unpaid >= 40 then raise exception 'Antrean sedang penuh, coba lagi beberapa menit lagi'; end if;

    if p_order_type = 'DINE_IN' and (select count(*) from orders where store_id = p_store_id and status = 'UNPAID'
         and created_by is null and table_no = left(tbl, 10) and created_at > now() - interval '5 minutes') >= 1 then
      raise exception 'Meja ini sedang menunggu pembayaran. Selesaikan pembayaran dalam 5 menit atau tunggu pesanan kedaluwarsa.';
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

-- Status pesanan untuk pembeli: auto-expire jika pesanan menggantung > 5 menit
create or replace function public_order_status(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  ord orders;
begin
  select * into ord from orders where id = p_id;
  if not found then return null; end if;

  if ord.status = 'UNPAID' and ord.created_by is null and ord.created_at < now() - interval '5 minutes' then
    update orders set status = 'EXPIRED' where id = p_id;
    ord.status := 'EXPIRED';
  end if;

  return jsonb_build_object(
    'id', ord.id,
    'queue_code', ord.queue_code,
    'status', ord.status,
    'total', ord.total,
    'order_type', ord.order_type,
    'table_no', ord.table_no,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i->>'name', 'qty', (i->>'qty')::int)), '[]'::jsonb) from jsonb_array_elements(ord.items) i),
    'paid_at', ord.paid_at,
    'created_at', ord.created_at
  );
end $$;
