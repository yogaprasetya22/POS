# WA-Order POS

POS F&B multi-toko: pelanggan memesan lewat link/QR, pesanan dikirim ke WhatsApp kasir, dibayar di kasir, lalu masuk layar dapur.

## Menjalankan lokal

```bash
bun install
cp .env.example .env      # isi nilainya (lihat di bawah)
make migrate && make seed # skema + data demo
make dev                  # http://localhost:5173
```

Akun demo (dari `make seed`): `super@pos.test` / `admin@pos.test` / `kasir@pos.test` / `owner2@pos.test` (password di `supabase/seed.sql`). Jangan seed ke database produksi.

## Environment variable

| Variabel | Dipakai di | Wajib untuk |
|---|---|---|
| `VITE_SUPABASE_URL` | browser (publik) | aplikasi, deploy Vercel |
| `VITE_SUPABASE_ANON_KEY` | browser (publik, kunci `sb_publishable_…`) | aplikasi, deploy Vercel |
| `SUPABASE_ACCESS_TOKEN` | hanya mesin lokal/CI (`sbp_…`) | `make migrate`, `make seed` |

Jangan isi `service_role` / `sb_secret_…` di Vercel: aplikasi ini tidak memakainya, semua akses dijaga RLS dan fungsi SQL.

## Deploy ke Vercel

1. Import repo, framework **Vite** (build `bun run build`, output `dist`).
2. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di Settings → Environment Variables.
3. `vercel.json` sudah mengarahkan semua rute ke `index.html` agar `/s/{slug}` tidak 404 saat di-refresh.
4. Terapkan migrasi ke project Supabase produksi (`make migrate`), lalu jadikan akun pertama super admin:
   `update profiles set is_super_admin = true where email = 'emailmu@…';`

## Tes

```bash
bun run test       # unit (Vitest)
bun run test:e2e   # Playwright: alur pesan→bayar→dapur, isolasi RLS antar toko, batas spam
```

`test:e2e` memakai akun demo dan **mengubah data** di database yang ada di `.env`; jalankan hanya ke database demo/dev.
