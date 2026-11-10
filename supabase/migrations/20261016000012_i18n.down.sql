drop function if exists save_message(text, text, text), save_store_locale(text);
drop table if exists message_overrides;
alter table stores drop column locale;
-- fungsi shift versi teks biasa ada di migrasi 20261016000011.
