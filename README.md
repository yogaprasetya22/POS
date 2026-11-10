# WA-Order POS

POS F&B multi-toko untuk warkop, resto, dan kafe: pelanggan memesan lewat link/QR meja, kasir menerima pembayaran, dapur melihat antrean secara realtime, owner melihat laporan.

## Fitur

| Area | Isi |
|---|---|
| Pelanggan | Menu per toko via `/s/{slug}?meja=T1`, promo & kode, kirim pesanan ke WhatsApp kasir. Meja harus terdaftar bila toko punya daftar meja. |
| Kasir | Shift & laci kas, bayar tunai/QRIS/kartu (dicatat manual), open bill, pisah/gabung bill, member & poin, voucher, void/refund dengan PIN supervisor, riwayat hari ini, cetak struk & tiket dapur. |
| Dapur | Layar antrean realtime, tandai menu habis. |
| Backoffice | Menu, promo, laporan (+ekspor CSV), stok bahan & resep (HPP), meja & QR cetak, member & voucher, riwayat shift & log audit, tim, pengaturan pajak/service/pembulatan/poin/struk/PIN. |
| Platform | Multi-toko terisolasi (RLS), paket & masa langganan per toko, daftar toko mandiri (uji coba 14 hari), halaman privasi & syarat, PWA. |

Total harga, promo, voucher, poin, service, pajak, dan pembulatan **dihitung di database** (`quote_order` / `create_order`), jadi pelanggan, kasir, dan struk selalu sama.

## Navigasi

- **Mode kerja layar penuh** (tanpa sidebar): `/cashier` dan `/kitchen`, dengan switch Kasir ⇄ Dapur dan tombol Back office untuk owner/manager.
- **Back office** (`/admin/*`, sidebar berkelompok, satu route per halaman): Ikhtisar, Katalog (menu, promo), Pelanggan (member & voucher), Persediaan (stok & resep), Laporan (penjualan, shift & audit), Toko (meja & QR, tim & peran, pengaturan). Tautan lama `/admin?tab=…` otomatis diarahkan.
- **Daftar panjang** memakai pagination di server (`usePaged` + `Pagination`): member, voucher, shift, log audit, dan riwayat kasir.

## Shift kasir & selisih

- **Satu laci = satu shift.** Kasir lain tidak bisa membuka shift selama laci masih dipegang; layarnya menampilkan siapa yang memegang dan sejak kapan. Ganti kasir = tutup shift (hitung uang) lalu buka shift baru. Shift yang terlupa ditutup paksa oleh manager dengan alasan wajib.
- **Serah terima berantai.** Modal awal shift berikutnya otomatis terisi uang hasil hitung shift sebelumnya. Kalau beda, catatan penyebabnya wajib.
- **Selisih wajib dijelaskan** saat tutup shift, dan manager menandainya "sudah ditinjau".
- **Rumus:** seharusnya = modal awal + penjualan tunai + kas masuk − kas keluar − refund tunai; selisih = uang dihitung − seharusnya (minus = kurang).
- **Rincian per shift** (Admin → Shift & audit → Rincian): langkah rumus, tiap pesanan tunai beserta asalnya (pelanggan QR tanpa akun atau dibuat staf) dan kasir yang menerima uangnya, kas masuk/keluar, refund, dan tinjauan.
- Uang QRIS dan kartu dicatat per metode tetapi tidak masuk hitungan laci.

## Bahasa & pesan (i18n)

- **Tiga bahasa:** Indonesia, Santai (Jaksel), dan English. Kamusnya di `src/shared/i18n/catalog.ts` (satu kunci = tiga kalimat + keterangan untuk admin).
- **Pilihan bahasa:** bahasa bawaan toko diatur owner (Admin → Bahasa & pesan); tiap staf bisa memilih sendiri lewat menu akun (tersimpan di perangkat).
- **Admin menyunting kalimat** per bahasa dengan pratinjau, parameter `{who}`, `{at}`, dan tombol "Kembalikan ke bawaan". Hanya owner yang boleh; tercatat di log audit.
- **Pesan dari database berupa kode** (`E:SHIFT_HELD:{"who":"…","at":"…"}`), dirakit jadi kalimat di aplikasi. Pesan teks lama dari fungsi SQL yang belum dikodekan dipetakan lewat daftar `LEGACY`. Cakupan saat ini: shift & kas, pembayaran, PIN & void, serta peringatan toko/pesanan. Teks tombol dan label halaman belum diterjemahkan.

## Role

| Role | Boleh |
|---|---|
| `owner` | Semua, termasuk tim, pengaturan toko, dan PIN supervisor |
| `manager` | Laporan, menu, promo, stok, meja, member, void/refund tanpa PIN; **tidak** tim & pengaturan |
| `cashier` | Kasir, shift, pembayaran, open bill; void/refund butuh PIN supervisor |
| `waiter` | Buat/ubah pesanan, open bill, pisah/gabung; **tidak** bisa menerima pembayaran |
| `kitchen` | Layar dapur, tandai menu habis, stok bahan |

Izin diputuskan di database (RLS + fungsi SQL); UI hanya menyembunyikan menu. Staf non-manager hanya melihat pesanan kemarin dan hari ini. Tindakan sensitif tercatat di `audit_log`.

## Menjalankan lokal

```bash
bun install
cp .env.example .env       # isi nilainya (lihat di bawah)
make migrate && make seed  # skema + data demo
make dev                   # http://localhost:5173
```

`make dev` juga melayani `api/*.js` (plugin di `vite.config.ts`), jadi perilakunya sama dengan Vercel.

Akun demo (`supabase/seed.sql` dan `supabase/seed_pos.sql`, jangan seed ke produksi):

| Email | Password | Peran |
|---|---|---|
| `super@pos.test` | `super12345` | super admin |
| `admin@pos.test` | `admin12345` | owner Warung Kopi Nusantara |
| `manager@pos.test` | `manager12345` | manager |
| `kasir@pos.test` | `kasir12345` | kasir |
| `pelayan@pos.test` | `pelayan12345` | pelayan |
| `dapur@pos.test` | `dapur12345` | dapur |
| `owner2@pos.test` | `owner212345` | owner Bakso Mas Joko (PB1 10%, bulat Rp100) |

PIN supervisor demo Warung Kopi Nusantara: `1234`. Database yang sudah pernah di-seed bisa menambah data fitur baru dengan `make seed-pos`.

## Environment variable

| Variabel | Dipakai di | Wajib untuk |
|---|---|---|
| `VITE_SUPABASE_URL` | browser + API (publik) | aplikasi, deploy |
| `VITE_SUPABASE_ANON_KEY` | browser + API (kunci `sb_publishable_…`) | aplikasi, deploy |
| `SUPABASE_ACCESS_TOKEN` | hanya mesin lokal/CI (`sbp_…`) | `make migrate`, `make seed` |
| `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN` / `GDRIVE_FOLDER_ID` | **server saja** (env Vercel, jangan diawali `VITE_`) | upload foto/video menu ke Google Drive |
| `VITE_APP_NAME` | browser | nama brand di beranda & halaman legal |
| `VITE_CONTACT_EMAIL` | browser | kontak di Kebijakan Privasi (opsional) |
| `VITE_DEFAULT_STORE_SLUG` | browser | tujuan link QR lama `/?meja=5` (opsional) |

Jangan isi `service_role` / `sb_secret_…` di Vercel: aplikasi ini tidak memakainya.

## Deploy ke Vercel

1. Import repo, framework **Vite** (build `bun run build`, output `dist`). Fungsi serverless ada di `api/`.
2. Isi variabel environment di atas (Settings → Environment Variables).
3. Terapkan migrasi ke project Supabase produksi: `make migrate`. **Jangan** menjalankan `make seed` di produksi.
4. Jadikan akun pertama super admin: `update profiles set is_super_admin = true where email = 'emailmu@…';`
5. Buka `/api/health`; hasilnya harus `ok: true`.
6. Super admin membuat toko di `/super`, atau pendaftar baru membuat toko sendiri (uji coba 14 hari). Atur paket & masa berlaku di form toko. Setelah masa berlaku lewat, toko tidak bisa menerima pesanan & pembayaran baru (data lama tetap ada).

Pesanan publik (tanpa login) dibatasi: 6 per menit per IP (best-effort di `api/rpc.js`), maksimal 40 pesanan publik menunggu bayar per toko, 3 per meja per 10 menit, dan hanya untuk meja terdaftar bila toko punya daftar meja.

## Printer thermal

Struk memakai `window.print()` (lebar 58 mm). Tombol **Printer thermal** mengirim perintah ESC/POS lewat Web Serial (Chrome/Edge desktop & Android) atau RawBT (Android). Safari/iPad tidak mendukung keduanya, jadi di iPad pakai tombol Cetak lewat AirPrint. Lebar kertas 58/80 mm diatur di Admin → Pengaturan Toko. Format ESC/POS sudah diuji dengan unit test, **belum dengan perangkat printer fisik**: coba dulu di printer yang akan dipakai.

## Offline

Aplikasi bisa dipasang (PWA) dan tampilannya tetap terbuka saat internet putus, lengkap dengan banner peringatan. Pesanan dan pembayaran baru **tetap butuh internet**; antrean transaksi offline belum ada.

## Belum ada

- Payment gateway QRIS dinamis (QRIS/kartu dicatat manual oleh kasir).
- Integrasi GoFood/GrabFood/ShopeeFood.
- Tagihan langganan otomatis (paket & masa berlaku diatur super admin).
- Antrean transaksi offline.
- Satu akun hanya bisa terikat ke satu toko (belum multi-cabang per owner).

## Tes

```bash
bun run test       # unit (Vitest): promo, keranjang, cetak ESC/POS, matriks izin role
make db-check      # 57 pemeriksaan otorisasi & perhitungan langsung di database (role, shift, void+PIN, poin, voucher, stok, pajak)
bun run test:e2e   # Playwright: pesan → bayar (shift) → dapur realtime, isolasi RLS antar toko, batas spam
```

`db-check` dan `test:e2e` memakai akun demo dan **mengubah data** di database yang ada di `.env`; jalankan hanya ke database demo/dev.

## Video panduan per peran

Tujuh video (pelanggan, kasir, dapur, pelayan, manager, owner, super admin) dengan suara bahasa Indonesia direkam otomatis dari aplikasi yang berjalan: Playwright merekam layar, Piper membuat suara (offline), ffmpeg menggabungkannya. Hasil di `docs/videos/` (tidak di-commit).

```bash
bun run dev --port 5199 --strictPort        # terminal 1
node scripts/tutorial/record.mjs all        # terminal 2 (atau satu peran: kasir, dapur, ...)
```

Naskah dan langkah layar ada di `scripts/tutorial/roles.mjs`; ubah teks lalu rekam ulang. Butuh `ffmpeg`, plus mesin suara di `scripts/tutorial/.tts` (venv dengan `piper-tts` dan model `id.onnx` dari rhasspy/piper-voices `id_ID-news_tts-medium`). Skrip mengubah database di `.env` (membuka/menutup shift, membuat pesanan demo, mengisi ulang stok): jalankan hanya ke database demo.

### Seri "fitur untuk apa" (12 video, suara Fish Audio)

Naskah dan langkah layarnya ada di `scripts/tutorial/fitur.mjs` (satu adegan = satu blok narasi). Alurnya:

```bash
node scripts/tutorial/export-narasi.mjs                          # tulis docs/narasi.txt + docs/narasi-peta.md
python docs/fish_ai.py login                                      # sekali saja (login Fish Audio di jendela browser)
python docs/fish_ai.py docs/narasi.txt                            # -> docs/audio/slide-01.mp3, slide-02.mp3, ...
bun run dev --port 5199 --strictPort                              # terminal lain
node scripts/tutorial/record.mjs all --set fitur --audio docs/audio   # -> docs/videos/fitur/*.mp4
```

Tanpa `--audio`, video direkam dengan suara Piper (untuk draf). Nomor slide mengikuti urutan adegan global; jangan menambah atau menghapus adegan tanpa menjalankan ulang `export-narasi.mjs` dan membuat ulang suaranya.
