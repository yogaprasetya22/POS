-- Migration 39: Warna halaman publik (landing, masuk, daftar) ditentukan super admin.
-- Satu baris untuk seluruh platform. Semua orang boleh membaca; hanya super admin yang bisa mengubah.
create table if not exists platform_settings (
  id int primary key default 1 check (id = 1),
  landing_theme text not null default 'biru',
  updated_at timestamptz not null default now()
);
insert into platform_settings (id) values (1) on conflict (id) do nothing;
alter table platform_settings enable row level security;
drop policy if exists platform_settings_read on platform_settings;
create policy platform_settings_read on platform_settings for select using (true);

create or replace function set_landing_theme(p_theme text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Hanya super admin yang bisa mengubah warna landing page'; end if;
  if p_theme not in ('biru', 'tosca', 'hijau', 'oranye', 'merah', 'pink', 'ungu', 'coklat') then
    raise exception 'Warna tidak dikenal';
  end if;
  update platform_settings set landing_theme = p_theme, updated_at = now() where id = 1;
end $$;
revoke execute on function set_landing_theme(text) from public, anon;
grant execute on function set_landing_theme(text) to authenticated;
