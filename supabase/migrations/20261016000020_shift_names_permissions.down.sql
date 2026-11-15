create function pg_temp.patch_fn(p_fn regprocedure, p_from text, p_to text) returns void
language plpgsql as $$
begin
  execute replace(pg_get_functiondef(p_fn), p_from, p_to);
end $$;
select pg_temp.patch_fn('receive_purchase(text, jsonb, text, text)', 'not can_do(''purchase'')', 'not is_manager()');
select pg_temp.patch_fn('stock_count(jsonb, text)', 'not can_do(''stock_count'')', 'not is_manager()');
select pg_temp.patch_fn('record_waste(uuid, numeric, text)', 'not can_do(''waste'')', 'not role_in(array[''owner'', ''manager'', ''kitchen'']::staff_role[])');
select pg_temp.patch_fn('set_item_done(uuid, int, boolean)', 'not can_do(''advance'')', 'not role_in(array[''owner'', ''manager'', ''cashier'', ''kitchen'', ''waiter'']::staff_role[])');
select pg_temp.patch_fn('advance_order(uuid, order_status)', 'step = ''IN_KITCHEN>READY'' and can_do(''advance'')', 'step = ''IN_KITCHEN>READY'' and role_in(array[''owner'', ''manager'', ''cashier'', ''kitchen'']::staff_role[])');
select pg_temp.patch_fn('advance_order(uuid, order_status)', 'step = ''READY>COMPLETED'' and can_do(''advance'')', 'step = ''READY>COMPLETED'' and role_in(array[''owner'', ''manager'', ''cashier'', ''kitchen'', ''waiter'']::staff_role[])');

drop function open_shift(int, text, uuid);
create function open_shift(p_opening_cash int, p_note text default '') returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare r shifts; cur shifts; prev shifts; v_note text := btrim(coalesce(p_note, ''));
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_opening_cash is null or p_opening_cash < 0 then raise exception 'E:SHIFT_OPENING_INVALID'; end if;
  select * into cur from shifts where store_id = my_store() and closed_at is null;
  if found then
    raise exception 'E:SHIFT_HELD:%', jsonb_build_object('who', coalesce(email_of(cur.opened_by), ''), 'at', to_char(cur.opened_at at time zone 'Asia/Jakarta', 'HH24:MI'))::text;
  end if;
  select * into prev from shifts where store_id = my_store() and closed_at is not null order by closed_at desc limit 1;
  if prev.id is not null and p_opening_cash <> prev.counted_cash and length(v_note) < 3 then
    raise exception 'E:SHIFT_HANDOVER_DIFF:%', jsonb_build_object('opening', p_opening_cash, 'expected', prev.counted_cash)::text;
  end if;
  begin
    insert into shifts (store_id, opened_by, opening_cash, opening_expected, handover_from, opening_note)
      values (my_store(), auth.uid(), p_opening_cash, prev.counted_cash, prev.id, left(v_note, 200))
      returning * into r;
  exception when unique_violation then raise exception 'E:SHIFT_TAKEN';
  end;
  perform audit(r.store_id, 'shift.open', 'shift', r.id,
    jsonb_build_object('opening_cash', p_opening_cash, 'expected', prev.counted_cash, 'handover_from', email_of(prev.opened_by)));
  return r;
end $$;
revoke all on function open_shift(int, text) from public, anon;
grant execute on function open_shift(int, text) to authenticated;

drop function save_shift_names(jsonb);
alter table shifts drop column shift_name, drop column shift_name_id;
drop table shift_names;
drop function save_permission(text, text[]);
drop function can_do(text);
drop function default_roles(text);
drop table store_permissions;
