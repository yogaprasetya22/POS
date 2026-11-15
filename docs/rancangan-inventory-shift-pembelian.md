# Rancangan: Inventory, Shift Kerja, dan Pembelian

Status: **keputusan sudah diambil (lihat bagian 5)**. Belum ada kode atau migrasi yang dibuat.

Prinsip yang dipakai, sama dengan aplikasi saat ini:

- Stok dan uang hanya berubah lewat fungsi database (bukan dari layar), dan setiap perubahan tercatat.
- Satu layar, satu tujuan. Bahasa sehari-hari, misalnya "Barang masuk", bukan "Goods Receipt".
- Fitur lanjutan disembunyikan, sehingga warung kecil cukup memakai bagian dasarnya.

---

## 0. Yang sudah ada (titik awal)

| Bagian | Sudah ada | Belum ada |
|---|---|---|
| Bahan | `ingredients`: nama, satuan, stok, stok minimum, harga beli per satuan | Satuan beli ≠ satuan pakai (beli 1 kg, resep pakai gram) |
| Resep | `recipes`: takaran bahan per menu; sisa porsi menu dihitung otomatis | Resep untuk varian/topping (mis. "extra keju") |
| Pergerakan stok | `stock_movements`: `SALE`, `VOID`, `RESTOCK`, `ADJUST` | Bahan terbuang (waste), hitung stok fisik (opname), barang masuk dari pembelian |
| Pemotongan stok | Otomatis saat pesanan **dibayar**; kembali saat void | — |
| Shift | Sesi laci kasir (`shifts`, `cash_movements`) | Jadwal kerja, kehadiran, laporan per shift |
| Pembelian | — | Pemasok, daftar belanja, barang masuk, utang ke pemasok |

---

## 1. Inventory (stok bahan yang saling tersinkron)

### 1.1 Alur stok

```
Pembelian diterima ──► + stok (BELI)       ┐
Penjualan dibayar  ──► − stok (JUAL)       │
Void / refund      ──► + stok (BATAL)      ├─► stock_movements (satu buku besar)
Bahan terbuang     ──► − stok (BUANG)      │      └─► ingredients.stock (saldo)
Hitung stok fisik  ──► ± selisih (OPNAME)  │            └─► products.portions (sisa porsi menu)
Koreksi manual     ──► ± (KOREKSI)         ┘                  └─► "Habis" otomatis di menu & kasir
```

Satu sumber kebenaran: semua perubahan masuk ke `stock_movements`, lalu saldo di `ingredients.stock` diperbarui dalam transaksi yang sama. Sisa porsi menu sudah ikut berubah lewat trigger yang ada, jadi kasir, menu pembeli, dan dapur selalu sinkron.

### 1.2 Perubahan data

- `stock_movements.reason` ditambah: `PURCHASE` (barang masuk), `WASTE` (terbuang), `COUNT` (opname).
- **Satuan beli**: kolom baru di `ingredients`: `purchase_unit` (mis. "kg") dan `purchase_factor` (mis. 1000, artinya 1 kg = 1000 gram). Stok tetap disimpan dalam satuan pakai (gram), sedangkan layar pembelian memakai satuan beli (kg).
- **Resep varian (opsional, tahap 2)**: tabel `modifier_recipes` (opsi varian → bahan + takaran), dipotong bersama resep menu utama.
- **Stok tidak boleh minus.** Menu otomatis "Habis" bila bahan tidak cukup (sudah berjalan lewat sisa porsi). Bila tetap terjadi saat pembayaran, mis. pesanan pelanggan dibuat saat stok masih ada, pembayaran ditolak dengan pesan yang menyebut bahan dan jumlahnya: "Stok Gula tidak cukup (butuh 30 gram, tersisa 10 gram). Ubah pesanan atau catat barang masuk dulu."
- **Peringatan stok minimum**: saat sebuah bahan turun ke/di bawah `min_stock`, toast + bunyi ke pemilik, manager, dan kasir. Satu kali per bahan, dan muncul lagi hanya bila stok sempat naik di atas minimum lalu turun lagi.

### 1.3 Hitung stok (opname), versi sederhana

1. Pemilik membuka **Stok bahan → Hitung stok**.
2. Daftar bahan tampil dengan kolom "Jumlah di rak". Bahan yang tidak diisi berarti tidak dihitung.
3. Tekan **Simpan hitungan**. Selisihnya dicatat sebagai `COUNT`, lengkap dengan nilai rupiahnya ("Selisih: kurang 300 gram gula · Rp4.500").

### 1.4 Layar (untuk pengguna awam)

- **Stok bahan**: daftar bahan dengan status besar: *Aman* / *Hampir habis* / *Habis*. Tiga tombol: **Barang masuk**, **Catat terbuang**, **Hitung stok**.
- **Riwayat satu bahan**: siapa, kapan, berapa, dan karena apa (jual, beli, buang, hitung).

---

## 2. Shift (pergantian shift, tanpa jam kerja)

Keputusan: **tidak ada jam masuk/pulang atau absen**. Shift = pergantian tanggung jawab laci kasir, dengan nama shift yang diatur pemilik. Tujuannya mencegah kecurangan: setiap shift punya laporan sendiri.

### 2.1 Konsep

| Istilah di layar | Isi |
|---|---|
| **Daftar shift** | Diatur pemilik di Pengaturan toko: berapa banyak dan namanya, mis. "Shift 1/2/3" atau "Pagi/Sore/Malam". Bisa ditambah, diubah urutan, dimatikan. |
| **Buka shift** | Kasir memilih nama shift, lalu mengisi uang awal di laci. Uang awal harus sama dengan uang yang diserahkan shift sebelumnya (aturan serah terima yang sudah ada). |
| **Tutup shift** | Kasir menghitung uang laci; selisih harus diberi catatan (sudah ada). |
| **Laporan shift** | Satu laporan per shift per hari, berdiri sendiri. |

### 2.2 Data

- `shift_names`: `store_id, name, sort_order, is_active`. Daftar shift dinamis milik toko.
- `shifts` (sesi laci yang sudah ada): tambah `shift_name_id`, dipilih saat buka shift.
- Penjualan, kas masuk/keluar, void/refund **sudah** tercatat per `shift_id` saat terjadi, sehingga laporan tidak bergantung pada jam dan tidak berubah walau daftar shift diedit belakangan.

### 2.3 Isi laporan per shift (anti-kecurangan)

- Nama shift, tanggal, kasir yang membuka dan menutup.
- Uang awal, penjualan tunai/QRIS/kartu, kas masuk/keluar (termasuk belanja dari laci), void/refund (siapa dan alasannya).
- Uang yang seharusnya ada vs dihitung → **selisih**, dan apakah sudah dicek pemilik.
- Serah terima: apakah uang awal sama dengan uang yang diserahkan shift sebelumnya.
- Pemakaian bahan (dari penjualan) dan bahan terbuang selama shift itu.

### 2.4 Yang sengaja tidak dibuat

Jam kerja, absen, jadwal per orang, gaji, lembur.

---

## 3. Pembelian (purchase)

### 3.1 Alur sederhana (cocok untuk warung yang belanja ke pasar)

```
[Barang masuk] ──► pilih/isi pemasok (boleh "Pasar") ──► isi bahan + jumlah + harga
       │
       └─► stok bertambah (PURCHASE), harga beli bahan diperbarui, catatan pengeluaran tersimpan
```

Satu layar, tanpa tahap pesanan pembelian. Ini yang dipakai sehari-hari.

### 3.2 Alur lengkap (opsional, untuk kafe/restoran dengan pemasok tetap)

```
Daftar belanja (draf) ──► Dipesan ke pemasok ──► Diterima (sebagian/penuh) ──► Dibayar / utang
```

- **Daftar belanja otomatis**: bahan yang *Hampir habis* langsung diusulkan, dengan jumlah = sampai batas aman.
- **Diterima sebagian**: barang datang kurang → stok bertambah sesuai yang datang; sisanya tetap "menunggu".
- **Utang ke pemasok**: pembelian bisa "Bayar nanti"; muncul di daftar "Belum dibayar".

### 3.3 Data

- `suppliers`: `store_id, name, phone, note, is_active`.
- `purchases`: `store_id, supplier_id, status (DRAFT | ORDERED | RECEIVED | CANCELLED), ordered_at, received_at, total, paid_amount, paid_from (CASH_DRAWER | OTHER), note, created_by`.
- `purchase_items`: `purchase_id, ingredient_id, qty (satuan beli), unit_price, received_qty`.
- **Uang**: kalau dibayar tunai dari laci kasir, otomatis dicatat sebagai *kas keluar* di shift yang sedang buka, sehingga laci tetap cocok.
- **Harga beli**: usul **rata-rata tertimbang** (stok lama × harga lama + barang baru × harga baru) supaya HPP dan laba di laporan masuk akal.

### 3.4 Laporan yang jadi mungkin

- **HPP & laba kotor** per hari/per menu (penjualan − biaya bahan dari resep).
- **Pengeluaran belanja** per pemasok per bulan.
- **Bahan terbuang** dalam rupiah.

---

## 4. Urutan pengerjaan yang disarankan

| Tahap | Isi | Kenapa urutan ini |
|---|---|---|
| 1 | Barang masuk sederhana (3.1) + satuan beli + catat terbuang + stok tidak boleh minus + peringatan stok minimum | Paling sering dipakai; langsung membuat stok akurat |
| 2 | Hitung stok (opname) + riwayat bahan | Membetulkan stok yang sudah terlanjur meleset |
| 3 | Daftar shift dinamis + pilih shift saat buka laci + hak akses dinamis | Tidak mengganggu stok; menyiapkan laporan per shift |
| 4 | Laporan shift + HPP/laba | Butuh data tahap 1–3 |
| 5 | Pembelian lengkap (draf → dipesan → diterima, utang pemasok) + resep varian | Untuk toko yang lebih besar; disembunyikan di "Fitur lanjutan" |

---

## 5. Keputusan (disepakati)

1. **Stok tidak boleh minus.** Peringatan saat menyentuh stok minimum: toast + bunyi. Pembayaran ditolak dengan pesan jelas bila bahan tidak cukup.
2. **Stok dipotong saat pesanan dibayar** (masuk dapur), seperti sekarang.
3. **Pembelian dibayar dari laci kasir** otomatis tercatat sebagai kas keluar di shift yang sedang buka.
4. **Harga beli** memakai rata-rata tertimbang.
5. **Shift** = pergantian shift dengan daftar nama shift dinamis; tanpa jam kerja; laporan dipisah per shift per hari (bagian 2).
6. **Hak akses dinamis per peran** di Pengaturan toko → tab "Hak akses". Pemilik selalu boleh semua. Dicek juga di fungsi database. Nilai awal:

| Tugas | Manager | Kasir | Pelayan | Dapur |
|---|---|---|---|---|
| Catat barang masuk | ✓ | – | – | – |
| Catat bahan terbuang | ✓ | – | – | ✓ |
| Hitung stok | ✓ | – | – | – |
| Tandai "Sudah siap" / "Sudah diambil" | ✓ | ✓ | ✓ | ✓ |
| Atur daftar shift | ✓ | – | – | – |

Data: `store_permissions (store_id, permission, roles staff_role[])` + fungsi `can_do(permission)` yang dipakai di setiap fungsi database terkait.
