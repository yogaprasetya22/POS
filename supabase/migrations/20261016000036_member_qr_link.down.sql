-- Rollback Migration 36
drop function if exists leave_member(uuid);
drop function if exists my_member_cards();
drop function if exists claim_member_link(text);
drop function if exists create_member_link(uuid);
drop table if exists member_links;
drop index if exists members_store_user_uniq;
alter table members drop column if exists user_id;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, email) values (new.id, new.email);
  return new;
end $$;
-- is_anon_user() tetap dibiarkan karena dipakai register_store (aman, hanya memperketat).
