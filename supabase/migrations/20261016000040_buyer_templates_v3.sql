-- Migration 40: 20 template halaman pembeli (10 baru: kaca, neo, reel, polaroid, aurora, mewah, sinema, retro, split, swiss).
alter table stores drop constraint if exists stores_buyer_template_check;
alter table stores add constraint stores_buyer_template_check check (buyer_template in ('segar', 'ringkas', 'galeri', 'majalah', 'kertas', 'malam', 'bento', 'pastel', 'label', 'minimalis', 'kaca', 'neo', 'reel', 'polaroid', 'aurora', 'mewah', 'sinema', 'retro', 'split', 'swiss'));

create or replace function save_buyer_template(p_template text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_template not in ('segar', 'ringkas', 'galeri', 'majalah', 'kertas', 'malam', 'bento', 'pastel', 'label', 'minimalis', 'kaca', 'neo', 'reel', 'polaroid', 'aurora', 'mewah', 'sinema', 'retro', 'split', 'swiss') then raise exception 'Template tidak dikenal'; end if;
  update stores set buyer_template = p_template where id = my_store();
  perform audit(my_store(), 'store.buyer_template', 'store', my_store(), jsonb_build_object('template', p_template));
end $$;
revoke all on function save_buyer_template(text) from public, anon;
grant execute on function save_buyer_template(text) to authenticated;
