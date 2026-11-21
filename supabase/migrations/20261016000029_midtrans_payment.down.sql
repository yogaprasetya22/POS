-- Rollback: Midtrans payment
drop function if exists pay_order_midtrans(uuid, text, text, text);
drop function if exists get_store_midtrans_client_config(uuid);
drop function if exists save_store_midtrans_settings(boolean, boolean, text, text);

alter table orders drop column if exists midtrans_status;
alter table orders drop column if exists midtrans_payment_type;
alter table orders drop column if exists midtrans_transaction_id;
alter table orders drop column if exists midtrans_redirect_url;
alter table orders drop column if exists midtrans_snap_token;

alter table stores drop column if exists midtrans_client_key;
alter table stores drop column if exists midtrans_server_key;
alter table stores drop column if exists midtrans_is_production;
alter table stores drop column if exists midtrans_enabled;

