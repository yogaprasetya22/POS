-- Migration 37: Member cukup nomor HP. Nama jadi opsional (boleh kosong).
alter table members drop constraint if exists members_name_check;
alter table members alter column name set default '';
alter table members add constraint members_name_check check (length(name) <= 60);

create or replace function upsert_member(p_phone text, p_name text default null) returns members
language plpgsql volatile security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); r members;
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  if ph like '0%' then ph := '62' || substr(ph, 2); elsif ph like '8%' then ph := '62' || ph; end if;
  if ph !~ '^62\d{8,13}$' then raise exception 'Nomor HP tidak valid'; end if;
  insert into members (store_id, phone, name) values (my_store(), ph, coalesce(btrim(p_name), ''))
    on conflict (store_id, phone) do update set name = coalesce(nullif(btrim(p_name), ''), members.name)
    returning * into r;
  return r;
end $$;
