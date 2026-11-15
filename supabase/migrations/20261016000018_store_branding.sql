-- Logo struk & warna aplikasi per toko.
-- logo: PNG hitam-putih (data URL) yang sudah diperkecil di browser, siap dicetak printer thermal.
alter table stores add column if not exists logo text not null default '' check (length(logo) <= 120000);
alter table stores add column if not exists theme text not null default 'biru'
  check (theme in ('biru', 'hijau', 'oranye', 'merah', 'ungu', 'coklat', 'tosca', 'pink'));

create or replace function save_store_branding(p_logo text, p_theme text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if coalesce(p_logo, '') <> '' and p_logo not like 'data:image/png;base64,%' then
    raise exception 'Logo harus berupa gambar. Pilih file PNG atau JPG.';
  end if;
  update stores set logo = coalesce(p_logo, ''), theme = coalesce(p_theme, 'biru') where id = my_store();
  perform audit(my_store(), 'store.branding', 'store', my_store(), jsonb_build_object('theme', p_theme, 'logo', coalesce(p_logo, '') <> ''));
end $$;
revoke all on function save_store_branding(text, text) from public, anon;
grant execute on function save_store_branding(text, text) to authenticated;
