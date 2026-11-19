-- Kembalikan shift_status & open_shift ke versi migrasi 011/020 dengan menjalankan ulang definisinya, lalu:
drop function if exists handover_cash(int, uuid);
alter table stores drop column if exists cash_float;
-- Catatan: jalankan ulang bagian shift_status dari 20261016000011_shift_handover.sql
-- dan open_shift dari 20261016000020_shift_names_permissions.sql setelah rollback ini.
