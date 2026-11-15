-- Template tampilan halaman pembeli (menu QR). Warna mengikuti stores.theme.
alter table stores add column if not exists buyer_template text not null default 'klasik'
  check (buyer_template in ('klasik', 'daftar', 'foto', 'lembut', 'gelap'));

create or replace function save_buyer_template(p_template text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_template not in ('klasik', 'daftar', 'foto', 'lembut', 'gelap') then raise exception 'Template tidak dikenal'; end if;
  update stores set buyer_template = p_template where id = my_store();
  perform audit(my_store(), 'store.buyer_template', 'store', my_store(), jsonb_build_object('template', p_template));
end $$;
revoke all on function save_buyer_template(text) from public, anon;
grant execute on function save_buyer_template(text) to authenticated;
