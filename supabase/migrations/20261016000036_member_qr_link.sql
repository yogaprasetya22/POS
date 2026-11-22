-- Migration 36: Member masuk tanpa password lewat QR dari kasir (Supabase Anonymous Sign-In).
-- Alur: kasir membuat QR sekali pakai (10 menit) -> HP pelanggan login anonim -> klaim QR -> akun anonim
-- itu terhubung ke baris members. Sesi anonim tersimpan di HP dan diperbarui otomatis (praktis selamanya).

-- 0. Akun anonim BUKAN staf: jangan buat profil, dan jangan boleh mendaftarkan toko.
create or replace function is_anon_user() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_anonymous, false) then return new; end if;
  insert into profiles (user_id, email) values (new.id, new.email);
  return new;
end $$;
revoke execute on function handle_new_user() from public, anon, authenticated;

create or replace function register_store(p_name text, p_slug text, p_wa text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare r uuid;
begin
  if auth.uid() is null or is_anon_user() then raise exception 'forbidden'; end if;
  if my_store() is not null or is_super() then raise exception 'Akun ini sudah terhubung ke toko'; end if;
  begin
    insert into stores (slug, name, wa_number, plan, plan_expires_at)
      values (lower(btrim(p_slug)), btrim(p_name), p_wa, 'trial', now() + interval '14 days') returning id into r;
  exception when unique_violation then raise exception 'Slug sudah dipakai toko lain';
  end;
  update profiles set store_id = r, role = 'owner' where user_id = auth.uid();
  perform audit(r, 'store.register', 'store', r, jsonb_build_object('slug', lower(btrim(p_slug))));
  return r;
end $$;

-- 1. Akun login yang terhubung ke member (satu akun = satu member per toko)
alter table members add column if not exists user_id uuid references auth.users on delete set null;
create unique index if not exists members_store_user_uniq on members (store_id, user_id) where user_id is not null;

-- 2. Token QR sekali pakai. Yang disimpan hanya hash-nya.
create table if not exists member_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  member_id uuid not null references members on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table member_links enable row level security; -- tanpa policy: hanya lewat fungsi di bawah

-- 3. Kasir/pelayan/manager membuat QR untuk member di tokonya sendiri
create or replace function create_member_link(p_member uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare m members; tok text; exp timestamptz := now() + interval '10 minutes';
begin
  if not role_in(array['owner', 'manager', 'cashier', 'waiter']::staff_role[]) then raise exception 'forbidden'; end if;
  select * into m from members where id = p_member and store_id = my_store();
  if m.id is null then raise exception 'Member tidak ditemukan'; end if;
  -- 2 UUID acak = ~244 bit, aman ditebak
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  -- QR lama yang belum dipakai untuk member ini dibatalkan
  update member_links set used_at = now() where member_id = m.id and used_at is null;
  insert into member_links (store_id, member_id, token_hash, expires_at, created_by)
    values (m.store_id, m.id, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), exp, auth.uid());
  return jsonb_build_object('token', tok, 'expires_at', exp, 'member_name', m.name);
end $$;

-- 4. HP pelanggan (sudah login anonim) menukar token -> terhubung ke member
create or replace function claim_member_link(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare l member_links; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Buka ulang tautan dari QR kasir'; end if;
  select * into l from member_links
    where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    for update;
  if l.id is null then raise exception 'QR tidak dikenal. Minta kasir menampilkan QR baru.'; end if;
  if l.used_at is not null then raise exception 'QR ini sudah dipakai. Minta kasir menampilkan QR baru.'; end if;
  if l.expires_at < now() then raise exception 'QR sudah kedaluwarsa. Minta kasir menampilkan QR baru.'; end if;

  update member_links set used_at = now() where id = l.id;
  -- akun ini mungkin sebelumnya terhubung ke member lain di toko yang sama: lepaskan dulu
  update members set user_id = null where store_id = l.store_id and user_id = uid and id <> l.member_id;
  update members set user_id = uid where id = l.member_id;
  return jsonb_build_object('member_id', l.member_id, 'store_id', l.store_id);
end $$;

-- 5. Kartu member milik akun yang sedang login (bisa lebih dari satu toko)
create or replace function my_member_cards() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(card order by card->>'store_name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'member_id', m.id,
      'store_name', s.name,
      'store_slug', s.slug,
      'name', m.name,
      'phone_tail', right(m.phone, 4),
      'points', m.points,
      'visits', m.visits,
      'total_spent', m.total_spent,
      'points_value', s.points_value,
      'since', m.created_at,
      'orders', coalesce((
        select jsonb_agg(jsonb_build_object('queue', o.queue_code, 'total', o.total, 'paid_at', o.paid_at, 'points', o.points_earned) order by o.paid_at desc)
        from (select * from orders where member_id = m.id and paid_at is not null order by paid_at desc limit 10) o
      ), '[]'::jsonb)
    ) as card
    from members m join stores s on s.id = m.store_id
    where auth.uid() is not null and m.user_id = auth.uid()
  ) x
$$;

-- 6. Lepas HP ini dari member (tombol "Keluar")
create or replace function leave_member(p_member uuid) returns void
language sql volatile security definer set search_path = public as $$
  update members set user_id = null where id = p_member and user_id = auth.uid()
$$;

grant execute on function create_member_link(uuid), claim_member_link(text), my_member_cards(), leave_member(uuid) to authenticated;
revoke execute on function create_member_link(uuid), claim_member_link(text), my_member_cards(), leave_member(uuid) from anon, public;
