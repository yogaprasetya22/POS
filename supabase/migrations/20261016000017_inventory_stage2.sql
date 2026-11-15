-- Inventory tahap 2: barcode bahan kemasan, Stock Opname, import Excel (bahan + resep).
-- Rancangan: docs/rancangan-inventory-shift-pembelian.md

-- ===== Barcode bahan =====
-- Satu bahan boleh punya beberapa barcode (merek/ukuran kemasan berbeda); satu barcode hanya milik satu bahan per toko.
create table ingredient_barcodes (
  store_id uuid not null references stores on delete cascade,
  code text not null check (code ~ '^[0-9A-Za-z\-]{3,40}$'),
  ingredient_id uuid not null references ingredients on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, code)
);
create index ingredient_barcodes_ing_idx on ingredient_barcodes (ingredient_id);
alter table ingredient_barcodes enable row level security;
create policy ingredient_barcodes_read on ingredient_barcodes for select to authenticated using (my_role() is not null and store_id = my_store());
create policy ingredient_barcodes_manage on ingredient_barcodes for all to authenticated
  using (is_manager() and store_id = my_store()) with check (is_manager() and store_id = my_store());
revoke all on ingredient_barcodes from anon;

-- ===== Stock Opname =====
-- p_items: [{ "ingredient_id": uuid, "counted": angka >= 0 }] - hanya bahan yang dihitung.
-- Stok disetel ke hasil hitung; selisih dicatat sebagai COUNT beserta nilai rupiahnya.
create function stock_count(p_items jsonb, p_note text default '') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  it jsonb; ing ingredients; c numeric; d numeric; out_rows jsonb := '[]'::jsonb; v_value numeric := 0; n int := 0;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Isi minimal satu hasil hitung'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    select * into ing from ingredients where id = (it->>'ingredient_id')::uuid and store_id = my_store() for update;
    if ing.id is null then raise exception 'Bahan tidak ditemukan'; end if;
    c := (it->>'counted')::numeric;
    if c is null or c < 0 then raise exception 'Hasil hitung % tidak boleh kosong atau minus', ing.name; end if;
    d := c - ing.stock;
    n := n + 1;
    if d <> 0 then
      update ingredients set stock = c where id = ing.id;
      insert into stock_movements (store_id, ingredient_id, delta, reason, note, user_id)
        values (my_store(), ing.id, d, 'COUNT', left(coalesce(nullif(btrim(p_note), ''), 'Stock opname'), 100), auth.uid());
      v_value := v_value + d * ing.cost;
      out_rows := out_rows || jsonb_build_object('name', ing.name, 'unit', ing.unit, 'before', ing.stock, 'counted', c, 'delta', d, 'value', round(d * ing.cost));
    end if;
  end loop;
  perform audit(my_store(), 'stock.count', 'store', my_store(),
    jsonb_build_object('counted', n, 'changed', jsonb_array_length(out_rows), 'value', round(v_value)));
  return jsonb_build_object('counted', n, 'changed', out_rows, 'value', round(v_value));
end $$;

-- ===== Import Excel =====
-- p_ingredients: [{ name, unit, min_stock, cost, purchase_unit, purchase_factor, barcodes: [text], initial_stock }]
-- p_recipes:     [{ product, ingredient, qty }]
-- Bahan dicocokkan menurut nama (tanpa beda huruf besar/kecil). Bahan yang ada: diperbarui (kecuali stok & satuan).
-- Bahan baru: dibuat, stok awal dicatat sebagai RESTOCK. Yang tidak ada di file dibiarkan. Semua atau batal semua.
create function import_inventory(p_ingredients jsonb, p_recipes jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  it jsonb; ing ingredients; v_name text; v_unit text; bc text; pid uuid; iid uuid; q numeric;
  added int := 0; updated int := 0; recipes_set int := 0; codes int := 0; s0 numeric;
begin
  if not is_manager() then raise exception 'forbidden'; end if;

  for it in select value from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) loop
    v_name := btrim(coalesce(it->>'name', ''));
    v_unit := btrim(coalesce(it->>'unit', ''));
    if v_name = '' then raise exception 'Ada bahan tanpa nama'; end if;
    select * into ing from ingredients where store_id = my_store() and lower(name) = lower(v_name) for update;
    if ing.id is null then
      if v_unit = '' then raise exception 'Satuan bahan % belum diisi', v_name; end if;
      s0 := greatest(coalesce((it->>'initial_stock')::numeric, 0), 0);
      insert into ingredients (store_id, name, unit, stock, min_stock, cost, purchase_unit, purchase_factor)
        values (my_store(), left(v_name, 60), left(v_unit, 12), s0,
          greatest(coalesce((it->>'min_stock')::numeric, 0), 0), greatest(coalesce((it->>'cost')::numeric, 0), 0),
          left(btrim(coalesce(it->>'purchase_unit', '')), 12), greatest(coalesce(nullif((it->>'purchase_factor')::numeric, 0), 1), 0.001))
        returning * into ing;
      if s0 > 0 then
        insert into stock_movements (store_id, ingredient_id, delta, reason, note, user_id)
          values (my_store(), ing.id, s0, 'RESTOCK', 'Stok awal (import Excel)', auth.uid());
      end if;
      added := added + 1;
    else
      if v_unit <> '' and lower(v_unit) <> lower(ing.unit) then
        raise exception 'Satuan % di file (%) beda dengan di aplikasi (%). Satuan bahan yang sudah ada tidak bisa diubah lewat import.', ing.name, v_unit, ing.unit;
      end if;
      update ingredients set
          -- kolom kosong di Excel = biarkan nilai lama (greatest(NULL, 0) di Postgres = 0, jadi dicek dulu)
          min_stock = case when it->>'min_stock' is null then min_stock else greatest((it->>'min_stock')::numeric, 0) end,
          cost = case when it->>'cost' is null then cost else greatest((it->>'cost')::numeric, 0) end,
          purchase_unit = coalesce(left(btrim(it->>'purchase_unit'), 12), purchase_unit),
          purchase_factor = coalesce(nullif((it->>'purchase_factor')::numeric, 0), purchase_factor)
        where id = ing.id;
      updated := updated + 1;
    end if;
    for bc in select btrim(value) from jsonb_array_elements_text(coalesce(it->'barcodes', '[]'::jsonb)) loop
      continue when bc = '';
      select ingredient_id into iid from ingredient_barcodes where store_id = my_store() and code = bc;
      if iid is not null and iid <> ing.id then raise exception 'Barcode % sudah dipakai bahan lain', bc; end if;
      if iid is null then
        insert into ingredient_barcodes (store_id, code, ingredient_id) values (my_store(), bc, ing.id);
        codes := codes + 1;
      end if;
    end loop;
  end loop;

  for it in select value from jsonb_array_elements(coalesce(p_recipes, '[]'::jsonb)) loop
    select id into pid from products where store_id = my_store() and lower(name) = lower(btrim(coalesce(it->>'product', '')));
    if pid is null then raise exception 'Menu "%" tidak ditemukan', it->>'product'; end if;
    select id into iid from ingredients where store_id = my_store() and lower(name) = lower(btrim(coalesce(it->>'ingredient', '')));
    if iid is null then raise exception 'Bahan "%" tidak ditemukan', it->>'ingredient'; end if;
    q := (it->>'qty')::numeric;
    if q is null or q <= 0 then raise exception 'Takaran % untuk % harus lebih dari 0', it->>'ingredient', it->>'product'; end if;
    insert into recipes (product_id, ingredient_id, store_id, qty) values (pid, iid, my_store(), q)
      on conflict (product_id, ingredient_id) do update set qty = excluded.qty;
    recipes_set := recipes_set + 1;
  end loop;

  perform audit(my_store(), 'stock.import', 'store', my_store(),
    jsonb_build_object('added', added, 'updated', updated, 'recipes', recipes_set, 'barcodes', codes));
  return jsonb_build_object('added', added, 'updated', updated, 'recipes', recipes_set, 'barcodes', codes);
end $$;

revoke execute on function stock_count(jsonb, text), import_inventory(jsonb, jsonb) from public, anon;
grant execute on function stock_count(jsonb, text), import_inventory(jsonb, jsonb) to authenticated;
