drop policy if exists product_images_owner on storage.objects;
drop table if exists orders, daily_counters, products, categories, settings, profiles cascade;
drop function if exists my_role, price_lines, create_order, update_order_lines, pay_order, advance_order, expire_stale_orders cascade;
drop type if exists order_status, order_type, payment_method, staff_role cascade;
