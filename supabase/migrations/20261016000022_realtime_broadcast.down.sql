drop trigger if exists orders_broadcast on orders;
drop trigger if exists shifts_broadcast_upd on shifts;
drop trigger if exists shifts_broadcast_ins on shifts;
drop trigger if exists products_broadcast on products;
drop function if exists trg_broadcast_order(), trg_broadcast_shift(), trg_broadcast_product();
