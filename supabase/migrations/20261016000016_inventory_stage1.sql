-- Inventory tahap 1: barang masuk (pembelian sederhana), bahan terbuang, stok tidak boleh minus.
-- Rancangan: docs/rancangan-inventory-shift-pembelian.md

-- ===== Satuan beli =====
-- Stok & resep tetap dalam satuan pakai (mis. gram). Pembelian memakai satuan beli (mis. kg):
-- jumlah stok = jumlah beli x purchase_factor. purchase_unit kosong = beli dalam satuan pakai.
alter table ingredients
  add column purchase_unit text not null default '' check (length(purchase_unit) <= 12),
  add column purchase_factor numeric(12, 3) not null default 1 check (purchase_factor > 0);
grant insert (purchase_unit, purchase_factor) on ingredients to authenticated;
grant update (purchase_unit, purchase_factor) on ingredients to authenticated;

-- ===== Jenis pergerakan stok baru =====
alter table stock_movements drop constraint stock_movements_reason_check;
alter table stock_movements add constraint stock_movements_reason_check
  check (reason in ('SALE', 'VOID', 'RESTOCK', 'ADJUST', 'PURCHASE', 'WASTE', 'COUNT'));

-- ===== Stok tidak boleh minus =====
-- Berlaku untuk semua jalur (penjualan, terbuang, koreksi). Penambahan selalu boleh, supaya stok yang
-- terlanjur minus dari data lama tetap bisa dibetulkan lewat barang masuk / hitung stok.
create function trg_ingredients_no_negative() returns trigger
language plpgsql as $$
begin
  if new.stock < 0 and new.stock < old.stock then
    raise exception 'Stok % tidak cukup: butuh % %, tersisa % %. Ubah pesanan atau catat barang masuk dulu.',
      new.name, trim_scale(old.stock - new.stock), new.unit, trim_scale(greatest(old.stock, 0)), new.unit;
  end if;
  return new;
end $$;
create trigger ingredients_no_negative before update of stock on ingredients
  for each row execute function trg_ingredients_no_negative();

-- ===== Pembelian (barang masuk) =====
create table purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  supplier text not null default '' check (length(supplier) <= 60),
  total int not null check (total >= 0),
  paid_from text not null check (paid_from in ('CASH_DRAWER', 'OTHER')),
  shift_id uuid references shifts on delete set null,   -- terisi bila dibayar dari laci kasir
  note text not null default '' check (length(note) <= 200),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index purchases_store_idx on purchases (store_id, created_at desc);
alter table purchases enable row level security;
create policy purchases_read on purchases for select to authenticated using (is_manager() and store_id = my_store());
revoke all on purchases from anon;
revoke insert, update, delete on purchases from authenticated;

create table purchase_items (
  id bigint generated always as identity primary key,
  purchase_id uuid not null references purchases on delete cascade,
  store_id uuid not null references stores on delete cascade,
  ingredient_id uuid not null references ingredients on delete restrict,
  qty numeric(12, 3) not null check (qty > 0),          -- dalam satuan beli
  unit_price int not null check (unit_price >= 0),      -- Rp per satuan beli
  stock_qty numeric(12, 3) not null check (stock_qty > 0) -- yang masuk ke stok (satuan pakai)
);
create index purchase_items_purchase_idx on purchase_items (purchase_id);
alter table purchase_items enable row level security;
create policy purchase_items_read on purchase_items for select to authenticated using (is_manager() and store_id = my_store());
revoke all on purchase_items from anon;
revoke insert, update, delete on purchase_items from authenticated;

-- p_items: [{ "ingredient_id": uuid, "qty": angka (satuan beli), "unit_price": Rp per satuan beli }]
-- Harga beli bahan diperbarui dengan rata-rata tertimbang. Dibayar dari laci = kas keluar di shift yang sedang buka.
create function receive_purchase(p_supplier text, p_items jsonb, p_paid_from text, p_note text default '') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  pid uuid; sh uuid; it jsonb; ing ingredients; q numeric; price int; add_qty numeric; base numeric;
  v_total int := 0; n int := 0; who text := left(btrim(coalesce(p_supplier, '')), 60);
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_paid_from not in ('CASH_DRAWER', 'OTHER') then raise exception 'Pilih cara bayar belanja'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Isi minimal satu bahan yang dibeli'; end if;

  if p_paid_from = 'CASH_DRAWER' then
    select id into sh from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
    if sh is null then raise exception 'Laci kasir belum dibuka atas namamu. Buka shift dulu, atau pilih "Bukan dari laci".'; end if;
  end if;

  insert into purchases (store_id, supplier, total, paid_from, shift_id, note, created_by)
    values (my_store(), who, 0, p_paid_from, sh, left(coalesce(p_note, ''), 200), auth.uid())
    returning id into pid;

  for it in select value from jsonb_array_elements(p_items) loop
    select * into ing from ingredients where id = (it->>'ingredient_id')::uuid and store_id = my_store() for update;
    if ing.id is null then raise exception 'Bahan tidak ditemukan'; end if;
    q := (it->>'qty')::numeric;
    price := coalesce((it->>'unit_price')::int, 0);
    if q is null or q <= 0 then raise exception 'Jumlah % harus lebih dari 0', ing.name; end if;
    if price < 0 then raise exception 'Harga % tidak boleh minus', ing.name; end if;

    add_qty := q * ing.purchase_factor;
    base := greatest(ing.stock, 0);
    update ingredients set
        stock = stock + add_qty,
        -- rata-rata tertimbang per satuan pakai: (stok lama x harga lama + beli baru) / stok baru
        cost = round((base * ing.cost + q * price) / (base + add_qty), 2)
      where id = ing.id;
    insert into purchase_items (purchase_id, store_id, ingredient_id, qty, unit_price, stock_qty)
      values (pid, my_store(), ing.id, q, price, add_qty);
    insert into stock_movements (store_id, ingredient_id, delta, reason, note, user_id)
      values (my_store(), ing.id, add_qty, 'PURCHASE', left(case when who = '' then 'Barang masuk' else 'Dari ' || who end, 100), auth.uid());
    v_total := v_total + round(q * price)::int;
    n := n + 1;
  end loop;

  update purchases set total = v_total where id = pid;
  if sh is not null and v_total > 0 then
    insert into cash_movements (shift_id, store_id, kind, amount, reason, user_id)
      values (sh, my_store(), 'OUT', v_total, left('Belanja bahan' || case when who = '' then '' else ' · ' || who end, 100), auth.uid());
  end if;
  perform audit(my_store(), 'stock.purchase', 'purchase', pid,
    jsonb_build_object('supplier', who, 'total', v_total, 'items', n, 'paid_from', p_paid_from));
  return jsonb_build_object('id', pid, 'total', v_total, 'items', n, 'from_drawer', sh is not null);
end $$;

-- ===== Bahan terbuang =====
create function record_waste(p_ingredient uuid, p_qty numeric, p_note text default '') returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not role_in(array['owner', 'manager', 'kitchen']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Jumlah terbuang harus lebih dari 0'; end if;
  update ingredients set stock = stock - p_qty where id = p_ingredient and store_id = my_store();
  if not found then raise exception 'Bahan tidak ditemukan'; end if;
  insert into stock_movements (store_id, ingredient_id, delta, reason, note, user_id)
    values (my_store(), p_ingredient, -p_qty, 'WASTE', left(coalesce(nullif(btrim(p_note), ''), 'Terbuang'), 100), auth.uid());
  perform audit(my_store(), 'stock.waste', 'ingredient', p_ingredient, jsonb_build_object('qty', p_qty, 'note', p_note));
end $$;

revoke execute on function receive_purchase(text, jsonb, text, text), record_waste(uuid, numeric, text) from public, anon;
grant execute on function receive_purchase(text, jsonb, text, text), record_waste(uuid, numeric, text) to authenticated;

-- ===== Peringatan stok minimum secara langsung =====
-- Layar staf mendengar perubahan stok (RLS: hanya bahan toko sendiri) untuk toast + bunyi saat menyentuh minimum.
alter publication supabase_realtime add table ingredients;
