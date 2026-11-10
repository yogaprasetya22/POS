-- Nilai enum baru dipisah dari migrasi yang memakainya (nilai baru tidak boleh dipakai di transaksi yang sama).
alter type staff_role add value if not exists 'manager';
alter type staff_role add value if not exists 'waiter';
alter type staff_role add value if not exists 'kitchen';
alter type order_status add value if not exists 'VOID';
alter type order_status add value if not exists 'REFUNDED';
create extension if not exists pgcrypto with schema extensions;
