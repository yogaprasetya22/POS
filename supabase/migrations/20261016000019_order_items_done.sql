-- Centang per menu: dapur/kasir menandai menu yang sudah jadi satu per satu.
-- items_done berisi nomor urut baris di orders.items (mulai 0). Semua tercentang → pesanan otomatis READY.
alter table orders add column if not exists items_done int[] not null default '{}';

create or replace function set_item_done(p_order_id uuid, p_index int, p_done boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare o orders; n int; done int[];
begin
  if not role_in(array['owner', 'manager', 'cashier', 'kitchen', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  select * into o from orders where id = p_order_id and store_id = my_store() for update;
  if not found or o.status <> 'IN_KITCHEN' then raise exception 'Pesanan ini sudah tidak sedang dimasak. Muat ulang halaman.'; end if;
  n := jsonb_array_length(o.items);
  if p_index < 0 or p_index >= n then raise exception 'Menu tidak ditemukan di pesanan ini.'; end if;
  done := array_remove(o.items_done, p_index);
  if p_done then done := done || p_index; end if;
  update orders set items_done = done, status = case when cardinality(done) >= n then 'READY'::order_status else status end where id = o.id;
end $$;
revoke all on function set_item_done(uuid, int, boolean) from public, anon;
grant execute on function set_item_done(uuid, int, boolean) to authenticated;
