-- Migration: 20261016000033_financial_balance_withdrawals
-- Ringkasan Laba Bersih, Laba Kotor, Saldo Kas Laci & Midtrans Realtime, serta Penarikan Dana (Withdrawals).

-- 1. Tambah kolom rekening bank dan Iris API key di stores jika belum ada
alter table stores
  add column if not exists bank_name text not null default '',
  add column if not exists account_number text not null default '',
  add column if not exists account_holder text not null default '',
  add column if not exists midtrans_iris_api_key text not null default '';

-- 2. Buat tabel withdrawals (pencatatan penarikan dana standar industri)
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  amount int not null check (amount >= 10000),
  fee int not null default 0,
  net_amount int not null,
  channel text not null default 'MIDTRANS' check (channel in ('MIDTRANS', 'CASH_DRAWER')),
  bank_name text not null check (length(btrim(bank_name)) between 2 and 50),
  account_number text not null check (length(btrim(account_number)) between 4 and 35),
  account_holder text not null check (length(btrim(account_holder)) between 2 and 100),
  status text not null default 'COMPLETED' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
  reference_no text not null unique,
  payout_id text default null,
  note text not null default '' check (length(note) <= 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz default now()
);

create index if not exists withdrawals_store_idx on withdrawals (store_id, created_at desc);
create index if not exists withdrawals_ref_idx on withdrawals (reference_no);

alter table withdrawals enable row level security;

drop policy if exists withdrawals_manager_read on withdrawals;
create policy withdrawals_manager_read on withdrawals
  for select to authenticated
  using (is_manager() and store_id = my_store());

revoke all on withdrawals from anon;
revoke insert, update, delete on withdrawals from authenticated;

-- 3. Fungsi ringkasan keuangan real-time: Laba Kotor, Laba Bersih, Saldo Laci, dan Saldo Midtrans
create or replace function get_store_financial_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid := my_store();
  today date := today_jkt();
  v_gross_sales int := 0;
  v_discounts int := 0;
  v_net_sales int := 0;
  v_orders_count int := 0;
  v_cogs int := 0;
  v_waste int := 0;
  v_cash_expenses int := 0;
  v_gross_profit int := 0;
  v_net_profit int := 0;
  v_drawer_balance int := 0;
  v_active_shift record;
  v_cur_shift_id uuid;
  v_midtrans_received int := 0;
  v_midtrans_withdrawn int := 0;
  v_midtrans_available int := 0;
  v_store record;
begin
  if not is_manager() then raise exception 'forbidden'; end if;

  select bank_name, account_number, account_holder into v_store
    from stores where id = sid;

  -- 1. Penjualan hari ini
  select
    coalesce(sum(total), 0)::int,
    coalesce(sum(discount_amount + voucher_discount + points_discount), 0)::int,
    count(*)::int
  into v_net_sales, v_discounts, v_orders_count
  from orders
  where store_id = sid
    and business_day = today
    and paid_at is not null
    and status in ('IN_KITCHEN', 'READY', 'COMPLETED');

  v_gross_sales := v_net_sales + v_discounts;

  -- 2. HPP / Modal bahan resep hari ini
  with sold as (
    select (it->>'product_id')::uuid as product_id,
           sum((it->>'qty')::int) as qty
      from orders o, jsonb_array_elements(o.items) it
     where o.store_id = sid and o.paid_at is not null and o.status in ('IN_KITCHEN', 'READY', 'COMPLETED')
       and o.business_day = today
     group by 1
  ), portion as (
    select r.product_id, sum(r.qty * i.cost) as cost
      from recipes r join ingredients i on i.id = r.ingredient_id
     where r.store_id = sid group by 1
  )
  select coalesce(round(sum(s.qty * coalesce(p.cost, 0)))::int, 0)
    into v_cogs
    from sold s left join portion p on p.product_id = s.product_id;

  -- 3. Nilai bahan terbuang (waste) hari ini
  select coalesce(round(-sum(sm.delta * i.cost))::int, 0)
    into v_waste
    from stock_movements sm join ingredients i on i.id = sm.ingredient_id
   where sm.store_id = sid and sm.reason = 'WASTE'
     and (sm.created_at at time zone 'Asia/Jakarta')::date = today;

  -- 4. Beban pengeluaran kas kecil hari ini
  select coalesce(sum(amount)::int, 0)
    into v_cash_expenses
    from cash_movements
   where store_id = sid and kind = 'OUT'
     and (created_at at time zone 'Asia/Jakarta')::date = today;

  -- Laba kotor = Net sales - HPP bahan
  v_gross_profit := v_net_sales - v_cogs;
  -- Laba bersih = Laba kotor - Waste - Beban kas
  v_net_profit := v_gross_profit - v_waste - v_cash_expenses;

  -- 5. Saldo kas di laci kasir real-time
  select id, opened_at, opening_cash, opened_by into v_active_shift
    from shifts where store_id = sid and closed_at is null
   order by opened_at desc limit 1;

  if v_active_shift.id is not null then
    select expected into v_drawer_balance from shift_totals(v_active_shift.id);
  else
    select coalesce(counted_cash, expected_cash, opening_cash, 0) into v_drawer_balance
      from shifts where store_id = sid and closed_at is not null
     order by closed_at desc limit 1;
  end if;

  -- 6. Saldo digital Midtrans
  select coalesce(sum(total), 0)::int
    into v_midtrans_received
    from orders
   where store_id = sid
     and paid_at is not null
     and status in ('IN_KITCHEN', 'READY', 'COMPLETED')
     and (payment_method in ('QRIS_STATIC', 'MIDTRANS') or midtrans_snap_token is not null);

  select coalesce(sum(amount), 0)::int
    into v_midtrans_withdrawn
    from withdrawals
   where store_id = sid
     and channel = 'MIDTRANS'
     and status in ('COMPLETED', 'PROCESSING', 'PENDING');

  v_midtrans_available := greatest(0, v_midtrans_received - v_midtrans_withdrawn);

  return jsonb_build_object(
    'today_date', today,
    'today_orders_count', v_orders_count,
    'today_gross_sales', v_gross_sales,
    'today_discounts', v_discounts,
    'today_net_sales', v_net_sales,
    'today_cogs', v_cogs,
    'today_gross_profit', v_gross_profit,
    'today_waste', v_waste,
    'today_expenses', v_cash_expenses,
    'today_net_profit', v_net_profit,
    'gross_margin_percent', case when v_net_sales > 0 then round((v_gross_profit::numeric / v_net_sales::numeric) * 100, 1) else 0 end,
    'net_margin_percent', case when v_net_sales > 0 then round((v_net_profit::numeric / v_net_sales::numeric) * 100, 1) else 0 end,
    'cash_drawer_balance', coalesce(v_drawer_balance, 0),
    'has_active_shift', v_active_shift.id is not null,
    'midtrans_total_received', v_midtrans_received,
    'midtrans_total_withdrawn', v_midtrans_withdrawn,
    'midtrans_available_balance', v_midtrans_available,
    'bank_name', coalesce(v_store.bank_name, ''),
    'account_number', coalesce(v_store.account_number, ''),
    'account_holder', coalesce(v_store.account_holder, '')
  );
end $$;

-- 4. Fungsi eksekusi penarikan dana (Withdrawal)
create or replace function request_withdrawal(
  p_amount int,
  p_bank_name text,
  p_account_number text,
  p_account_holder text,
  p_note text default '',
  p_save_bank boolean default true
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  sid uuid := my_store();
  v_received int := 0;
  v_withdrawn int := 0;
  v_available int := 0;
  v_ref text;
  v_fee int := 0; -- Bebas biaya transfer antar bank standar industri
  v_net int;
  v_bank text := btrim(coalesce(p_bank_name, ''));
  v_acc_num text := btrim(coalesce(p_account_number, ''));
  v_acc_name text := btrim(coalesce(p_account_holder, ''));
  v_wid uuid;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 10000 then
    raise exception 'Minimal penarikan dana adalah Rp10.000';
  end if;
  if v_bank = '' then raise exception 'Nama bank tujuan belum dipilih'; end if;
  if v_acc_num = '' then raise exception 'Nomor rekening tujuan belum diisi'; end if;
  if v_acc_name = '' then raise exception 'Nama pemilik rekening belum diisi'; end if;

  -- Kunci store untuk mencegah race condition penarikan ganda bersamaan
  perform 1 from stores where id = sid for update;

  select coalesce(sum(total), 0)::int into v_received
    from orders
   where store_id = sid
     and paid_at is not null
     and status in ('IN_KITCHEN', 'READY', 'COMPLETED')
     and (payment_method in ('QRIS_STATIC', 'MIDTRANS') or midtrans_snap_token is not null);

  select coalesce(sum(amount), 0)::int into v_withdrawn
    from withdrawals
   where store_id = sid
     and channel = 'MIDTRANS'
     and status in ('COMPLETED', 'PROCESSING', 'PENDING');

  v_available := greatest(0, v_received - v_withdrawn);

  if p_amount > v_available then
    raise exception 'Saldo Midtrans tidak mencukupi. Saldo tersedia saat ini: Rp%', to_char(v_available, 'FM999,999,999');
  end if;

  v_net := p_amount - v_fee;
  v_ref := 'WD-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into withdrawals (
    store_id, amount, fee, net_amount, channel,
    bank_name, account_number, account_holder,
    status, reference_no, note, created_by
  ) values (
    sid, p_amount, v_fee, v_net, 'MIDTRANS',
    v_bank, v_acc_num, v_acc_name,
    'COMPLETED', v_ref, left(coalesce(p_note, ''), 200), auth.uid()
  ) returning id into v_wid;

  if coalesce(p_save_bank, true) then
    update stores set
      bank_name = v_bank,
      account_number = v_acc_num,
      account_holder = v_acc_name
    where id = sid;
  end if;

  perform audit(sid, 'finance.withdrawal', 'withdrawal', v_wid, jsonb_build_object(
    'amount', p_amount,
    'fee', v_fee,
    'reference_no', v_ref,
    'bank', v_bank,
    'account_number', v_acc_num,
    'account_holder', v_acc_name
  ));

  return jsonb_build_object(
    'id', v_wid,
    'reference_no', v_ref,
    'amount', p_amount,
    'fee', v_fee,
    'net_amount', v_net,
    'bank_name', v_bank,
    'account_number', v_acc_num,
    'account_holder', v_acc_name,
    'status', 'COMPLETED',
    'remaining_balance', v_available - p_amount,
    'message', 'Penarikan dana berhasil diproses.'
  );
end $$;

-- 5. Fungsi daftar riwayat penarikan dana
create or replace function get_withdrawals(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid := my_store();
  res jsonb;
begin
  if not is_manager() then raise exception 'forbidden'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'reference_no', w.reference_no,
    'amount', w.amount,
    'fee', w.fee,
    'net_amount', w.net_amount,
    'channel', w.channel,
    'bank_name', w.bank_name,
    'account_number', w.account_number,
    'account_holder', w.account_holder,
    'status', w.status,
    'note', w.note,
    'created_at', w.created_at,
    'processed_at', w.processed_at
  ) order by w.created_at desc), '[]'::jsonb)
  into res
  from (
    select * from withdrawals
     where store_id = sid
     order by created_at desc
     limit coalesce(p_limit, 50)
  ) w;

  return res;
end $$;

-- 6. Fungsi simpan rekening bank toko
create or replace function save_store_bank_account(
  p_bank_name text,
  p_account_number text,
  p_account_holder text
) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  update stores set
    bank_name = btrim(coalesce(p_bank_name, '')),
    account_number = btrim(coalesce(p_account_number, '')),
    account_holder = btrim(coalesce(p_account_holder, ''))
  where id = my_store();
end $$;

grant execute on function get_store_financial_summary() to authenticated;
grant execute on function request_withdrawal(int, text, text, text, text, boolean) to authenticated;
grant execute on function get_withdrawals(int) to authenticated;
grant execute on function save_store_bank_account(text, text, text) to authenticated;
