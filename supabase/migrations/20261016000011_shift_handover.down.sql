drop function if exists shift_stats(date, date), review_shift(uuid, text), shift_detail(uuid), shift_status(),
  force_close_shift(uuid, int, text), finish_shift(uuid, int, text, boolean), open_shift(int, text), email_of(uuid) cascade;
drop index if exists shifts_one_open_per_store_idx;
alter table shifts drop column opening_expected, drop column handover_from, drop column opening_note, drop column forced,
  drop column reviewed_by, drop column reviewed_at, drop column review_note;
-- fungsi open_shift(int) versi sebelumnya ada di migrasi 20261016000009; jalankan ulang bagian itu bila rollback dipakai.
