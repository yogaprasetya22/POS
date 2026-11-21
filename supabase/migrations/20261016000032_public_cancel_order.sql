-- 20261016000032_public_cancel_order.sql
-- Izinkan pembeli membatalkan pesanan publik UNPAID miliknya agar langsung hilang dan meja bebas kembali

create or replace function public_cancel_order(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  ord orders;
begin
  select * into ord from orders where id = p_id for update;
  if not found then return false; end if;

  -- Hanya pesanan publik (created_by is null) yang berstatus UNPAID yang dapat dibatalkan oleh pembeli
  if ord.status = 'UNPAID' and ord.created_by is null then
    update orders set status = 'CANCELLED' where id = p_id;
    perform audit(ord.store_id, 'order.cancel', 'order', ord.id, jsonb_build_object('queue', ord.queue_code, 'by', 'customer'));
    return true;
  end if;

  return false;
end $$;

grant execute on function public_cancel_order(uuid) to anon, authenticated;

