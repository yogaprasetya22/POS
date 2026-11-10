-- Rollback POS inti (nilai enum dari 0008 tidak ikut dihapus).
drop function if exists sales_report(date, date), set_store_plan(uuid, text, timestamptz), register_store(text, text, text),
  save_store_settings(int, boolean, int, int, int, int, text, text), stock_adjust(uuid, numeric, text, text),
  delete_voucher(uuid), create_voucher(text, text, int, uuid, timestamptz, text), adjust_points(uuid, int, text),
  upsert_member(text, text), merge_orders(uuid, uuid), split_order(uuid, int[]), close_shift(int, text),
  cash_movement(text, int, text), shift_summary(uuid), open_shift(int), shift_totals(uuid), reverse_order(uuid, text, text, text),
  check_pin(text), set_supervisor_pin(text), apply_order_extras(uuid, text, uuid, int), quote_order(uuid, jsonb, text, uuid, int),
  compute_order(uuid, jsonb, text, uuid, int), compute_from_items(uuid, jsonb, text, uuid, int), apply_amounts(uuid, jsonb),
  next_queue_code(uuid), calc_charges(uuid, int), audit(uuid, text, text, uuid, jsonb), role_in(staff_role[]),
  is_manager(), today_jkt() cascade;
drop function if exists create_order(uuid, text, order_type, text, jsonb, text, uuid, int);
alter table orders
  drop column subtotal, drop column voucher_id, drop column voucher_discount, drop column member_id,
  drop column points_redeemed, drop column points_discount, drop column points_earned, drop column service_amount,
  drop column tax_amount, drop column rounding_amount, drop column shift_id, drop column paid_by, drop column created_by,
  drop column void_reason, drop column voided_at, drop column voided_by, drop column reversal_shift_id;
drop table if exists stock_movements, recipes, ingredients, cash_movements, shifts, vouchers, point_ledger, members,
  store_tables, audit_log, store_secrets cascade;
alter table stores
  drop column tax_bp, drop column tax_inclusive, drop column service_bp, drop column rounding_to, drop column points_earn_per,
  drop column points_value, drop column receipt_footer, drop column address, drop column plan, drop column plan_expires_at;
