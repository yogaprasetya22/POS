drop trigger if exists ingredients_portions on ingredients;
drop trigger if exists recipes_portions on recipes;
drop function if exists trg_ingredients_portions(), trg_recipes_portions(), refresh_portions(uuid);
alter table products drop column portions;
-- price_lines versi sebelumnya ada di 20261016000002_multi_tenant.sql.
