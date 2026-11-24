-- Migration 41: jam kerja per shift (opsional, panduan saja: tidak mengunci buka/tutup shift).
-- Dipakai untuk: memilih shift otomatis sesuai jam, pengingat tutup shift, dan tanda telat/lembur di laporan.
-- Shift boleh melewati tengah malam (mis. 22:00–06:00).

alter table shift_names
  add column if not exists start_time time,
  add column if not exists end_time time;
alter table shift_names drop constraint if exists shift_names_hours_pair;
alter table shift_names add constraint shift_names_hours_pair
  check ((start_time is null) = (end_time is null) and (start_time is null or start_time <> end_time));

-- jam disalin ke shift saat dibuka, supaya laporan lama tidak berubah bila jam diedit
alter table shifts
  add column if not exists planned_start time,
  add column if not exists planned_end time;

create or replace function shifts_copy_hours() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.shift_name_id is not null and new.planned_start is null then
    select start_time, end_time into new.planned_start, new.planned_end from shift_names where id = new.shift_name_id;
  end if;
  return new;
end $$;
drop trigger if exists shifts_copy_hours on shifts;
create trigger shifts_copy_hours before insert on shifts for each row execute function shifts_copy_hours();

-- p_items: [{ "id": uuid | null, "name": text, "is_active": boolean, "start_time": "HH:MM" | null, "end_time": "HH:MM" | null }]
create or replace function save_shift_names(p_items jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare it jsonb; n int := 0; nm text; st time; en time;
begin
  if not can_do('manage_shifts') then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Daftar shift tidak valid'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    nm := left(btrim(coalesce(it->>'name', '')), 30);
    if nm = '' then raise exception 'Nama shift tidak boleh kosong'; end if;
    st := nullif(it->>'start_time', '')::time;
    en := nullif(it->>'end_time', '')::time;
    if (st is null) <> (en is null) then raise exception 'Isi jam mulai dan jam selesai shift %, atau kosongkan keduanya', nm; end if;
    if st is not null and st = en then raise exception 'Jam mulai dan selesai shift % tidak boleh sama', nm; end if;
    if nullif(it->>'id', '') is null then
      insert into shift_names (store_id, name, sort_order, is_active, start_time, end_time)
        values (my_store(), nm, n, coalesce((it->>'is_active')::boolean, true), st, en);
    else
      update shift_names set name = nm, sort_order = n, is_active = coalesce((it->>'is_active')::boolean, true), start_time = st, end_time = en
        where id = (it->>'id')::uuid and store_id = my_store();
    end if;
    n := n + 1;
  end loop;
  perform audit(my_store(), 'shift.names', 'store', my_store(), jsonb_build_object('count', n));
end $$;
