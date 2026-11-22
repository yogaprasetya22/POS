-- Rollback Migration 37 (member tanpa nama diberi nama dari nomor HP agar lolos check lama)
update members set name = phone where btrim(name) = '';
alter table members drop constraint if exists members_name_check;
alter table members alter column name drop default;
alter table members add constraint members_name_check check (length(btrim(name)) between 1 and 60);
