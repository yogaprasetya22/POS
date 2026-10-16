-- Proteksi spam pesanan publik (tanpa cron): saat ada pesanan baru, pesanan UNPAID > 45 menit
-- otomatis EXPIRED, lalu pesanan ditolak bila toko sudah punya 40 pesanan UNPAID aktif.
create or replace function create_order(p_store_id uuid, p_customer_name text, p_order_type order_type, p_table_no text, p_lines jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Jakarta')::date;
  seq int; open_ boolean; unpaid int; priced record; r jsonb;
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

-- Pembersihan oleh layar kasir (tiap menit) memakai status yang sama
create or replace function expire_stale_orders() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  update orders set status = 'EXPIRED'
    where status = 'UNPAID' and created_at < now() - interval '45 minutes' and store_id = my_store();
end $$;
