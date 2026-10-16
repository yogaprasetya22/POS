-- Dukungan multi-image (carousel) dan video untuk menu produk
alter table products add column if not exists images jsonb not null default '[]';
alter table products add column if not exists video_url text;

-- Inisialisasi data lama: jika sudah punya image_url, masukkan ke array images
update products
set images = jsonb_build_array(image_url)
where image_url is not null and (images is null or images = '[]'::jsonb);
