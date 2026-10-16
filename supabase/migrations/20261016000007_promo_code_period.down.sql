-- Revert promo codes and campaign periods
alter table promotions drop column if exists code;
alter table promotions drop column if exists start_at;
alter table promotions drop column if exists end_at;
alter table orders drop column if exists promo_code;
