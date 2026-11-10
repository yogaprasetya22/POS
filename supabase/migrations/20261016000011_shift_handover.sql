-- Shift yang transparan dan teratur:
--  * satu laci = satu shift terbuka per toko; pergantian kasir lewat serah terima (tutup lalu buka)
--  * modal awal shift berikutnya harus sama dengan uang hasil hitung shift sebelumnya (beda = wajib catatan)
--  * selisih wajib dijelaskan; manager bisa tutup paksa shift yang terlupa dan meninjau selisih
--  * rincian selisih per shift (pesanan tunai, siapa yang membuat & menerima, kas masuk/keluar, refund)

alter table shifts
  add column opening_expected int,                       -- uang hasil hitung shift sebelumnya (yang seharusnya jadi modal)
  add column handover_from uuid references shifts,
  add column opening_note text not null default '',
  add column forced boolean not null default false,      -- ditutup paksa oleh manager
  add column reviewed_by uuid,
  add column reviewed_at timestamptz,
  add column review_note text not null default '';

create unique index shifts_one_open_per_store_idx on shifts (store_id) where closed_at is null;

create or replace function email_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select email from profiles where user_id = p_user
$$;

-- ===== Buka shift =====
drop function if exists open_shift(int);
create or replace function open_shift(p_opening_cash int, p_note text default '') returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare r shifts; cur shifts; prev shifts; v_note text := btrim(coalesce(p_note, ''));
begin
  if not role_in(array['owner', 'manager', 'cashier']::staff_role[]) then raise exception 'forbidden'; end if;
  if p_opening_cash is null or p_opening_cash < 0 then raise exception 'Modal awal tidak valid'; end if;

  select * into cur from shifts where store_id = my_store() and closed_at is null;
  if found then
    raise exception 'Shift % masih terbuka sejak %. Lakukan serah terima: minta dia menutup shift, atau manager menutup paksa.',
      coalesce(email_of(cur.opened_by), 'kasir lain'), to_char(cur.opened_at at time zone 'Asia/Jakarta', 'HH24:MI');
  end if;

  select * into prev from shifts where store_id = my_store() and closed_at is not null order by closed_at desc limit 1;
  if prev.id is not null and p_opening_cash <> prev.counted_cash and length(v_note) < 3 then
    raise exception 'Modal awal Rp% berbeda dari uang serah terima Rp% (hasil hitung shift sebelumnya). Isi catatan penyebabnya.',
      p_opening_cash, prev.counted_cash;
  end if;

  begin
    insert into shifts (store_id, opened_by, opening_cash, opening_expected, handover_from, opening_note)
      values (my_store(), auth.uid(), p_opening_cash, prev.counted_cash, prev.id, left(v_note, 200))
      returning * into r;
  exception when unique_violation then raise exception 'Shift baru saja dibuka oleh kasir lain';
  end;
  perform audit(r.store_id, 'shift.open', 'shift', r.id,
    jsonb_build_object('opening_cash', p_opening_cash, 'expected', prev.counted_cash, 'handover_from', email_of(prev.opened_by)));
  return r;
end $$;

-- ===== Tutup shift =====
create or replace function finish_shift(p_shift uuid, p_counted int, p_note text, p_forced boolean) returns shifts
language plpgsql volatile security definer set search_path = public as $$
declare sh shifts; t record; d int; v_note text := btrim(coalesce(p_note, ''));
begin
  if p_counted is null or p_counted < 0 then raise exception 'Jumlah uang tidak valid'; end if;
  select * into sh from shifts where id = p_shift and store_id = my_store() and closed_at is null for update;
  if not found then raise exception 'Tidak ada shift yang terbuka'; end if;
  select * into t from shift_totals(sh.id);
  d := p_counted - t.expected;
  if d <> 0 and length(v_note) < 3 then raise exception 'Ada selisih Rp%. Isi catatan penyebabnya.', d; end if;
  if p_forced and length(v_note) < 3 then raise exception 'Alasan tutup paksa wajib diisi'; end if;
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
  if sid is null then raise exception 'Tidak ada shift yang terbuka'; end if;
  return finish_shift(sid, p_counted_cash, p_note, false);
end $$;

-- Manager menutup shift yang terlupa / kasirnya sudah pulang.
create or replace function force_close_shift(p_shift uuid, p_counted_cash int, p_note text) returns shifts
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  return finish_shift(p_shift, p_counted_cash, p_note, true);
end $$;

-- ===== Status shift toko (siapa yang memegang laci, uang serah terima) =====
create or replace function shift_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cur shifts; prev shifts;
begin
  if my_role() is null then raise exception 'forbidden'; end if;
  select * into cur from shifts where store_id = my_store() and closed_at is null;
  select * into prev from shifts where store_id = my_store() and closed_at is not null order by closed_at desc limit 1;
  return jsonb_build_object(
    'open', case when cur.id is null then null else jsonb_build_object(
      'id', cur.id, 'who', email_of(cur.opened_by), 'opened_at', cur.opened_at, 'mine', cur.opened_by = auth.uid()) end,
    'last_closed', case when prev.id is null then null else jsonb_build_object(
      'counted_cash', prev.counted_cash, 'closed_at', prev.closed_at, 'who', email_of(prev.closed_by), 'difference', prev.difference) end);
end $$;

-- ===== Rincian satu shift =====
create or replace function shift_detail(p_shift uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sh shifts; t record; ord jsonb; rev jsonb; mv jsonb; bym jsonb;
begin
  select * into sh from shifts where id = p_shift and store_id = my_store() and (is_manager() or opened_by = auth.uid());
  if not found then raise exception 'Shift tidak ditemukan'; end if;
  select * into t from shift_totals(sh.id);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'queue_code', o.queue_code, 'customer_name', o.customer_name, 'order_type', o.order_type, 'table_no', o.table_no,
      'total', o.total, 'payment_method', o.payment_method, 'status', o.status, 'paid_at', o.paid_at,
      'source', case when o.created_by is null then 'CUSTOMER' else 'STAFF' end,
      'created_by', email_of(o.created_by), 'paid_by', email_of(o.paid_by),
      'void_reason', o.void_reason, 'voided_by', email_of(o.voided_by), 'voided_at', o.voided_at,
      'counted', (o.status not in ('VOID', 'REFUNDED') or o.reversal_shift_id is distinct from sh.id)
    ) order by o.paid_at), '[]') into ord
    from orders o where o.shift_id = sh.id;

  -- refund/void tunai atas pesanan shift lain yang uangnya keluar dari laci shift ini
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'queue_code', o.queue_code, 'customer_name', o.customer_name, 'total', o.total, 'payment_method', o.payment_method,
      'status', o.status, 'void_reason', o.void_reason, 'voided_by', email_of(o.voided_by), 'voided_at', o.voided_at
    ) order by o.voided_at), '[]') into rev
    from orders o where o.reversal_shift_id = sh.id and o.shift_id is distinct from sh.id and o.payment_method = 'CASH';

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'kind', m.kind, 'amount', m.amount, 'reason', m.reason, 'by', email_of(m.user_id), 'at', m.created_at
    ) order by m.created_at), '[]') into mv from cash_movements m where m.shift_id = sh.id;

  select coalesce(jsonb_object_agg(payment_method, x), '{}') into bym from (
    select payment_method, jsonb_build_object('count', count(*), 'total', sum(total)) x
      from orders where shift_id = sh.id and status not in ('VOID', 'REFUNDED') group by payment_method) q;

  return jsonb_build_object(
    'shift', jsonb_build_object(
      'id', sh.id, 'opened_by', email_of(sh.opened_by), 'opened_at', sh.opened_at, 'closed_by', email_of(sh.closed_by), 'closed_at', sh.closed_at,
      'opening_cash', sh.opening_cash, 'opening_expected', sh.opening_expected, 'opening_note', sh.opening_note,
      'counted_cash', sh.counted_cash, 'expected_cash', coalesce(sh.expected_cash, t.expected), 'difference', sh.difference,
      'note', sh.note, 'forced', sh.forced, 'handover_from', (select email_of(p.opened_by) from shifts p where p.id = sh.handover_from),
      'reviewed_by', email_of(sh.reviewed_by), 'reviewed_at', sh.reviewed_at, 'review_note', sh.review_note),
    'totals', jsonb_build_object('opening', t.opening, 'cash_sales', t.cash_sales, 'cash_in', t.cash_in, 'cash_out', t.cash_out,
      'cash_reversals', t.cash_reversals, 'expected', t.expected),
    'orders', ord, 'reversals', rev, 'movements', mv, 'by_method', bym);
end $$;

-- ===== Tinjauan manager =====
create or replace function review_shift(p_shift uuid, p_note text default '') returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  update shifts set reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(btrim(coalesce(p_note, '')), 200)
    where id = p_shift and store_id = my_store() and closed_at is not null;
  if not found then raise exception 'Shift belum ditutup atau tidak ditemukan'; end if;
  perform audit(my_store(), 'shift.review', 'shift', p_shift, jsonb_build_object('note', left(btrim(coalesce(p_note, '')), 200)));
end $$;

-- ===== Statistik selisih per periode =====
create or replace function shift_stats(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then raise exception 'Rentang tanggal tidak valid'; end if;
  with s as (
    select * from shifts where store_id = my_store() and (opened_at at time zone 'Asia/Jakarta')::date between p_from and p_to
  )
  select jsonb_build_object(
    'open_now', (select count(*) from shifts where store_id = my_store() and closed_at is null),
    'closed', (select count(*) from s where closed_at is not null),
    'diff_total', (select coalesce(sum(difference), 0) from s where closed_at is not null),
    'short_total', (select coalesce(sum(least(difference, 0)), 0) from s where closed_at is not null),
    'over_total', (select coalesce(sum(greatest(difference, 0)), 0) from s where closed_at is not null),
    'with_diff', (select count(*) from s where closed_at is not null and difference <> 0),
    'unreviewed', (select count(*) from s where closed_at is not null and difference <> 0 and reviewed_at is null),
    'handover_mismatch', (select count(*) from s where opening_expected is not null and opening_cash <> opening_expected),
    'forced', (select count(*) from s where forced),
    'by_cashier', (select coalesce(jsonb_agg(to_jsonb(x) order by x.diff_sum), '[]') from (
        select coalesce(email_of(opened_by), '—') as cashier, count(*) filter (where closed_at is not null) as shifts,
          coalesce(sum(difference) filter (where closed_at is not null), 0) as diff_sum,
          coalesce(sum(least(difference, 0)) filter (where closed_at is not null), 0) as short_sum,
          count(*) filter (where closed_at is not null and difference <> 0) as with_diff
        from s group by opened_by) x)
  ) into r;
  return r;
end $$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('email_of', 'finish_shift') loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('open_shift', 'close_shift', 'force_close_shift', 'shift_status', 'shift_detail', 'review_shift', 'shift_stats') loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
