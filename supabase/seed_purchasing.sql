-- Data contoh Pembelian untuk toko demo (aman diulang): pemasok + pembelian di setiap keadaan.
-- Catatan: pembelian contoh hanya catatan; stok bahan TIDAK diubah oleh file ini.
-- Tiga bahan dibuat "hampir habis" (batas minimum dinaikkan) supaya "Buat daftar belanja" punya usulan.
do $$
declare
  s uuid; pid uuid; spec jsonb; it jsonb; ing ingredients; sup suppliers;
  price int; q numeric; r numeric; v_total int; v_recv int;
begin
  select id into s from stores where slug = 'warkop-nusantara';
  if s is null then raise notice 'Toko demo tidak ditemukan, dilewati'; return; end if;

  insert into suppliers (store_id, name, phone, note) values
    (s, 'Pasar Induk', '', 'Belanja pagi, bayar tunai'),
    (s, 'Toko Makmur', '081234567890', 'Sembako, antar tiap Senin & Kamis'),
    (s, 'CV Sumber Protein', '081298765432', 'Daging, ayam, ikan. Tempo 14 hari'),
    (s, 'Kopi Gayo Supply', '085711223344', 'Biji kopi & susu')
  on conflict (store_id, lower(name)) do update set phone = excluded.phone, note = excluded.note, is_active = true;

  delete from purchases where store_id = s and note = 'Data contoh';

  for spec in select value from jsonb_array_elements('[
    {"sup":"Toko Makmur","status":"DRAFT","days":0,"debt":false,"items":[["Gula pasir",5,0],["Tepung terigu",10,0],["Minyak goreng",6,0]]},
    {"sup":"Kopi Gayo Supply","status":"ORDERED","days":1,"debt":false,"items":[["Biji kopi",3,0],["Susu",12,0]]},
    {"sup":"CV Sumber Protein","status":"ORDERED","days":2,"debt":true,"items":[["Ayam fillet",8,8],["Daging sapi giling",5,2],["Salmon",3,0]]},
    {"sup":"CV Sumber Protein","status":"RECEIVED","days":9,"debt":true,"items":[["Iga sapi",6,6],["Udang",4,4]]},
    {"sup":"Toko Makmur","status":"RECEIVED","days":6,"debt":false,"items":[["Beras",25,25],["Telur",4,4],["Kecap manis",6,6]]},
    {"sup":"Pasar Induk","status":"RECEIVED","days":3,"debt":false,"items":[["Sayuran",5,5],["Lemon",30,30]]},
    {"sup":"Kopi Gayo Supply","status":"RECEIVED","days":14,"debt":false,"items":[["Biji kopi",2,2],["Krim kocok",3,3]]},
    {"sup":"Pasar Induk","status":"CANCELLED","days":4,"debt":false,"items":[["Kentang beku",10,0]]}
  ]'::jsonb) loop
    select * into sup from suppliers where store_id = s and lower(name) = lower(spec->>'sup');
    insert into purchases (store_id, supplier, supplier_id, total, paid_from, note, status, created_at, ordered_at, received_at)
      values (s, sup.name, sup.id, 0, 'OTHER', 'Data contoh', spec->>'status',
        now() - make_interval(days => (spec->>'days')::int),
        case when spec->>'status' in ('ORDERED', 'RECEIVED') then now() - make_interval(days => (spec->>'days')::int) end,
        case when spec->>'status' = 'RECEIVED' then now() - make_interval(days => greatest((spec->>'days')::int - 1, 0)) end)
      returning id into pid;
    v_total := 0; v_recv := 0;
    for it in select value from jsonb_array_elements(spec->'items') loop
      select * into ing from ingredients where store_id = s and lower(name) = lower(it->>0);
      if ing.id is null then continue; end if;
      q := (it->>1)::numeric; r := (it->>2)::numeric;
      price := round(ing.cost * ing.purchase_factor)::int;
      insert into purchase_items (purchase_id, store_id, ingredient_id, qty, unit_price, stock_qty, received_qty)
        values (pid, s, ing.id, q, price, q * ing.purchase_factor, r);
      v_total := v_total + round(q * price)::int;
      v_recv := v_recv + round(r * price)::int;
    end loop;
    update purchases set total = v_total, unpaid = case when (spec->>'debt')::boolean then v_recv else 0 end where id = pid;
  end loop;

  update ingredients set min_stock = ceil(stock * 1.25)
    where store_id = s and name in ('Telur', 'Keju slice', 'Mentega') and stock > 0 and stock > min_stock;
end $$;
