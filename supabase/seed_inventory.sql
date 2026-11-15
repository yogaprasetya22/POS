-- Data demo Inventory Stock untuk toko warkop-nusantara: bahan lengkap + resep semua menu + contoh barcode.
-- Aman diulang: stok bahan yang sudah ada TIDAK diubah (stok hanya berubah lewat barang masuk / opname);
-- harga beli, batas minimum, dan satuan beli diperbarui. Resep toko ini diganti seluruhnya.
-- Takaran & harga = perkiraan wajar untuk demo, bukan data sungguhan.
-- Butuh migrasi 20261016000016 & 20261016000017.
do $$
declare w uuid;
begin
  select id into w from stores where slug = 'warkop-nusantara';
  if w is null then raise notice 'Toko warkop-nusantara tidak ada, lewati'; return; end if;

  -- nama, satuan pakai, stok awal (hanya untuk bahan baru), batas minimum, harga per satuan pakai, satuan beli, isi per satuan beli
  insert into ingredients (store_id, name, unit, stock, min_stock, cost, purchase_unit, purchase_factor)
  select w, v.name, v.unit, v.stock, v.min_stock, v.cost, v.purchase_unit, v.factor
  from (values
    ('Beras', 'gram', 20000, 5000, 15, 'kg', 1000),
    ('Biji kopi', 'gram', 5000, 1000, 200, 'kg', 1000),
    ('Susu', 'ml', 12000, 3000, 20, 'liter', 1000),
    ('Gula aren', 'gram', 3000, 500, 30, 'kg', 1000),
    ('Telur', 'pcs', 60, 20, 2200, 'tray', 30),
    ('Bumbu nasi goreng', 'gram', 2000, 500, 60, 'pack', 100),
    ('Minyak goreng', 'ml', 10000, 2000, 18, 'liter', 1000),
    ('Kecap manis', 'ml', 3000, 500, 25, 'botol', 600),
    ('Mie telur', 'gram', 5000, 1000, 25, 'kg', 1000),
    ('Mie ramen', 'gram', 3000, 800, 45, 'kg', 1000),
    ('Kaldu ayam', 'ml', 10000, 2000, 10, 'liter', 1000),
    ('Ayam fillet', 'gram', 8000, 2000, 60, 'kg', 1000),
    ('Daging sapi giling', 'gram', 5000, 1000, 130, 'kg', 1000),
    ('Iga sapi', 'gram', 6000, 1500, 150, 'kg', 1000),
    ('Madu', 'ml', 2000, 300, 120, 'botol', 500),
    ('Udang', 'gram', 3000, 800, 140, 'kg', 1000),
    ('Salmon', 'gram', 3000, 800, 350, 'kg', 1000),
    ('Sayuran', 'gram', 3000, 800, 20, 'kg', 1000),
    ('Roti burger', 'pcs', 40, 10, 3500, 'pack', 6),
    ('Keju slice', 'pcs', 60, 15, 2000, 'pack', 10),
    ('Kentang beku', 'gram', 10000, 2000, 35, 'kg', 1000),
    ('Penne', 'gram', 4000, 1000, 40, 'pack', 500),
    ('Saus bolognese', 'gram', 3000, 800, 45, 'kg', 1000),
    ('Adonan pizza', 'pcs', 30, 8, 6000, 'pack', 5),
    ('Mozzarella', 'gram', 3000, 800, 120, 'kg', 1000),
    ('Tepung terigu', 'gram', 10000, 2000, 14, 'kg', 1000),
    ('Gula pasir', 'gram', 8000, 1500, 17, 'kg', 1000),
    ('Mentega', 'gram', 2000, 500, 90, 'pack', 200),
    ('Cokelat', 'gram', 3000, 600, 150, 'kg', 1000),
    ('Krim kocok', 'ml', 2000, 500, 60, 'liter', 1000),
    ('Teh celup', 'pcs', 200, 50, 300, 'box', 100),
    ('Lemon', 'pcs', 40, 10, 2500, '', 1)
  ) v(name, unit, stock, min_stock, cost, purchase_unit, factor)
  on conflict (store_id, lower(name)) do update
    set min_stock = excluded.min_stock, cost = excluded.cost,
        purchase_unit = excluded.purchase_unit, purchase_factor = excluded.purchase_factor;

  delete from recipes where store_id = w;
  insert into recipes (product_id, ingredient_id, store_id, qty)
  select p.id, i.id, w, r.qty
  from (values
    ('Nasi Goreng Spesial', 'Beras', 200), ('Nasi Goreng Spesial', 'Bumbu nasi goreng', 20), ('Nasi Goreng Spesial', 'Telur', 1),
    ('Nasi Goreng Spesial', 'Minyak goreng', 15), ('Nasi Goreng Spesial', 'Kecap manis', 10), ('Nasi Goreng Spesial', 'Ayam fillet', 50),
    ('Mie Goreng Jawa', 'Mie telur', 150), ('Mie Goreng Jawa', 'Kecap manis', 15), ('Mie Goreng Jawa', 'Telur', 1),
    ('Mie Goreng Jawa', 'Sayuran', 30), ('Mie Goreng Jawa', 'Minyak goreng', 15), ('Mie Goreng Jawa', 'Ayam fillet', 40),
    ('Mie Kuah Ayam', 'Mie telur', 150), ('Mie Kuah Ayam', 'Kaldu ayam', 300), ('Mie Kuah Ayam', 'Ayam fillet', 60),
    ('Mie Kuah Ayam', 'Sayuran', 30), ('Mie Kuah Ayam', 'Telur', 1),
    ('Ramen Telur Udang', 'Mie ramen', 150), ('Ramen Telur Udang', 'Kaldu ayam', 350), ('Ramen Telur Udang', 'Udang', 60),
    ('Ramen Telur Udang', 'Telur', 1), ('Ramen Telur Udang', 'Sayuran', 20),
    ('Rice Bowl Salmon', 'Beras', 180), ('Rice Bowl Salmon', 'Salmon', 100), ('Rice Bowl Salmon', 'Sayuran', 30), ('Rice Bowl Salmon', 'Kecap manis', 10),
    ('Iga Bakar Madu', 'Iga sapi', 250), ('Iga Bakar Madu', 'Madu', 30), ('Iga Bakar Madu', 'Kecap manis', 20), ('Iga Bakar Madu', 'Beras', 180),
    ('Burger Sapi Keju', 'Roti burger', 1), ('Burger Sapi Keju', 'Daging sapi giling', 120), ('Burger Sapi Keju', 'Keju slice', 1), ('Burger Sapi Keju', 'Sayuran', 20),
    ('Pizza Personal', 'Adonan pizza', 1), ('Pizza Personal', 'Mozzarella', 80), ('Pizza Personal', 'Saus bolognese', 50),
    ('Penne Bolognese', 'Penne', 120), ('Penne Bolognese', 'Saus bolognese', 100), ('Penne Bolognese', 'Daging sapi giling', 50), ('Penne Bolognese', 'Mozzarella', 20),
    ('Kentang Goreng', 'Kentang beku', 200), ('Kentang Goreng', 'Minyak goreng', 30),
    ('Cafe Latte', 'Biji kopi', 18), ('Cafe Latte', 'Susu', 150), ('Cafe Latte', 'Gula aren', 10),
    ('Es Teh Lemon', 'Teh celup', 1), ('Es Teh Lemon', 'Lemon', 0.5), ('Es Teh Lemon', 'Gula pasir', 20),
    ('Donat Glaze', 'Tepung terigu', 60), ('Donat Glaze', 'Gula pasir', 15), ('Donat Glaze', 'Mentega', 10), ('Donat Glaze', 'Telur', 0.25), ('Donat Glaze', 'Cokelat', 10),
    ('Cookies Coklat', 'Tepung terigu', 40), ('Cookies Coklat', 'Mentega', 20), ('Cookies Coklat', 'Gula pasir', 15), ('Cookies Coklat', 'Cokelat', 20), ('Cookies Coklat', 'Telur', 0.2),
    ('Chocolate Parfait', 'Cokelat', 30), ('Chocolate Parfait', 'Krim kocok', 80), ('Chocolate Parfait', 'Susu', 50), ('Chocolate Parfait', 'Gula pasir', 10)
  ) r(product, ingredient, qty)
  join products p on p.store_id = w and p.name = r.product
  join ingredients i on i.store_id = w and i.name = r.ingredient;

  -- contoh barcode kemasan (kode demo, bukan kode produk sungguhan)
  insert into ingredient_barcodes (store_id, code, ingredient_id)
  select w, b.code, i.id
  from (values ('8990000000011', 'Susu'), ('8990000000028', 'Kecap manis'), ('8990000000035', 'Teh celup'), ('8990000000042', 'Mentega'), ('8990000000059', 'Penne')) b(code, ingredient)
  join ingredients i on i.store_id = w and i.name = b.ingredient
  on conflict do nothing;
end $$;
