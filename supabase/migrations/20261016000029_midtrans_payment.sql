-- Migrasi: Integrasi Midtrans Payment Gateway & Pengaturan Dinamis

-- 1. Tambah enum value MIDTRANS jika belum ada
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'payment_method' and e.enumlabel = 'MIDTRANS'
  ) then
    alter type payment_method add value 'MIDTRANS';
  end if;
end $$;

-- 2. Tambah kolom konfigurasi Midtrans di tabel stores
alter table stores add column if not exists midtrans_enabled boolean not null default false;
alter table stores add column if not exists midtrans_is_production boolean not null default false;
alter table stores add column if not exists midtrans_server_key text default null;
alter table stores add column if not exists midtrans_client_key text default null;

-- 3. Tambah kolom pelacakan Midtrans di tabel orders
alter table orders add column if not exists midtrans_snap_token text default null;
alter table orders add column if not exists midtrans_redirect_url text default null;
alter table orders add column if not exists midtrans_transaction_id text default null;
alter table orders add column if not exists midtrans_payment_type text default null;
alter table orders add column if not exists midtrans_status text default null;

-- 4. Fungsi untuk menyimpan konfigurasi Midtrans toko (khusus owner)
create or replace function save_store_midtrans_settings(
  p_enabled boolean,
  p_is_production boolean,
  p_server_key text,
  p_client_key text
) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  update stores
  set midtrans_enabled = p_enabled,
      midtrans_is_production = p_is_production,
      midtrans_server_key = nullif(btrim(p_server_key), ''),
      midtrans_client_key = nullif(btrim(p_client_key), '')
  where id = my_store();

  perform audit(my_store(), 'store.midtrans_settings', 'store', my_store(),
    jsonb_build_object(
      'midtrans_enabled', p_enabled,
      'midtrans_is_production', p_is_production,
      'has_server_key', p_server_key is not null and btrim(p_server_key) <> '',
      'client_key', nullif(btrim(p_client_key), '')
    ));
end $$;

-- 5. Fungsi publik untuk mendapatkan konfigurasi client Midtrans (tanpa membuka server key!)
create or replace function get_store_midtrans_client_config(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s stores;
begin
  select * into s from stores where id = p_store_id and is_active = true;
  if s.id is null then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object(
    'enabled', coalesce(s.midtrans_enabled, false),
    'is_production', coalesce(s.midtrans_is_production, false),
    'client_key', coalesce(s.midtrans_client_key, '')
  );
end $$;

-- 6. Fungsi bayar pesanan via Midtrans (publik / webhook / kasir)
create or replace function pay_order_midtrans(
  p_order_id uuid,
  p_transaction_id text default null,
  p_payment_type text default null,
  p_status text default 'settlement'
) returns orders
language plpgsql volatile security definer set search_path = public as $$
declare o orders; sh uuid; s stores; it jsonb;
begin
  select * into o from orders where id = p_order_id and status = 'UNPAID';
  if o.id is null then
    select * into o from orders where id = p_order_id;
    return o;
  end if;

  select * into s from stores where id = o.store_id;

  -- Ambil shift kasir yang sedang aktif jika ada (opsional untuk online order)
  select id into sh from shifts where store_id = o.store_id and closed_at is null order by opened_at desc limit 1;

  update orders set
      status = 'IN_KITCHEN',
      paid_at = now(),
      payment_method = 'MIDTRANS',
      cash_received = null,
      shift_id = coalesce(sh, shift_id),
      midtrans_transaction_id = coalesce(p_transaction_id, midtrans_transaction_id),
      midtrans_payment_type = coalesce(p_payment_type, midtrans_payment_type),
      midtrans_status = coalesce(p_status, midtrans_status)
    where id = p_order_id and status = 'UNPAID'
    returning * into o;

  if o.id is null then raise exception 'Pembayaran Midtrans gagal atau pesanan sudah dibayar'; end if;

  -- Redeem voucher jika ada
  if o.voucher_id is not null then
    update vouchers set redeemed_at = now(), redeemed_order_id = o.id where id = o.voucher_id and redeemed_at is null;
  end if;

  -- Update member points jika ada
  if o.member_id is not null then
    update members set points = points - o.points_redeemed + o.points_earned, visits = visits + 1,
        total_spent = total_spent + o.total
      where id = o.member_id and points >= o.points_redeemed;
    if o.points_redeemed > 0 then
      insert into point_ledger (store_id, member_id, order_id, delta, reason, user_id)
        values (o.store_id, o.member_id, o.id, -o.points_redeemed, 'REDEEM', null);
    end if;
    if o.points_earned > 0 then
      insert into point_ledger (store_id, member_id, order_id, delta, reason, user_id)
        values (o.store_id, o.member_id, o.id, o.points_earned, 'EARN', null);
    end if;
  end if;

  return o;
end $$;

grant execute on function get_store_midtrans_client_config(uuid) to anon, authenticated;
grant execute on function pay_order_midtrans(uuid, text, text, text) to anon, authenticated;
grant execute on function save_store_midtrans_settings(boolean, boolean, text, text) to authenticated;

