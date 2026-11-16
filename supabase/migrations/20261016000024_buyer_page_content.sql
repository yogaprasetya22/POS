-- Isi halaman pembeli: deskripsi & tanda "Andalan" per menu, logo berwarna & slogan toko.
alter table products add column if not exists description text not null default '' check (length(description) <= 300);
alter table products add column if not exists is_featured boolean not null default false;
alter table stores add column if not exists logo_url text not null default '' check (length(logo_url) <= 500);
alter table stores add column if not exists tagline text not null default '' check (length(tagline) <= 120);

create or replace function save_store_identity(p_logo_url text, p_tagline text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if coalesce(p_logo_url, '') <> '' and p_logo_url !~ '^https://' then raise exception 'Alamat logo tidak valid'; end if;
  update stores set logo_url = left(coalesce(p_logo_url, ''), 500), tagline = left(btrim(coalesce(p_tagline, '')), 120) where id = my_store();
  perform audit(my_store(), 'store.identity', 'store', my_store(), jsonb_build_object('logo', coalesce(p_logo_url, '') <> '', 'tagline', p_tagline));
end $$;
revoke all on function save_store_identity(text, text) from public, anon;
grant execute on function save_store_identity(text, text) to authenticated;
