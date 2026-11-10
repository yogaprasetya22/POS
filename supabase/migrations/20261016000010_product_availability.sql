-- Kasir & dapur perlu menandai menu habis tanpa hak mengubah harga/katalog (itu tetap owner/manager).
create function set_product_availability(p_product uuid, p_available boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not role_in(array['owner', 'manager', 'cashier', 'kitchen']::staff_role[]) then raise exception 'forbidden'; end if;
  update products set is_available = p_available where id = p_product and store_id = my_store();
  if not found then raise exception 'Menu tidak ditemukan'; end if;
end $$;
revoke execute on function set_product_availability(uuid, boolean) from public, anon;
grant execute on function set_product_availability(uuid, boolean) to authenticated;
