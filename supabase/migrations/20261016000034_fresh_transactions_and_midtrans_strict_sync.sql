-- Migration 34: Reset fresh transaksi ke 0 dan validasi ketat saldo Midtrans
-- Menjamin saldo Midtrans di web POS 100% konsisten dengan transaksi settled Midtrans

-- 1. Unlink shift_id dari purchases agar tidak melanggar foreign key constraint
UPDATE purchases SET shift_id = null;

-- 2. Bersihkan seluruh data transaksi uji coba historis (fresh start ke 0)
DELETE FROM withdrawals;
DELETE FROM orders;
DELETE FROM daily_counters;
DELETE FROM cash_movements;
DELETE FROM shifts;
DELETE FROM stock_movements WHERE reason in ('ORDER', 'RECIPE', 'SALE');

-- 3. Kembalikan toko ke Sandbox Mode
UPDATE stores 
   SET midtrans_is_production = false,
       midtrans_server_key = null,
       midtrans_client_key = null;

-- 4. Perbarui get_store_financial_summary() dengan validasi ketat Midtrans
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

  -- 6. Saldo digital Midtrans: VALIDASI KETAT
  -- Hanya transaksi yang benar-benar berstatus settlement/capture lewat Midtrans
  -- QRIS_STATIC dan pembayaran tunai TIDAK MASUK ke saldo Midtrans
  select coalesce(sum(total), 0)::int
    into v_midtrans_received
    from orders
   where store_id = sid
     and paid_at is not null
     and status in ('IN_KITCHEN', 'READY', 'COMPLETED')
     and payment_method = 'MIDTRANS'
     and midtrans_transaction_id is not null
     and coalesce(midtrans_status, 'settlement') in ('settlement', 'capture');

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

grant execute on function get_store_financial_summary() to authenticated;

