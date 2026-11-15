drop function if exists save_kitchen_settings(boolean, int);
alter table stores drop column if exists cook_minutes, drop column if exists use_kitchen_screen;
