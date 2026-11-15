drop function if exists cancel_purchase(uuid), pay_purchase(uuid, int, text), receive_purchase_order(uuid, jsonb, text, boolean),
  save_purchase_order(uuid, uuid, jsonb, text, boolean), save_supplier(uuid, text, text, text, boolean), profit_report(date, date), shift_stock(uuid);
drop policy purchases_read on purchases;
create policy purchases_read on purchases for select to authenticated using (is_manager() and store_id = my_store());
drop policy purchase_items_read on purchase_items;
create policy purchase_items_read on purchase_items for select to authenticated using (is_manager() and store_id = my_store());
delete from purchases where status <> 'RECEIVED';
alter table purchase_items drop column received_qty;
alter table purchases drop column supplier_id, drop column status, drop column unpaid, drop column ordered_at, drop column received_at;
drop table suppliers;
