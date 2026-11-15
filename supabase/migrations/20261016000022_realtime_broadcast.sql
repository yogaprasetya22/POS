-- Kabar langsung (tanpa refresh) lewat Supabase Realtime Broadcast:
--  * store:<store_id> / product : menu habis-tersedia & sisa porsi → halaman pembeli dan layar Jualan
--  * store:<store_id> / shift   : laci dibuka/ditutup → perangkat kasir lain
--  * order:<order_id> / status  : status pesanan → HP pembeli (pembeli tidak login, jadi tidak bisa memakai postgres_changes)
-- Isi pesan hanya data yang memang sudah publik (ketersediaan menu); shift & pesanan hanya sinyal "muat ulang".
create function trg_broadcast_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_available is distinct from old.is_available or new.portions is distinct from old.portions then
    perform realtime.send(jsonb_build_object('id', new.id, 'is_available', new.is_available, 'portions', new.portions), 'product', 'store:' || new.store_id, false);
  end if;
  return null;
end $$;
create trigger products_broadcast after update on products for each row execute function trg_broadcast_product();

create function trg_broadcast_shift() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'shift', 'store:' || new.store_id, false);
  return null;
end $$;
create trigger shifts_broadcast_ins after insert on shifts for each row execute function trg_broadcast_shift();
create trigger shifts_broadcast_upd after update of closed_at on shifts for each row execute function trg_broadcast_shift();

create function trg_broadcast_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform realtime.send('{}'::jsonb, 'status', 'order:' || new.id, false);
  end if;
  return null;
end $$;
create trigger orders_broadcast after update on orders for each row execute function trg_broadcast_order();
