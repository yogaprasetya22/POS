-- Migration 38: Perangkat kasir terikat ke toko (device binding) + masuk kasir pakai PIN.
-- Alur:
--   1. Manager/owner login di perangkat baru -> bind_device() -> token acak disimpan di perangkat,
--      di database hanya hash-nya.
--   2. Layar kunci: daftar staf toko (device_staff) -> pilih nama -> PIN.
--   3. Server (/api/device, service role) memanggil device_check_pin(); bila cocok server membuat sesi
--      Supabase untuk staf tsb. Jadi kasir TIDAK pernah perlu email/password di perangkat ini.
-- PIN tetap di staff_pins (bcrypt). Transaksi tetap tercatat lewat auth.uid() = kasir yang membuka sesi.

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  token_hash text not null unique,
  bound_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  -- pembatas tebak PIN per perangkat (selain per orang): 10x salah -> perangkat dikunci 2 menit
  fails int not null default 0,
  locked_until timestamptz
);
alter table devices enable row level security;
drop policy if exists devices_read on devices;
create policy devices_read on devices for select to authenticated using (store_id = my_store() and is_manager());

create or replace function device_hash(p_token text) returns text
language sql immutable as $$ select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') $$;

-- Ikat perangkat ini ke toko. Hanya owner/manager. Mengembalikan token mentah SEKALI.
create or replace function bind_device(p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); d devices;
begin
  if not is_manager() then raise exception 'Hanya owner atau manager yang bisa mengaktifkan perangkat'; end if;
  insert into devices (store_id, name, token_hash, bound_by)
    values (my_store(), btrim(coalesce(p_name, '')), device_hash(tok), auth.uid()) returning * into d;
  perform audit(d.store_id, 'device.bind', 'device', d.id, jsonb_build_object('name', d.name));
  return jsonb_build_object('device_id', d.id, 'token', tok, 'name', d.name,
    'store_name', (select name from stores where id = d.store_id));
end $$;

-- Putuskan perangkat. Hanya owner/manager toko itu.
create or replace function unbind_device(p_device uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare d devices;
begin
  if not is_manager() then raise exception 'Hanya owner atau manager yang bisa memutuskan perangkat'; end if;
  update devices set revoked_at = now() where id = p_device and store_id = my_store() and revoked_at is null returning * into d;
  if d.id is null then raise exception 'Perangkat tidak ditemukan'; end if;
  perform audit(d.store_id, 'device.unbind', 'device', d.id, jsonb_build_object('name', d.name));
end $$;

-- Manager/owner mengatur atau mereset PIN staf di tokonya (4-6 angka, bcrypt).
create or replace function set_staff_pin(p_user uuid, p_pin text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if not exists (select 1 from profiles where user_id = p_user and store_id = my_store()) then raise exception 'forbidden'; end if;
  if p_pin !~ '^\d{4,6}$' then raise exception 'PIN harus 4 sampai 6 angka'; end if;
  insert into staff_pins (user_id, pin_hash) values (p_user, extensions.crypt(p_pin, extensions.gen_salt('bf')))
    on conflict (user_id) do update set pin_hash = excluded.pin_hash, fails = 0, locked_until = null;
  perform audit(my_store(), 'pin.set', 'profile', null, jsonb_build_object('user', email_of(p_user), 'by_manager', true));
end $$;

-- Staf mana saja yang sudah punya PIN (untuk daftar Tim).
create or replace function staff_pin_status() returns table (user_id uuid, has_pin boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id, exists (select 1 from staff_pins s where s.user_id = p.user_id)
  from profiles p where p.store_id = my_store() and is_manager()
$$;

-- ===== Fungsi untuk server (/api/device, service role). Tidak bisa dipanggil dari browser. =====

-- Info perangkat + daftar staf yang bisa masuk (sudah punya PIN).
create or replace function device_staff(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare d devices;
begin
  select * into d from devices where token_hash = device_hash(p_token) and revoked_at is null;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'UNBOUND'); end if;
  update devices set last_seen_at = now() where id = d.id;
  return jsonb_build_object(
    'ok', true,
    'device', jsonb_build_object('id', d.id, 'name', d.name),
    'store', (select jsonb_build_object('id', s.id, 'name', s.name) from stores s where s.id = d.store_id),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', coalesce(nullif(btrim(p.display_name), ''), split_part(p.email, '@', 1)), 'role', p.role)
        order by coalesce(nullif(btrim(p.display_name), ''), p.email))
      from profiles p join staff_pins sp on sp.user_id = p.user_id
      where p.store_id = d.store_id and p.role is not null
    ), '[]'::jsonb)
  );
end $$;

-- Cek PIN staf di perangkat terikat. Hasil: ok + email (untuk dibuatkan sesi) atau alasan.
-- 5x salah untuk orang yang sama -> orang itu dikunci 30 detik. 10x salah di perangkat -> perangkat dikunci 2 menit.
create or replace function device_check_pin(p_token text, p_user uuid, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare d devices; r staff_pins; pr profiles;
begin
  select * into d from devices where token_hash = device_hash(p_token) and revoked_at is null for update;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'UNBOUND'); end if;
  if d.locked_until is not null and d.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'DEVICE_LOCKED', 'until', d.locked_until);
  end if;

  select * into pr from profiles where user_id = p_user and store_id = d.store_id and role is not null;
  select * into r from staff_pins where user_id = p_user for update;
  if pr.user_id is null or r.user_id is null then return jsonb_build_object('ok', false, 'reason', 'NO_PIN'); end if;
  if r.locked_until is not null and r.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'LOCKED', 'until', r.locked_until);
  end if;

  if p_pin ~ '^\d{4,6}$' and extensions.crypt(p_pin, r.pin_hash) = r.pin_hash then
    update staff_pins set fails = 0, locked_until = null where user_id = r.user_id;
    update devices set fails = 0, locked_until = null, last_seen_at = now() where id = d.id;
    perform audit(d.store_id, 'device.login', 'device', d.id, jsonb_build_object('user', email_of(p_user), 'device', d.name));
    return jsonb_build_object('ok', true, 'email', (select email from auth.users where id = p_user));
  end if;

  update staff_pins set
      locked_until = case when fails + 1 >= 5 then now() + interval '30 seconds' end,
      fails = case when fails + 1 >= 5 then 0 else fails + 1 end
    where user_id = r.user_id returning * into r;
  update devices set
      locked_until = case when fails + 1 >= 10 then now() + interval '2 minutes' end,
      fails = case when fails + 1 >= 10 then 0 else fails + 1 end
    where id = d.id returning * into d;
  if r.locked_until is not null then return jsonb_build_object('ok', false, 'reason', 'LOCKED', 'until', r.locked_until); end if;
  if d.locked_until is not null then return jsonb_build_object('ok', false, 'reason', 'DEVICE_LOCKED', 'until', d.locked_until); end if;
  return jsonb_build_object('ok', false, 'reason', 'WRONG', 'left', 5 - r.fails);
end $$;

revoke execute on function bind_device(text), unbind_device(uuid), set_staff_pin(uuid, text), staff_pin_status() from public, anon;
grant execute on function bind_device(text), unbind_device(uuid), set_staff_pin(uuid, text), staff_pin_status() to authenticated;
-- khusus server
revoke execute on function device_staff(text), device_check_pin(text, uuid, text) from public, anon, authenticated;
grant execute on function device_staff(text), device_check_pin(text, uuid, text) to service_role;
