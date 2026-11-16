alter table stores drop constraint if exists stores_buyer_template_check;
update stores set buyer_template = case buyer_template
    when 'segar' then 'klasik' when 'ringkas' then 'daftar' when 'galeri' then 'foto' when 'pastel' then 'lembut' when 'malam' then 'gelap' else 'klasik' end;
alter table stores alter column buyer_template set default 'klasik';
alter table stores add constraint stores_buyer_template_check check (buyer_template in ('klasik', 'daftar', 'foto', 'lembut', 'gelap'));
create or replace function save_buyer_template(p_template text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_template not in ('klasik', 'daftar', 'foto', 'lembut', 'gelap') then raise exception 'Template tidak dikenal'; end if;
  update stores set buyer_template = p_template where id = my_store();
  perform audit(my_store(), 'store.buyer_template', 'store', my_store(), jsonb_build_object('template', p_template));
end $$;
