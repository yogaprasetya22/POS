-- i18n: pesan peringatan shift dikirim sebagai KODE (mis. E:SHIFT_HELD:{"who":"…","at":"01.23"}) supaya aplikasi
-- bisa menerjemahkan & admin bisa menyunting kalimatnya. Teks tampil dirakit di aplikasi (src/shared/i18n).

alter table stores add column locale text not null default 'id' check (locale in ('id', 'jaksel', 'en'));

create table message_overrides (
  store_id uuid not null references stores on delete cascade,
  locale text not null check (locale in ('id', 'jaksel', 'en')),
  key text not null check (key ~ '^[a-z0-9_.]{3,60}$'),
  text text not null check (length(btrim(text)) between 1 and 400),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (store_id, locale, key)
);
alter table message_overrides enable row level security;
create policy message_overrides_read on message_overrides for select to authenticated using (my_role() is not null and store_id = my_store());
revoke all on message_overrides from anon;
revoke insert, update, delete on message_overrides from authenticated;

-- teks kosong = hapus (kembali ke bawaan)
create or replace function save_message(p_locale text, p_key text, p_text text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_locale not in ('id', 'jaksel', 'en') then raise exception 'invalid locale'; end if;
  if btrim(coalesce(p_text, '')) = '' then
    delete from message_overrides where store_id = my_store() and locale = p_locale and key = p_key;
  else
    insert into message_overrides (store_id, locale, key, text, updated_by) values (my_store(), p_locale, p_key, btrim(p_text), auth.uid())
      on conflict (store_id, locale, key) do update set text = excluded.text, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform audit(my_store(), 'messages.edit', 'store', my_store(), jsonb_build_object('locale', p_locale, 'key', p_key));
end $$;

create or replace function save_store_locale(p_locale text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_locale not in ('id', 'jaksel', 'en') then raise exception 'invalid locale'; end if;
  update stores set locale = p_locale where id = my_store();
  perform audit(my_store(), 'messages.locale', 'store', my_store(), jsonb_build_object('locale', p_locale));
end $$;

create or replace function open_shift(p_opening_cash int, p_note text default '') returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare r shifts; cur shifts; prev shifts; v_note text := btrim(coalesce(p_note, ''));
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_opening_cash is null or p_opening_cash < 0 then raise exception 'E:SHIFT_OPENING_INVALID'; end if;

  select * into cur from shifts where store_id = my_store() and closed_at is null;
  if found then
    raise exception 'E:SHIFT_HELD:%', jsonb_build_object('who', coalesce(email_of(cur.opened_by), ''), 'at', to_char(cur.opened_at at time zone 'Asia/Jakarta', 'HH24:MI'))::text;
  end if;

  select * into prev from shifts where store_id = my_store() and closed_at is not null order by closed_at desc limit 1;
  if prev.id is not null and p_opening_cash <> prev.counted_cash and length(v_note) < 3 then
    raise exception 'E:SHIFT_HANDOVER_DIFF:%', jsonb_build_object('opening', p_opening_cash, 'expected', prev.counted_cash)::text;
  end if;

  begin
    insert into shifts (store_id, opened_by, opening_cash, opening_expected, handover_from, opening_note)
      values (my_store(), auth.uid(), p_opening_cash, prev.counted_cash, prev.id, left(v_note, 200))
      returning * into r;
  exception when unique_violation then raise exception 'E:SHIFT_TAKEN';
  end;
  perform audit(r.store_id, 'shift.open', 'shift', r.id,
    jsonb_build_object('opening_cash', p_opening_cash, 'expected', prev.counted_cash, 'handover_from', email_of(prev.opened_by)));
  return r;
end $$;

create or replace function finish_shift(p_shift uuid, p_counted int, p_note text, p_forced boolean) returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare sh shifts; t record; d int; v_note text := btrim(coalesce(p_note, ''));
begin
  if p_counted is null or p_counted < 0 then raise exception 'E:AMOUNT_INVALID'; end if;
  select * into sh from shifts where id = p_shift and store_id = my_store() and closed_at is null for update;
  if not found then raise exception 'E:SHIFT_NONE'; end if;
  select * into t from shift_totals(sh.id);
  d := p_counted - t.expected;
  if d <> 0 and length(v_note) < 3 then raise exception 'E:SHIFT_DIFF_NEEDS_NOTE:%', jsonb_build_object('diff', d)::text; end if;
  if p_forced and length(v_note) < 3 then raise exception 'E:SHIFT_FORCE_REASON'; end if;
  update shifts set closed_at = now(), closed_by = auth.uid(), counted_cash = p_counted, expected_cash = t.expected,
      difference = d, note = left(v_note, 200), forced = p_forced
    where id = sh.id returning * into sh;
  perform audit(sh.store_id, case when p_forced then 'shift.force_close' else 'shift.close' end, 'shift', sh.id,
    jsonb_build_object('expected', sh.expected_cash, 'counted', sh.counted_cash, 'difference', sh.difference, 'opened_by', email_of(sh.opened_by)));
  return sh;
end $$;

create or replace function close_shift(p_counted_cash int, p_note text default '') returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid;
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  select id into sid from shifts where store_id = my_store() and opened_by = auth.uid() and closed_at is null;
  if sid is null then raise exception 'E:SHIFT_NONE'; end if;
  return finish_shift(sid, p_counted_cash, p_note, false);
end $$;

create or replace function force_close_shift(p_shift uuid, p_counted_cash int, p_note text) returns shifts
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  return finish_shift(p_shift, p_counted_cash, p_note, true);
end $$;

create or replace function review_shift(p_shift uuid, p_note text default '') returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  update shifts set reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(btrim(coalesce(p_note, '')), 200)
    where id = p_shift and store_id = my_store() and closed_at is not null;
  if not found then raise exception 'E:SHIFT_REVIEW_INVALID'; end if;
  perform audit(my_store(), 'shift.review', 'shift', p_shift, jsonb_build_object('note', left(btrim(coalesce(p_note, '')), 200)));
end $$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('open_shift', 'close_shift', 'force_close_shift', 'review_shift', 'save_message', 'save_store_locale') loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
  revoke execute on function finish_shift(uuid, int, text, boolean) from public, anon, authenticated;
end $$;
