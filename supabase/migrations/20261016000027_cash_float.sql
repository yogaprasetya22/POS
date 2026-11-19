-- Modal laci tetap per toko. Sebelumnya modal shift berikutnya = SELURUH uang hasil hitung shift sebelumnya,
-- jadi hasil penjualan terus terbawa dan menumpuk. Sekarang: saat tutup kasir, uang di atas modal = setoran ke owner;
-- yang ditinggal di laci (dan jadi modal shift berikutnya) = min(uang dihitung, modal laci).
alter table stores add column if not exists cash_float int not null default 100000 check (cash_float >= 0);

-- Uang yang ditinggal di laci setelah shift p ditutup.
create or replace function handover_cash(p_counted int, p_store uuid) returns int
language sql stable security definer set search_path = public as $$
  select least(coalesce(p_counted, 0), (select cash_float from stores where id = p_store))
$$;

create or replace function shift_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cur shifts; prev shifts; keep int;
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  select * into cur from shifts where store_id = my_store() and closed_at is null;
  select * into prev from shifts where store_id = my_store() and closed_at is not null order by closed_at desc limit 1;
  keep := case when prev.id is null then null else handover_cash(prev.counted_cash, prev.store_id) end;
  return jsonb_build_object(
    'cash_float', (select cash_float from stores where id = my_store()),
    'open', case when cur.id is null then null else jsonb_build_object(
      'id', cur.id, 'who', email_of(cur.opened_by), 'opened_at', cur.opened_at, 'mine', cur.opened_by = auth.uid()) end,
    -- counted_cash = uang yang ditinggal di laci (modal shift berikutnya); deposit = disetor ke owner
    'last_closed', case when prev.id is null then null else jsonb_build_object(
      'counted_cash', keep, 'total_counted', prev.counted_cash, 'deposit', prev.counted_cash - keep,
      'closed_at', prev.closed_at, 'who', email_of(prev.closed_by), 'difference', prev.difference) end);
end $$;

create or replace function open_shift(p_opening_cash int, p_note text default '', p_shift_name uuid default null) returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare r shifts; cur shifts; prev shifts; sn shift_names; v_note text := btrim(coalesce(p_note, '')); keep int;
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_opening_cash is null or p_opening_cash < 0 then raise exception 'E:SHIFT_OPENING_INVALID'; end if;

  select * into cur from shifts where store_id = my_store() and closed_at is null;
  if found then
    raise exception 'E:SHIFT_HELD:%', jsonb_build_object('who', coalesce(email_of(cur.opened_by), ''), 'at', to_char(cur.opened_at at time zone 'Asia/Jakarta', 'HH24:MI'))::text;
  end if;

  if p_shift_name is not null then
    select * into sn from shift_names where id = p_shift_name and store_id = my_store() and is_active;
    if sn.id is null then raise exception 'Shift yang dipilih sudah tidak ada. Pilih shift lain.'; end if;
  elsif exists (select 1 from shift_names where store_id = my_store() and is_active) then
    raise exception 'Pilih dulu shift mana yang dibuka.';
  end if;

  select * into prev from shifts where store_id = my_store() and closed_at is not null order by closed_at desc limit 1;
  keep := case when prev.id is null then null else handover_cash(prev.counted_cash, prev.store_id) end;
  if keep is not null and p_opening_cash <> keep and length(v_note) < 3 then
    raise exception 'E:SHIFT_HANDOVER_DIFF:%', jsonb_build_object('opening', p_opening_cash, 'expected', keep)::text;
  end if;

  begin
    insert into shifts (store_id, opened_by, opening_cash, opening_expected, handover_from, opening_note, shift_name_id, shift_name)
      values (my_store(), auth.uid(), p_opening_cash, keep, prev.id, left(v_note, 200), sn.id, coalesce(sn.name, ''))
      returning * into r;
  exception when unique_violation then raise exception 'E:SHIFT_TAKEN';
  end;
  perform audit(r.store_id, 'shift.open', 'shift', r.id,
    jsonb_build_object('opening_cash', p_opening_cash, 'expected', keep, 'deposit_prev', prev.counted_cash - keep, 'handover_from', email_of(prev.opened_by), 'shift_name', sn.name));
  return r;
end $$;

revoke all on function handover_cash(int, uuid) from public, anon;
grant execute on function handover_cash(int, uuid) to authenticated;
