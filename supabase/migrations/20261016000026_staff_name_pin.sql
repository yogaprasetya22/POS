-- Nama tampilan karyawan + PIN pribadi untuk "Ganti orang" cepat di perangkat bersama.
-- Nama: tampil di header, pesan "laci dipegang …", rincian shift, dll (email_of kini mengembalikan nama bila ada).
-- PIN: disimpan terpisah dari profiles (profiles bisa dibaca staf toko; hash PIN 4 angka tidak boleh ikut terbaca).

alter table profiles add column if not exists display_name text not null default ''
  check (length(display_name) <= 40);

create table if not exists staff_pins (
  user_id uuid primary key references profiles (user_id) on delete cascade,
  pin_hash text not null,
  fails int not null default 0,
  locked_until timestamptz
);
alter table staff_pins enable row level security; -- tanpa policy: hanya lewat fungsi di bawah

-- Nama orang untuk ditampilkan: nama bila diisi, kalau tidak email.
create or replace function email_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(display_name), ''), email) from profiles where user_id = p_user
$$;

-- Ganti nama: diri sendiri, atau owner untuk staf di tokonya.
create or replace function set_staff_name(p_user_id uuid, p_name text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_user_id is distinct from auth.uid() then
    if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
    if not exists (select 1 from profiles where user_id = p_user_id and store_id = my_store()) then raise exception 'forbidden'; end if;
  end if;
  update profiles set display_name = left(btrim(coalesce(p_name, '')), 40) where user_id = p_user_id;
end $$;

-- Atur PIN pribadi (4-6 angka) untuk akun sendiri.
create or replace function set_my_pin(p_pin text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  if p_pin !~ '^\d{4,6}$' then raise exception 'PIN harus 4 sampai 6 angka'; end if;
  insert into staff_pins (user_id, pin_hash) values (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf')))
    on conflict (user_id) do update set pin_hash = excluded.pin_hash, fails = 0, locked_until = null;
end $$;

-- Sudahkah akun ini punya PIN?
create or replace function has_my_pin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_pins where user_id = auth.uid())
$$;

-- Cek PIN akun yang sedang aktif. null = cocok; selain itu kode alasan. 5x salah → kunci 5 menit.
create or replace function verify_my_pin(p_pin text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare r staff_pins;
begin
  select * into r from staff_pins where user_id = auth.uid();
  if r.user_id is null then return 'NO_PIN'; end if;
  if r.locked_until is not null and r.locked_until > now() then return 'LOCKED'; end if;
  if p_pin is not null and extensions.crypt(p_pin, r.pin_hash) = r.pin_hash then
    update staff_pins set fails = 0, locked_until = null where user_id = r.user_id;
    return null;
  end if;
  update staff_pins set
      locked_until = case when fails + 1 >= 5 then now() + interval '5 minutes' end,
      fails = case when fails + 1 >= 5 then 0 else fails + 1 end
    where user_id = r.user_id;
  return 'WRONG';
end $$;

revoke execute on function set_staff_name(uuid, text), set_my_pin(text), has_my_pin(), verify_my_pin(text) from public, anon;
grant execute on function set_staff_name(uuid, text), set_my_pin(text), has_my_pin(), verify_my_pin(text) to authenticated;
