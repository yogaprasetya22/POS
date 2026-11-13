# Panduan Lengkap Pembuatan Video Tutorial Sistem POS

Dokumen ini mencatat seluruh arsitektur, panduan langkah demi langkah, dan pengetahuan teknis untuk merekam video tutorial otomatis pada **Sistem POS (WA-Order POS)**.

---

## 1. Arsitektur Pembuatan Video

Video tutorial dibuat secara otomatis dan deterministik tanpa rekaman layar manual:

```
[ Skenario Adegan ]               [ Teks Narasi ]
 (fitur.mjs / roles.mjs)       (docs/narasi.txt)
          │                            │
          │                            ▼
          │                   [ Generator TTS Edge ]
          │                    (gen-edge.py)
          │                            │
          │                            ▼
          │                   [ File Audio MP3 ]
          │                  (docs/audio/slide-*.mp3)
          ▼                            │
[ Otomatisasi Playwright ]             │
  (scripts/tutorial/record.mjs)        │
          │                            │
          ▼                            ▼
      [ Rekaman Layar ] ──► [ FFmpeg Muxing ] ──► [ Hasil Akhir MP4 ]
                            (Sinkronisasi Suara)   (docs/videos/*)
```

1. **Skenario Adegan**: Didefinisikan dalam kode JavaScript Playwright di `scripts/tutorial/fitur.mjs` (seri fitur) dan `scripts/tutorial/roles.mjs` (seri peran).
2. **Teks Narasi**: Dipisahkan oleh baris `---` di `docs/narasi.txt`.
3. **Suara (TTS)**: Dikonversi menjadi audio `.mp3` per slide menggunakan Microsoft Edge Neural TTS (gratis, tanpa kuota/API key).
4. **Perekaman Layar**: Playwright Chromium membuka aplikasi, menggerakkan mouse, mengklik menu, dan merekam layar `1280x720`.
5. **Muxing FFmpeg**: Menggabungkan video layar dengan audio narasi yang disinkronkan tepat di setiap adegan.

---

## 2. Struktur File & Folder

```
Dokumen/pos/
├── docs/
│   ├── PANDUAN_VIDEO_TUTORIAL.md    # Dokumen panduan ini
│   ├── arsitektur-dan-spesifikasi.md # Spesifikasi teknis arsitektur aplikasi
│   ├── narasi.txt                   # Sumber teks narasi (129 blok dipisah '---')
│   ├── narasi-peta.md               # Peta pemetaan: No Slide ↔ Seri ↔ Judul Video
│   ├── audio/                       # 129 file audio produksi (slide-01.mp3 s/d slide-129.mp3)
│   ├── videos/
│   │   ├── fitur/                   # 12 video panduan fitur produk
│   │   └── peran/                   # 7 video panduan per peran staf
│   ├── stitch/                      # Desain & mockup Stitch UI
│   └── archive/                     # File backup audio/desain lama
│
└── scripts/tutorial/
    ├── record.mjs                   # Script utama perekaman Playwright + FFmpeg
    ├── fitur.mjs                    # Definisi 12 skenario video seri fitur
    ├── roles.mjs (peran.mjs)        # Definisi 7 skenario video seri peran
    ├── export-narasi.mjs            # Generator docs/narasi.txt dari fitur & peran
    ├── gen-edge.py                  # Generator audio TTS cepat & gratis (Edge Neural)
    ├── gen-fish.py                  # Generator audio via Fish Audio (opsional)
    └── gen-tts.py                   # Generator audio offline Piper
```

---

## 3. Langkah Demi Langkah Produksi Video

### Langkah 1: Persiapan Aplikasi & Dev Server
Aplikasi POS harus aktif di browser lokal.
```bash
cd /home/yoga/Dokumen/pos
bun run dev
```
> **Catatan**: Script `record.mjs` secara otomatis mendeteksi server yang aktif di port `5173` atau `5199`.

---

### Langkah 2: Mengubah atau Menambah Narasi / Adegan
Jika ingin mengubah isi perkataan atau alur adegan:
1. Buka `scripts/tutorial/fitur.mjs` (untuk fitur) atau `scripts/tutorial/roles.mjs` (untuk peran).
2. Format setiap langkah adegan:
   ```javascript
   [
     'Teks narasi yang akan dibacakan oleh suara AI.',
     async (page, ctx) => {
       // Aksi browser Playwright (klik, ketik, scroll, dsb)
       await page.getByRole('button', { name: /Nama Tombol/ }).click()
     },
     'Deskripsi langkah layar'
   ]
   ```
3. Ekspor narasi terbaru ke `docs/narasi.txt`:
   ```bash
   node scripts/tutorial/export-narasi.mjs
   ```

---

### Langkah 3: Menghasilkan Audio Suara (TTS)
Gunakan `gen-edge.py` untuk membuat seluruh audio dari `docs/narasi.txt`:

```bash
# Suara Pria (Rekomendasi untuk tutorial profesional)
python3 scripts/tutorial/gen-edge.py docs/narasi.txt docs/audio id-ID-ArdiNeural

# ATAU Suara Wanita
python3 scripts/tutorial/gen-edge.py docs/narasi.txt docs/audio id-ID-GadisNeural
```
* Proses pembuatan seluruh 129 slide hanya memakan waktu **~20-30 detik**.
* Slide yang sudah ada tidak akan di-download ulang kecuali file dihapus terlebih dahulu.

---

### Langkah 4: Menjalankan Perekaman Video

#### Merekam Semua Video Seri Fitur (12 Video)
```bash
node scripts/tutorial/record.mjs all --set fitur --audio docs/audio
```
*Hasil disimpan di:* `docs/videos/fitur/`

#### Merekam Semua Video Seri Peran (7 Video)
```bash
node scripts/tutorial/record.mjs all --set peran --audio docs/audio
```
*Hasil disimpan di:* `docs/videos/peran/`

#### Merekam 1 Video Tertentu Saja (Cepat untuk Testing)
```bash
# Contoh rekam video 'pengenalan' pada seri fitur:
node scripts/tutorial/record.mjs pengenalan --set fitur --audio docs/audio

# Contoh rekam video 'kasir' pada seri peran:
node scripts/tutorial/record.mjs kasir --set peran --audio docs/audio
```

#### Opsi Tambahan:
* **Subtitle**: Secara bawaan, subtitle/caption tidak ditampilkan agar UI bersih. Jika ingin memunculkan kotak subtitle di bawah, tambahkan flag `--caption`:
  ```bash
  node scripts/tutorial/record.mjs pengenalan --set fitur --audio docs/audio --caption
  ```

---

## 4. Daftar Video Tutorial yang Dihasilkan

### Seri Fitur (`docs/videos/fitur/`)
| No | File | Judul Video | Durasi |
|:---:|---|---|:---:|
| 1 | `01-pengenalan.mp4` | Pengenalan WA-Order POS | ~0:43 |
| 2 | `02-pesan-qr.mp4` | Pemesanan lewat QR Meja | ~0:58 |
| 3 | `03-kasir-pembayaran.mp4` | Kasir dan Pembayaran | ~1:06 |
| 4 | `04-shift-kas.mp4` | Shift Kasir & Laci Uang | ~1:20 |
| 5 | `05-dapur.mp4` | Layar Dapur (KDS) | ~0:49 |
| 6 | `06-member-promo.mp4` | Member, Voucher & Promo | ~0:44 |
| 7 | `07-menu-stok-resep.mp4` | Menu, Stok Bahan & Resep HPP | ~0:45 |
| 8 | `08-laporan-audit.mp4` | Laporan Penjualan & Audit Log | ~0:49 |
| 9 | `09-meja-tim-akses.mp4` | Meja, Tim & Hak Akses Peran | ~0:46 |
| 10 | `10-pengaturan-bahasa.mp4` | Pengaturan Toko & Multi-Bahasa | ~0:48 |
| 11 | `11-multi-toko-keamanan.mp4` | Multi Cabang Toko & Keamanan DB | ~0:37 |
| 12 | `12-penutup.mp4` | Rangkuman & Penutup | ~0:37 |

### Seri Peran (`docs/videos/peran/`)
| No | File | Judul Video | Durasi |
|:---:|---|---|:---:|
| 1 | `01-pelanggan.mp4` | Panduan Pelanggan (Pesan QR) | ~1:04 |
| 2 | `02-kasir.mp4` | Panduan Kasir (Buka Shift s/d Tutup) | ~2:14 |
| 3 | `03-dapur.mp4` | Panduan Dapur (KDS & Stok Habis) | ~1:12 |
| 4 | `04-pelayan.mp4` | Panduan Pelayan (Order Meja) | ~0:45 |
| 5 | `05-manager.mp4` | Panduan Manager (Laporan & Shift) | ~1:21 |
| 6 | `06-owner.mp4` | Panduan Owner (Menu, Promo, Toko) | ~1:53 |
| 7 | `07-super-admin.mp4` | Panduan Super Admin (Multi-Toko) | ~0:34 |

---

## 5. Pengetahuan Teknis & Troubleshooting (Lesson Learned)

1. **Mencegah Layar Putih (White Screen) Saat Perekaman**:
   * *Penyebab*: Jika dev server belum menyala atau port berbeda (misal Vite jalan di 5173 sedangkan script mengakses 5199), browser Chromium akan membuka halaman `about:blank` yang berwarna putih polos dan timeout setelah 25 detik.
   * *Solusi*: Script `record.mjs` telah dilengkapi fungsi `resolveBaseUrl()` yang menguji respon HTTP di port 5173/5199 sebelum browser dibuka.

2. **Menghilangkan Skeleton pada Landing Page**:
   * *Penyebab*: Pada `src/main.tsx`, rute `/` sebelumnya menggunakan lazy loading dengan fallback `<ShellSkeleton />`. Fallback ini menampilkan kerangka sidebar admin yang berkedip dan mengganggu estetika video.
   * *Solusi*: Impor `LandingPage` secara statis (`import { LandingPage } from '@features/landing'`) dan lepaskan `<ShellSkeleton />` dari rute `/`.

3. **Ketepatan Selector Tombol UI**:
   * *Penyebab*: Jika teks tombol di kode React berubah (contoh: dari *"Kirim ke WhatsApp"* menjadi *"Kirim pesanan"*), Playwright akan menunggu hingga 8 detik lalu timeout.
   * *Solusi*: Gunakan pencocokan teks fleksibel menggunakan Regex insensitive, misalnya:
     ```javascript
     await p.getByRole('button', { name: /Kirim (pesanan|ke WhatsApp)/i }).click()
     ```

4. **Konsistensi Database Sebelum Perekaman**:
   * Selalu gunakan fungsi helper `before` pada setiap video (contoh: `await clearShifts()` dan `await restock()`) agar status stok bahan dan shift kasir kembali bersih sebelum adegan dimulai.

