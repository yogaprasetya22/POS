drop function if exists set_staff_name(uuid, text);
drop function if exists set_my_pin(text);
drop function if exists has_my_pin();
drop function if exists verify_my_pin(text);
drop table if exists staff_pins;
create or replace function email_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select email from profiles where user_id = p_user
$$;
alter table profiles drop column if exists display_name;
