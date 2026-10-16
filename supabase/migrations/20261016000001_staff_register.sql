-- Register staf: setiap user Auth dapat baris profiles otomatis.
-- User pertama = owner (bootstrap). User berikutnya role NULL (belum aktif) sampai owner mengaktifkan.
alter table profiles alter column role drop not null;
alter table profiles add column email text;

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- kunci agar dua pendaftar pertama yang bersamaan tidak sama-sama jadi owner
  lock table profiles in share row exclusive mode;
  insert into profiles (user_id, email, role)
  values (new.id, new.email, case when exists (select 1 from profiles where role = 'owner') then null else 'owner'::staff_role end);
  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- user yang sudah ada sebelum migrasi ini
insert into profiles (user_id, email)
  select id, email from auth.users
  on conflict (user_id) do update set email = excluded.email;
-- belum ada owner (mis. setelah migrate-fresh) → user Auth paling lama jadi owner
update profiles set role = 'owner'
  where user_id = (select id from auth.users order by created_at limit 1)
    and not exists (select 1 from profiles where role = 'owner');

create policy profiles_owner_update on profiles for update to authenticated
  using (my_role() = 'owner')
  -- owner tidak bisa mencabut role-nya sendiri (mencegah toko tanpa owner)
  with check (my_role() = 'owner' and (user_id <> auth.uid() or role = 'owner'));
