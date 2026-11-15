-- Tahap 3: daftar nama shift dinamis + hak akses per peran.

-- ===== Hak akses dinamis =====
create table store_permissions (
  store_id uuid not null references stores on delete cascade,
  permission text not null check (permission in ('purchase', 'waste', 'stock_count', 'advance', 'manage_shifts')),
  roles staff_role[] not null default '{}',
  primary key (store_id, permission)
);
alter table store_permissions enable row level security;
create policy store_permissions_read on store_permissions for select to authenticated using (my_role() is not null and store_id = my_store());
revoke all on store_permissions from anon;
revoke insert, update, delete on store_permissions from authenticated;

-- Nilai awal bila pemilik belum mengatur (pemilik selalu boleh semua).
create function default_roles(p_permission text) returns staff_role[]
language sql immutable as $$
  select case p_permission
    when 'purchase' then array['manager']::staff_role[]
    when 'waste' then array['manager', 'kitchen']::staff_role[]
    when 'stock_count' then array['manager']::staff_role[]
    when 'advance' then array['manager', 'cashier', 'waiter', 'kitchen']::staff_role[]
    when 'manage_shifts' then array['manager']::staff_role[]
    else array[]::staff_role[] end
$$;

create function can_do(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when my_role() is null then false
    when my_role() = 'owner' then true
    else my_role() = any (coalesce(
      (select roles from store_permissions where store_id = my_store() and permission = p_permission),
      default_roles(p_permission)))
  end
$$;

create function save_permission(p_permission text, p_roles text[]) returns void
language plpgsql volatile security definer set search_path = public as $$
declare r staff_role[];
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_permission not in ('purchase', 'waste', 'stock_count', 'advance', 'manage_shifts') then raise exception 'Hak akses tidak dikenal'; end if;
  if exists (select 1 from unnest(coalesce(p_roles, '{}')) x where x not in ('manager', 'cashier', 'waiter', 'kitchen')) then
    raise exception 'Peran tidak dikenal';
  end if;
  r := coalesce(p_roles, '{}')::staff_role[];
  insert into store_permissions (store_id, permission, roles) values (my_store(), p_permission, r)
    on conflict (store_id, permission) do update set roles = excluded.roles;
  perform audit(my_store(), 'permission.save', 'store', my_store(), jsonb_build_object('permission', p_permission, 'roles', p_roles));
end $$;

-- Ganti pemeriksaan peran yang tertanam di fungsi lama dengan can_do(), tanpa menyalin ulang isi fungsinya.
create function pg_temp.patch_fn(p_fn regprocedure, p_from text, p_to text) returns void
language plpgsql as $$
declare def text := pg_get_functiondef(p_fn);
begin
  if position(p_from in def) = 0 then raise exception 'patch gagal: % tidak memuat "%"', p_fn, p_from; end if;
  execute replace(def, p_from, p_to);
end $$;
select pg_temp.patch_fn('receive_purchase(text, jsonb, text, text)', 'not is_manager()', 'not can_do(''purchase'')');
select pg_temp.patch_fn('stock_count(jsonb, text)', 'not is_manager()', 'not can_do(''stock_count'')');
select pg_temp.patch_fn('record_waste(uuid, numeric, text)', 'not role_in(array[''owner'', ''manager'', ''kitchen'']::staff_role[])', 'not can_do(''waste'')');
select pg_temp.patch_fn('set_item_done(uuid, int, boolean)', 'not role_in(array[''owner'', ''manager'', ''cashier'', ''kitchen'', ''waiter'']::staff_role[])', 'not can_do(''advance'')');
select pg_temp.patch_fn('advance_order(uuid, order_status)', 'step = ''IN_KITCHEN>READY'' and role_in(array[''owner'', ''manager'', ''cashier'', ''kitchen'']::staff_role[])', 'step = ''IN_KITCHEN>READY'' and can_do(''advance'')');
select pg_temp.patch_fn('advance_order(uuid, order_status)', 'step = ''READY>COMPLETED'' and role_in(array[''owner'', ''manager'', ''cashier'', ''kitchen'', ''waiter'']::staff_role[])', 'step = ''READY>COMPLETED'' and can_do(''advance'')');

-- ===== Daftar nama shift =====
create table shift_names (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 30),
  sort_order int not null default 0,
  is_active boolean not null default true
);
create index shift_names_store_idx on shift_names (store_id, sort_order);
alter table shift_names enable row level security;
create policy shift_names_read on shift_names for select to authenticated using (my_role() is not null and store_id = my_store());
revoke all on shift_names from anon;
revoke insert, update, delete on shift_names from authenticated;

-- nama disalin ke shift saat dibuka, supaya laporan lama tidak berubah bila daftar diedit
alter table shifts add column shift_name_id uuid references shift_names on delete set null;
alter table shifts add column shift_name text not null default '';

-- p_items: [{ "id": uuid | null, "name": text, "is_active": boolean }] berurutan sesuai tampilan
create function save_shift_names(p_items jsonb) returns void
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

drop function open_shift(int, text);
create function open_shift(p_opening_cash int, p_note text default '', p_shift_name uuid default null) returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare r shifts; cur shifts; prev shifts; sn shift_names; v_note text := btrim(coalesce(p_note, ''));
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_opening_cash is null or p_opening_cash < 0 then raise exception 'E:SHIFT_OPENING_INVALID'; end if;

  select * into cur from shifts where store_id = my_store() and closed_at is null;
  if found then
    raise exception 'E:SHIFT_HELD:%', jsonb_build_object('who', coalesce(email_of(cur.opened_by), ''), 'at', to_char(cur.opened_at at time zone 'Asia/Jakarta', 'HH24:MI'))::text;
  end if;

  -- toko yang punya daftar shift wajib memilih salah satunya
  if p_shift_name is not null then
    select * into sn from shift_names where id = p_shift_name and store_id = my_store() and is_active;
    if sn.id is null then raise exception 'Shift yang dipilih sudah tidak ada. Pilih shift lain.'; end if;
  elsif exists (select 1 from shift_names where store_id = my_store() and is_active) then
    raise exception 'Pilih dulu shift mana yang dibuka.';
  end if;

  select * into prev from shifts where store_id = my_store() and closed_at is not null order by closed_at desc limit 1;
  if prev.id is not null and p_opening_cash <> prev.counted_cash and length(v_note) < 3 then
    raise exception 'E:SHIFT_HANDOVER_DIFF:%', jsonb_build_object('opening', p_opening_cash, 'expected', prev.counted_cash)::text;
  end if;

  begin
    insert into shifts (store_id, opened_by, opening_cash, opening_expected, handover_from, opening_note, shift_name_id, shift_name)
      values (my_store(), auth.uid(), p_opening_cash, prev.counted_cash, prev.id, left(v_note, 200), sn.id, coalesce(sn.name, ''))
      returning * into r;
  exception when unique_violation then raise exception 'E:SHIFT_TAKEN';
  end;
  perform audit(r.store_id, 'shift.open', 'shift', r.id,
    jsonb_build_object('opening_cash', p_opening_cash, 'expected', prev.counted_cash, 'handover_from', email_of(prev.opened_by), 'shift_name', sn.name));
  return r;
end $$;

revoke all on function can_do(text), save_permission(text, text[]), save_shift_names(jsonb), open_shift(int, text, uuid) from public, anon;
grant execute on function can_do(text), save_permission(text, text[]), save_shift_names(jsonb), open_shift(int, text, uuid) to authenticated;
