-- Status baru untuk pesanan UNPAID yang menggantung > 45 menit (dipakai migrasi berikutnya;
-- nilai enum baru tidak boleh dipakai di transaksi yang sama, jadi dipisah).
alter type order_status add value if not exists 'EXPIRED';
