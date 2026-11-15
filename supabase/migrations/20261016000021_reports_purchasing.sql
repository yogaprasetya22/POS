-- Tahap 4: pemakaian bahan per shift + laba kotor per menu.
-- Tahap 5: pembelian lengkap (pemasok, daftar belanja → dipesan → diterima sebagian/penuh, utang ke pemasok).

-- ===== Tahap 4: laporan =====
-- Bahan yang terpakai (terjual) dan terbuang selama satu shift, dalam jumlah dan rupiah (harga beli sekarang).
create function shift_stock(p_shift uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sh shifts; res jsonb;
begin
  select * into sh from shifts where id = p_shift and store_id = my_store();
  if not found or not (is_manager() or sh.opened_by = auth.uid()) then raise exception 'forbidden'; end if;
  with m as (
    select i.name, i.unit, case when sm.reason = 'WASTE' then 'wasted' else 'used' end as kind,
           -sum(sm.delta) as qty, round(-sum(sm.delta) * i.cost)::int as value
      from stock_movements sm join ingredients i on i.id = sm.ingredient_id
     where sm.store_id = sh.store_id and sm.reason in ('SALE', 'VOID', 'WASTE')
       and sm.created_at >= sh.opened_at and sm.created_at <= coalesce(sh.closed_at, now())
     group by i.id, i.name, i.unit, i.cost, 3
    having sum(sm.delta) <> 0
  )
  select jsonb_build_object(
    'used', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'unit', unit, 'qty', qty, 'value', value) order by value desc) from m where kind = 'used'), '[]'::jsonb),
    'wasted', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'unit', unit, 'qty', qty, 'value', value) order by value desc) from m where kind = 'wasted'), '[]'::jsonb),
    'used_value', coalesce((select sum(value) from m where kind = 'used'), 0),
    'wasted_value', coalesce((select sum(value) from m where kind = 'wasted'), 0)
  ) into res;
  return res;
end $$;

-- Laba kotor per menu: penjualan menu − biaya bahan (resep × harga beli sekarang).
create function profit_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  with sold as (
    select (it->>'product_id')::uuid as product_id, max(it->>'name') as name,
           sum((it->>'qty')::int) as qty, sum((it->>'subtotal')::int) as revenue
      from orders o, jsonb_array_elements(o.items) it
     where o.store_id = my_store() and o.paid_at is not null and o.status in ('IN_KITCHEN', 'READY', 'COMPLETED')
       and o.business_day between p_from and p_to
     group by 1
  ), portion as (
    select r.product_id, sum(r.qty * i.cost) as cost
      from recipes r join ingredients i on i.id = r.ingredient_id
     where r.store_id = my_store() group by 1
  ), rows as (
    select s.name, s.qty, s.revenue, round(s.qty * coalesce(p.cost, 0))::int as cogs, p.product_id is not null as has_recipe
      from sold s left join portion p on p.product_id = s.product_id
  )
  select jsonb_build_object(
    'revenue', coalesce((select sum(revenue) from rows), 0),
    'cogs', coalesce((select sum(cogs) from rows), 0),
    'waste_value', coalesce((select round(-sum(sm.delta * i.cost))::int from stock_movements sm join ingredients i on i.id = sm.ingredient_id
       where sm.store_id = my_store() and sm.reason = 'WASTE' and (sm.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to), 0),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue, 'cogs', cogs, 'has_recipe', has_recipe) order by revenue - cogs desc) from rows), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- ===== Tahap 5: pemasok =====
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  phone text not null default '' check (length(phone) <= 20),
  note text not null default '' check (length(note) <= 200),
  is_active boolean not null default true
);
create unique index suppliers_name_idx on suppliers (store_id, lower(name));
alter table suppliers enable row level security;
create policy suppliers_read on suppliers for select to authenticated using (can_do('purchase') and store_id = my_store());
revoke all on suppliers from anon;
revoke insert, update, delete on suppliers from authenticated;

create function save_supplier(p_id uuid, p_name text, p_phone text default '', p_note text default '', p_active boolean default true) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; nm text := left(btrim(coalesce(p_name, '')), 60);
begin
  if not can_do('purchase') then raise exception 'forbidden'; end if;
  if nm = '' then raise exception 'Nama pemasok belum diisi'; end if;
  begin
    if p_id is null then
      insert into suppliers (store_id, name, phone, note, is_active)
        values (my_store(), nm, left(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), 20), left(coalesce(p_note, ''), 200), coalesce(p_active, true))
        returning id into sid;
    else
      update suppliers set name = nm, phone = left(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), 20), note = left(coalesce(p_note, ''), 200), is_active = coalesce(p_active, true)
        where id = p_id and store_id = my_store() returning id into sid;
      if sid is null then raise exception 'Pemasok tidak ditemukan'; end if;
    end if;
  exception when unique_violation then raise exception 'Pemasok "%" sudah ada. Pakai nama lain.', nm;
  end;
  return sid;
end $$;

-- ===== Pembelian bertahap =====
alter table purchases
  add column supplier_id uuid references suppliers on delete set null,
  add column status text not null default 'RECEIVED' check (status in ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED')),
  add column unpaid int not null default 0 check (unpaid >= 0),       -- utang ke pemasok yang belum dibayar
  add column ordered_at timestamptz,
  add column received_at timestamptz;
update purchases set received_at = created_at;
-- null = diterima penuh sekaligus (Barang masuk sederhana); angka = yang sudah datang untuk pembelian bertahap
alter table purchase_items add column received_qty numeric(12, 3) check (received_qty >= 0);

drop policy purchases_read on purchases;
create policy purchases_read on purchases for select to authenticated using (can_do('purchase') and store_id = my_store());
drop policy purchase_items_read on purchase_items;
create policy purchase_items_read on purchase_items for select to authenticated using (can_do('purchase') and store_id = my_store());

-- Buat/ubah daftar belanja. p_items: [{ ingredient_id, qty (satuan beli), unit_price (Rp per satuan beli) }]
create function save_purchase_order(p_id uuid, p_supplier_id uuid, p_items jsonb, p_note text default '', p_ordered boolean default false) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare pid uuid := p_id; sup suppliers; it jsonb; ing ingredients; q numeric; price int; v_total int := 0; po purchases;
begin
  if not can_do('purchase') then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Isi minimal satu bahan di daftar belanja'; end if;
  if p_supplier_id is not null then
    select * into sup from suppliers where id = p_supplier_id and store_id = my_store();
    if sup.id is null then raise exception 'Pemasok tidak ditemukan'; end if;
  end if;
  if p_ordered and sup.id is null then raise exception 'Pilih pemasok dulu sebelum menandai "Sudah dipesan"'; end if;

  if pid is null then
    insert into purchases (store_id, supplier, supplier_id, total, paid_from, note, created_by, status)
      values (my_store(), coalesce(sup.name, ''), sup.id, 0, 'OTHER', left(coalesce(p_note, ''), 200), auth.uid(), 'DRAFT')
      returning id into pid;
  else
    select * into po from purchases where id = pid and store_id = my_store() for update;
    if po.id is null or po.status not in ('DRAFT', 'ORDERED') then raise exception 'Daftar belanja ini sudah tidak bisa diubah'; end if;
    if exists (select 1 from purchase_items where purchase_id = pid and coalesce(received_qty, 0) > 0) then
      raise exception 'Sebagian barang sudah diterima, daftar tidak bisa diubah lagi';
    end if;
    delete from purchase_items where purchase_id = pid;
    update purchases set supplier = coalesce(sup.name, ''), supplier_id = sup.id, note = left(coalesce(p_note, ''), 200) where id = pid;
  end if;

  for it in select value from jsonb_array_elements(p_items) loop
    select * into ing from ingredients where id = (it->>'ingredient_id')::uuid and store_id = my_store();
    if ing.id is null then raise exception 'Bahan tidak ditemukan'; end if;
    q := (it->>'qty')::numeric;
    price := coalesce((it->>'unit_price')::int, 0);
    if q is null or q <= 0 then raise exception 'Jumlah % harus lebih dari 0', ing.name; end if;
    if price < 0 then raise exception 'Harga % tidak boleh minus', ing.name; end if;
    insert into purchase_items (purchase_id, store_id, ingredient_id, qty, unit_price, stock_qty, received_qty)
      values (pid, my_store(), ing.id, q, price, q * ing.purchase_factor, 0);
    v_total := v_total + round(q * price)::int;
  end loop;

  update purchases set total = v_total, status = case when p_ordered then 'ORDERED' else 'DRAFT' end,
      ordered_at = case when p_ordered then coalesce(ordered_at, now()) end
    where id = pid;
  return pid;
end $$;

-- Terima barang (boleh sebagian). p_items: [{ item_id, qty (satuan beli yang datang sekarang) }]
-- p_pay: CASH_DRAWER (kas keluar di shift), OTHER (uang lain), LATER (jadi utang ke pemasok).
-- p_close: sisa yang belum datang dianggap tidak jadi datang.
create function receive_purchase_order(p_id uuid, p_items jsonb, p_pay text, p_close boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare po purchases; sh uuid; it jsonb; pi purchase_items; ing ingredients; q numeric; add_qty numeric; base numeric; v_value int := 0; n int := 0; done boolean;
begin
  if not can_do('purchase') then raise exception 'forbidden'; end if;
  if p_pay not in ('CASH_DRAWER', 'OTHER', 'LATER') then raise exception 'Pilih cara bayar belanja'; end if;
  select * into po from purchases where id = p_id and store_id = my_store() for update;
  if po.id is null or po.status not in ('DRAFT', 'ORDERED') then raise exception 'Pembelian ini sudah selesai atau dibatalkan'; end if;
  if p_pay = 'CASH_DRAWER' then
    select id into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
    if sh is null then raise exception 'Laci kasir belum dibuka atas namamu. Buka shift dulu, atau pilih cara bayar lain.'; end if;
  end if;

  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    q := (it->>'qty')::numeric;
    if q is null or q = 0 then continue; end if;
    select * into pi from purchase_items where id = (it->>'item_id')::bigint and purchase_id = po.id for update;
    if pi.id is null then raise exception 'Baris pembelian tidak ditemukan'; end if;
    select * into ing from ingredients where id = pi.ingredient_id for update;
    if q < 0 or q > pi.qty - coalesce(pi.received_qty, 0) then
      raise exception 'Jumlah % yang datang melebihi sisa pesanan (% %)', ing.name, trim_scale(pi.qty - coalesce(pi.received_qty, 0)), coalesce(nullif(ing.purchase_unit, ''), ing.unit);
    end if;
    add_qty := q * ing.purchase_factor;
    base := greatest(ing.stock, 0);
    update ingredients set stock = stock + add_qty, cost = round((base * ing.cost + q * pi.unit_price) / (base + add_qty), 2) where id = ing.id;
    update purchase_items set received_qty = coalesce(received_qty, 0) + q where id = pi.id;
    insert into stock_movements (store_id, ingredient_id, delta, reason, note, user_id)
      values (my_store(), ing.id, add_qty, 'PURCHASE', left(case when po.supplier = '' then 'Barang masuk' else 'Dari ' || po.supplier end, 100), auth.uid());
    v_value := v_value + round(q * pi.unit_price)::int;
    n := n + 1;
  end loop;
  if n = 0 and not p_close then raise exception 'Isi jumlah barang yang datang'; end if;

  done := p_close or not exists (select 1 from purchase_items where purchase_id = po.id and coalesce(received_qty, 0) < qty);
  update purchases set
      status = case when done then 'RECEIVED' else 'ORDERED' end,
      ordered_at = coalesce(ordered_at, now()),
      received_at = case when done then now() end,
      unpaid = unpaid + case when p_pay = 'LATER' then v_value else 0 end,
      paid_from = case when p_pay = 'LATER' then paid_from else p_pay end,
      shift_id = coalesce(sh, shift_id)
    where id = po.id;
  if sh is not null and v_value > 0 then
    insert into cash_movements (shift_id, store_id, kind, amount, reason, user_id)
      values (sh, my_store(), 'OUT', v_value, left('Belanja bahan' || case when po.supplier = '' then '' else ' · ' || po.supplier end, 100), auth.uid());
  end if;
  perform audit(my_store(), 'purchase.receive', 'purchase', po.id, jsonb_build_object('value', v_value, 'items', n, 'pay', p_pay, 'done', done));
  return jsonb_build_object('value', v_value, 'items', n, 'done', done);
end $$;

-- Bayar utang ke pemasok (boleh dicicil).
create function pay_purchase(p_id uuid, p_amount int, p_paid_from text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare po purchases; sh uuid;
begin
  if not can_do('purchase') then raise exception 'forbidden'; end if;
  if p_paid_from not in ('CASH_DRAWER', 'OTHER') then raise exception 'Pilih sumber uang'; end if;
  select * into po from purchases where id = p_id and store_id = my_store() for update;
  if po.id is null or po.unpaid = 0 then raise exception 'Pembelian ini tidak punya utang'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > po.unpaid then raise exception 'Jumlah bayar harus antara Rp1 dan sisa utang'; end if;
  if p_paid_from = 'CASH_DRAWER' then
    select id into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
    if sh is null then raise exception 'Laci kasir belum dibuka atas namamu. Buka shift dulu, atau pilih "Bukan dari laci".'; end if;
    insert into cash_movements (shift_id, store_id, kind, amount, reason, user_id)
      values (sh, my_store(), 'OUT', p_amount, left('Bayar utang' || case when po.supplier = '' then '' else ' · ' || po.supplier end, 100), auth.uid());
  end if;
  update purchases set unpaid = unpaid - p_amount where id = po.id;
  perform audit(my_store(), 'purchase.pay', 'purchase', po.id, jsonb_build_object('amount', p_amount, 'from', p_paid_from));
end $$;

create function cancel_purchase(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not can_do('purchase') then raise exception 'forbidden'; end if;
  if exists (select 1 from purchase_items where purchase_id = p_id and store_id = my_store() and coalesce(received_qty, 0) > 0) then
    raise exception 'Sebagian barang sudah diterima. Pakai "Sisanya tidak jadi datang" saat menerima barang.';
  end if;
  update purchases set status = 'CANCELLED' where id = p_id and store_id = my_store() and status in ('DRAFT', 'ORDERED');
  if not found then raise exception 'Pembelian ini sudah tidak bisa dibatalkan'; end if;
  perform audit(my_store(), 'purchase.cancel', 'purchase', p_id, '{}'::jsonb);
end $$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('shift_stock', 'profit_report', 'save_supplier', 'save_purchase_order', 'receive_purchase_order', 'pay_purchase', 'cancel_purchase') loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
