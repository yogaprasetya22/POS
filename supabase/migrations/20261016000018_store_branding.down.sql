drop function if exists save_store_branding(text, text);
alter table stores drop column if exists theme;
alter table stores drop column if exists logo;
