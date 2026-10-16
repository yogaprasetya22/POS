drop policy if exists profiles_owner_update on profiles;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();
delete from profiles where role is null;
alter table profiles drop column if exists email;
alter table profiles alter column role set not null;
