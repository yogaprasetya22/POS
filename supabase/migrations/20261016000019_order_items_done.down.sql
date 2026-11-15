drop function if exists set_item_done(uuid, int, boolean);
alter table orders drop column if exists items_done;
