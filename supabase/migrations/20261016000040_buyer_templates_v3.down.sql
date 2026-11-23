-- Kembali ke 10 template: toko yang memakai template baru dipindah ke 'segar'.
update stores set buyer_template = 'segar' where buyer_template not in ('segar', 'ringkas', 'galeri', 'majalah', 'kertas', 'malam', 'bento', 'pastel', 'label', 'minimalis');
alter table stores drop constraint if exists stores_buyer_template_check;
alter table stores add constraint stores_buyer_template_check check (buyer_template in ('segar', 'ringkas', 'galeri', 'majalah', 'kertas', 'malam', 'bento', 'pastel', 'label', 'minimalis'));
