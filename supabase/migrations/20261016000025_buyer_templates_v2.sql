-- 10 template halaman pembeli (menggantikan 5 template lama). Pilihan lama dipetakan ke yang paling mirip.
alter table stores drop constraint if exists stores_buyer_template_check;
update stores set buyer_template = case buyer_template
    when 'klasik' then 'segar' when 'daftar' then 'ringkas' when 'foto' then 'galeri' when 'lembut' then 'pastel' when 'gelap' then 'malam'
    else buyer_template end;
update stores set buyer_template = 'segar'
  where buyer_template not in ('segar', 'ringkas', 'galeri', 'majalah', 'kertas', 'malam', 'bento', 'pastel', 'label', 'minimalis');
alter table stores alter column buyer_template set default 'segar';
alter table stores add constraint stores_buyer_template_check
  check (buyer_template in ('segar', 'ringkas', 'galeri', 'majalah', 'kertas', 'malam', 'bento', 'pastel', 'label', 'minimalis'));

create or replace function save_buyer_template(p_template text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_template not in ('segar', 'ringkas', 'galeri', 'majalah', 'kertas', 'malam', 'bento', 'pastel', 'label', 'minimalis') then raise exception 'Template tidak dikenal'; end if;
  update stores set buyer_template = p_template where id = my_store();
  perform audit(my_store(), 'store.buyer_template', 'store', my_store(), jsonb_build_object('template', p_template));
end $$;
