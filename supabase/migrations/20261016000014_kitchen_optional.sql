-- Layar dapur opsional: tidak semua warung/kafe punya perangkat untuk dapur.
-- use_kitchen_screen = false: kasir/pelayan menandai "Sudah siap" & "Sudah diambil" dari halaman Antrean.
-- cook_minutes: perkiraan waktu masak; lewat dari ini kasir diingatkan (tanda kuning + toast).
alter table stores
  add column use_kitchen_screen boolean not null default true,
  add column cook_minutes int not null default 15 check (cook_minutes between 1 and 180);

create function save_kitchen_settings(p_use_kitchen_screen boolean, p_cook_minutes int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_cook_minutes is null or p_cook_minutes not between 1 and 180 then
    raise exception 'Waktu masak harus antara 1 sampai 180 menit';
  end if;
  update stores set use_kitchen_screen = coalesce(p_use_kitchen_screen, true), cook_minutes = p_cook_minutes
    where id = my_store();
  perform audit(my_store(), 'store.settings', 'store', my_store(),
    jsonb_build_object('use_kitchen_screen', p_use_kitchen_screen, 'cook_minutes', p_cook_minutes));
end $$;

revoke execute on function save_kitchen_settings(boolean, int) from public, anon;
grant execute on function save_kitchen_settings(boolean, int) to authenticated;
