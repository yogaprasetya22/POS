-- Rollback Migration 35
drop function if exists save_midtrans_payout_tax_settings(boolean, numeric, numeric, int);

alter table orders drop column if exists midtrans_net_amount;
alter table orders drop column if exists midtrans_tax;
alter table orders drop column if exists midtrans_fee;

alter table stores drop column if exists midtrans_auto_payout;
alter table stores drop column if exists midtrans_payout_fee;
alter table stores drop column if exists midtrans_tax_rate;
alter table stores drop column if exists midtrans_qris_mdr;
