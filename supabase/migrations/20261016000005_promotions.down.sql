alter table orders drop column if exists discount_amount cascade;
alter table orders drop column if exists promo_name cascade;
drop function if exists calculate_order_promo(uuid, jsonb, int) cascade;
drop table if exists promotions cascade;
