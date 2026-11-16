drop function if exists save_store_identity(text, text);
alter table stores drop column if exists tagline, drop column if exists logo_url;
alter table products drop column if exists is_featured, drop column if exists description;
