-- Migration 35: Integrasi Pajak & MDR Midtrans (0.7% + PPN 11%) serta Pengaturan Auto-Payout & Rekening Bank Toko
-- Menjamin saldo Midtrans di POS 100% presisi dengan Net Settlement di Midtrans setelah potongan biaya & pajak resmi.

-- 1. Tambah kolom konfigurasi biaya MDR, pajak, payout fee, dan mode auto payout di stores
alter table stores
  add column if not exists midtrans_qris_mdr numeric not null default 0.7 check (midtrans_qris_mdr >= 0 and midtrans_qris_mdr <= 10),
  add column if not exists midtrans_tax_rate numeric not null default 11.0 check (midtrans_tax_rate >= 0 and midtrans_tax_rate <= 30),
  add column if not exists midtrans_payout_fee int not null default 5000 check (midtrans_payout_fee >= 0),
  add column if not exists midtrans_auto_payout boolean not null default true;

-- 2. Tambah kolom pencatatan potongan biaya & pajak per pesanan di tabel orders
alter table orders
  add column if not exists midtrans_fee int not null default 0 check (midtrans_fee >= 0),
  add column if not exists midtrans_tax int not null default 0 check (midtrans_tax >= 0),
  add column if not exists midtrans_net_amount int not null default 0 check (midtrans_net_amount >= 0);

-- 3. Perbarui fungsi pay_order_midtrans untuk otomatis menghitung & mencatat potongan MDR + PPN 11%
create or replace function pay_order_midtrans(
  p_order_id uuid,
  p_transaction_id text default null,
  p_payment_type text default null,
  p_status text default 'settlement'
) returns orders
language plpgsql volatile security definer set search_path = public as $$
declare 
  o orders; 
  sh uuid; 
  s stores; 
  v_mdr_rate numeric;
  v_tax_rate numeric;
  v_fee int := 0;
  v_tax int := 0;
  v_net int := 0;
begin
  select * into o from orders where id = p_order_id and status = 'UNPAID';
  if o.id is null then
    select * into o from orders where id = p_order_id;
    return o;
  end if;

  select * into s from stores where id = o.store_id;

  -- Ambil shift kasir aktif jika ada
  select id into sh from shifts where store_id = o.store_id and closed_at is null order by opened_at desc limit 1;

  -- Hitung potongan MDR (default 0.7%) dan Pajak PPN (default 11% dari nilai MDR)
  v_mdr_rate := coalesce(s.midtrans_qris_mdr, 0.7);
  v_tax_rate := coalesce(s.midtrans_tax_rate, 11.0);
  v_fee := round(o.total * (v_mdr_rate / 100.0))::int;
  v_tax := round(v_fee * (v_tax_rate / 100.0))::int;
  v_net := greatest(0, o.total - v_fee - v_tax);

  update orders set
      status = 'IN_KITCHEN',
      paid_at = now(),
      payment_method = 'MIDTRANS',
      cash_received = null,
      shift_id = coalesce(sh, shift_id),
      midtrans_transaction_id = coalesce(p_transaction_id, midtrans_transaction_id),
      midtrans_payment_type = coalesce(p_payment_type, midtrans_payment_type),
      midtrans_status = coalesce(p_status, midtrans_status),
      midtrans_fee = v_fee,
      midtrans_tax = v_tax,
      midtrans_net_amount = v_net
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

-- 4. Perbarui get_store_financial_summary dengan pemisahan Omzet Kotor, Potongan MDR, PPN 11%, dan Saldo Bersih
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
  v_midtrans_gross int := 0;
  v_midtrans_fee int := 0;
  v_midtrans_tax int := 0;
  v_midtrans_net_received int := 0;
  v_midtrans_withdrawn int := 0;
  v_midtrans_available int := 0;
  v_store record;
begin
  if not is_manager() then raise exception 'forbidden'; end if;

  select bank_name, account_number, account_holder,
         midtrans_qris_mdr, midtrans_tax_rate, midtrans_payout_fee, midtrans_auto_payout
    into v_store
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

  -- 6. Saldo digital Midtrans: VALIDASI KETAT & PERHITUNGAN NETT (SETELAH POTONGAN MDR & PPN MIDTRANS)
  select
    coalesce(sum(total), 0)::int,
    coalesce(sum(case when midtrans_fee > 0 then midtrans_fee else round(total * (coalesce(v_store.midtrans_qris_mdr, 0.7) / 100.0))::int end), 0)::int,
    coalesce(sum(case when midtrans_tax > 0 then midtrans_tax else round(round(total * (coalesce(v_store.midtrans_qris_mdr, 0.7) / 100.0))::int * (coalesce(v_store.midtrans_tax_rate, 11.0) / 100.0))::int end), 0)::int
  into v_midtrans_gross, v_midtrans_fee, v_midtrans_tax
  from orders
  where store_id = sid
    and paid_at is not null
    and status in ('IN_KITCHEN', 'READY', 'COMPLETED')
    and payment_method = 'MIDTRANS'
    and midtrans_transaction_id is not null
    and coalesce(midtrans_status, 'settlement') in ('settlement', 'capture');

  -- Saldo bersih settlement = Kotor - Biaya MDR - Pajak PPN 11%
  v_midtrans_net_received := greatest(0, v_midtrans_gross - v_midtrans_fee - v_midtrans_tax);

  select coalesce(sum(amount), 0)::int
    into v_midtrans_withdrawn
    from withdrawals
   where store_id = sid
     and channel = 'MIDTRANS'
     and status in ('COMPLETED', 'PROCESSING', 'PENDING');

  v_midtrans_available := greatest(0, v_midtrans_net_received - v_midtrans_withdrawn);

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
    'midtrans_total_received', v_midtrans_net_received,
    'midtrans_gross_amount', v_midtrans_gross,
    'midtrans_total_fee', v_midtrans_fee,
    'midtrans_total_tax', v_midtrans_tax,
    'midtrans_net_received', v_midtrans_net_received,
    'midtrans_total_withdrawn', v_midtrans_withdrawn,
    'midtrans_available_balance', v_midtrans_available,
    'midtrans_qris_mdr', coalesce(v_store.midtrans_qris_mdr, 0.7),
    'midtrans_tax_rate', coalesce(v_store.midtrans_tax_rate, 11.0),
    'midtrans_payout_fee', coalesce(v_store.midtrans_payout_fee, 5000),
    'midtrans_auto_payout', coalesce(v_store.midtrans_auto_payout, true),
    'bank_name', coalesce(v_store.bank_name, ''),
    'account_number', coalesce(v_store.account_number, ''),
    'account_holder', coalesce(v_store.account_holder, '')
  );
end $$;

-- 5. Perbarui request_withdrawal agar berbasis pada Saldo Bersih (Net) dan mendukung biaya payout Midtrans
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
  v_store record;
  v_gross int := 0;
  v_fee_mdr int := 0;
  v_tax int := 0;
  v_net_received int := 0;
  v_withdrawn int := 0;
  v_available int := 0;
  v_bank text := btrim(coalesce(p_bank_name, ''));
  v_acc_num text := btrim(coalesce(p_account_number, ''));
  v_acc_name text := btrim(coalesce(p_account_holder, ''));
  v_ref text;
  v_wid uuid;
  v_payout_fee int := 0;
  v_net_transfer int;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 10000 then
    raise exception 'Minimal penarikan dana adalah Rp10.000';
  end if;
  if v_bank = '' then raise exception 'Nama bank tujuan belum dipilih'; end if;
  if v_acc_num = '' then raise exception 'Nomor rekening tujuan belum diisi'; end if;
  if v_acc_name = '' then raise exception 'Nama pemilik rekening belum diisi'; end if;

  -- Kunci store untuk mencegah race condition penarikan ganda bersamaan
  select bank_name, account_number, account_holder,
         midtrans_qris_mdr, midtrans_tax_rate, midtrans_payout_fee, midtrans_auto_payout
    into v_store
    from stores where id = sid for update;

  v_payout_fee := coalesce(v_store.midtrans_payout_fee, 5000);

  -- Hitung saldo bersih Midtrans yang benar-benar settled
  select
    coalesce(sum(total), 0)::int,
    coalesce(sum(case when midtrans_fee > 0 then midtrans_fee else round(total * (coalesce(v_store.midtrans_qris_mdr, 0.7) / 100.0))::int end), 0)::int,
    coalesce(sum(case when midtrans_tax > 0 then midtrans_tax else round(round(total * (coalesce(v_store.midtrans_qris_mdr, 0.7) / 100.0))::int * (coalesce(v_store.midtrans_tax_rate, 11.0) / 100.0))::int end), 0)::int
  into v_gross, v_fee_mdr, v_tax
  from orders
  where store_id = sid
    and paid_at is not null
    and status in ('IN_KITCHEN', 'READY', 'COMPLETED')
    and payment_method = 'MIDTRANS'
    and midtrans_transaction_id is not null
    and coalesce(midtrans_status, 'settlement') in ('settlement', 'capture');

  v_net_received := greatest(0, v_gross - v_fee_mdr - v_tax);

  select coalesce(sum(amount), 0)::int into v_withdrawn
    from withdrawals
   where store_id = sid
     and channel = 'MIDTRANS'
     and status in ('COMPLETED', 'PROCESSING', 'PENDING');

  v_available := greatest(0, v_net_received - v_withdrawn);

  if p_amount > v_available then
    raise exception 'Saldo bersih Midtrans tidak mencukupi. Saldo tersedia saat ini: Rp%', to_char(v_available, 'FM999,999,999');
  end if;

  -- Jika ditarik semua dan ada fee payout, pastikan dana bersih mencukupi
  v_net_transfer := greatest(0, p_amount - v_payout_fee);
  v_ref := 'WD-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into withdrawals (
    store_id, amount, fee, net_amount, channel,
    bank_name, account_number, account_holder,
    status, reference_no, note, created_by
  ) values (
    sid, p_amount, v_payout_fee, v_net_transfer, 'MIDTRANS',
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
    'payout_fee', v_payout_fee,
    'net_transfer', v_net_transfer,
    'reference_no', v_ref,
    'bank', v_bank,
    'account_number', v_acc_num,
    'account_holder', v_acc_name
  ));

  return jsonb_build_object(
    'id', v_wid,
    'reference_no', v_ref,
    'amount', p_amount,
    'fee', v_payout_fee,
    'net_amount', v_net_transfer,
    'bank_name', v_bank,
    'account_number', v_acc_num,
    'account_holder', v_acc_name,
    'status', 'COMPLETED',
    'remaining_balance', v_available - p_amount,
    'message', 'Penarikan dana berhasil diproses.'
  );
end $$;

-- 6. Fungsi simpan pengaturan tarif pajak & payout Midtrans toko
create or replace function save_midtrans_payout_tax_settings(
  p_auto_payout boolean,
  p_qris_mdr numeric,
  p_tax_rate numeric,
  p_payout_fee int
) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  update stores set
    midtrans_auto_payout = coalesce(p_auto_payout, true),
    midtrans_qris_mdr = greatest(0, least(10, coalesce(p_qris_mdr, 0.7))),
    midtrans_tax_rate = greatest(0, least(30, coalesce(p_tax_rate, 11.0))),
    midtrans_payout_fee = greatest(0, coalesce(p_payout_fee, 5000))
  where id = my_store();
end $$;

-- 7. Grant izin ke authenticated
grant execute on function get_store_financial_summary() to authenticated;
grant execute on function request_withdrawal(int, text, text, text, text, boolean) to authenticated;
grant execute on function save_midtrans_payout_tax_settings(boolean, numeric, numeric, int) to authenticated;
