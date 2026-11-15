-- Status pesanan untuk pembeli (tanpa login): hanya satu pesanan, dicari dengan id acak (uuid) yang
-- dikembalikan create_order ke HP pembeli itu sendiri. Tabel orders tetap tertutup untuk publik.
create function public_order_status(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id,
    'queue_code', o.queue_code,
    'status', o.status,
    'total', o.total,
    'order_type', o.order_type,
    'table_no', o.table_no,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i->>'name', 'qty', (i->>'qty')::int)), '[]'::jsonb) from jsonb_array_elements(o.items) i),
    'paid_at', o.paid_at,
    'created_at', o.created_at
  )
  from orders o
  where o.id = p_id;
$$;

revoke execute on function public_order_status(uuid) from public;
grant execute on function public_order_status(uuid) to anon, authenticated;
