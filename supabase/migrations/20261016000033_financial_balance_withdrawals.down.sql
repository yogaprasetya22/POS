-- Down migration: 20261016000033_financial_balance_withdrawals
drop function if exists get_store_financial_summary();
drop function if exists request_withdrawal(int, text, text, text, text, boolean);
drop function if exists get_withdrawals(int);
drop function if exists save_store_bank_account(text, text, text);

drop table if exists withdrawals cascade;

alter table stores
  drop column if exists bank_name,
  drop column if exists account_number,
  drop column if exists account_holder,
  drop column if exists midtrans_iris_api_key;
