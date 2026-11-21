-- RPC helper untuk membaca dan memperbarui sesi Midtrans dari order id tanpa terhalang RLS anon

create or replace function get_order_for_midtrans(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id,
    'queue_code', o.queue_code,
    'status', o.status,
    'total', o.total,
    'order_type', o.order_type,
    'table_no', o.table_no,
    'customer_name', o.customer_name,
    'store_id', o.store_id,
    'midtrans_transaction_id', o.midtrans_transaction_id
  )
  from orders o
  where o.id = p_id;
$$;

create or replace function update_order_midtrans_session(
  p_id uuid,
  p_snap_token text default null,
  p_redirect_url text default null,
  p_transaction_id text default null,
  p_payment_type text default null
) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update orders set
    midtrans_snap_token = coalesce(p_snap_token, midtrans_snap_token),
    midtrans_redirect_url = coalesce(p_redirect_url, midtrans_redirect_url),
    midtrans_transaction_id = coalesce(p_transaction_id, midtrans_transaction_id),
    midtrans_payment_type = coalesce(p_payment_type, midtrans_payment_type),
    midtrans_status = 'pending'
  where id = p_id;
end $$;

grant execute on function get_order_for_midtrans(uuid) to anon, authenticated;
grant execute on function update_order_midtrans_session(uuid, text, text, text, text) to anon, authenticated;

