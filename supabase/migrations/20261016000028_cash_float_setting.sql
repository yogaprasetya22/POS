-- Owner mengatur besar modal laci tokonya.
create or replace function set_cash_float(p_amount int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000000 then raise exception 'Modal laci tidak valid'; end if;
  update stores set cash_float = p_amount where id = my_store();
  perform audit(my_store(), 'store.cash_float', 'store', my_store(), jsonb_build_object('cash_float', p_amount));
end $$;
revoke all on function set_cash_float(int) from public, anon;
grant execute on function set_cash_float(int) to authenticated;
