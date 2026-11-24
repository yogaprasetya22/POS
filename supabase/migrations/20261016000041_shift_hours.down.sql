drop trigger if exists shifts_copy_hours on shifts;
drop function if exists shifts_copy_hours();
-- pulihkan save_shift_names versi migrasi 020 (tanpa jam)
create or replace function save_shift_names(p_items jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare it jsonb; n int := 0; nm text;
begin
  if not can_do('manage_shifts') then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Daftar shift tidak valid'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    nm := left(btrim(coalesce(it->>'name', '')), 30);
    if nm = '' then raise exception 'Nama shift tidak boleh kosong'; end if;
    if nullif(it->>'id', '') is null then
      insert into shift_names (store_id, name, sort_order, is_active) values (my_store(), nm, n, coalesce((it->>'is_active')::boolean, true));
    else
      update shift_names set name = nm, sort_order = n, is_active = coalesce((it->>'is_active')::boolean, true)
        where id = (it->>'id')::uuid and store_id = my_store();
    end if;
    n := n + 1;
  end loop;
  perform audit(my_store(), 'shift.names', 'store', my_store(), jsonb_build_object('count', n));
end $$;
alter table shifts drop column if exists planned_start, drop column if exists planned_end;
alter table shift_names drop constraint if exists shift_names_hours_pair;
alter table shift_names drop column if exists start_time, drop column if exists end_time;
