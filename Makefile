.PHONY: migrate-mark reset-month sim-month e2e test-all help dev stop build preview lint test clean migrate-status migrate migrate-fresh migrate-reset migrate-down migrate-info seed seed-pos seed-inventory landing-video landing-media-upload

# Default target
help:
	@echo "Available commands for WA-Order POS:"
	@echo "  make dev                   - Run Vite development server"
	@echo "  make stop                  - Stop running dev server (kill ports 5173 & 5174)"
	@echo "  make build                 - Typecheck and build for production"
	@echo "  make preview               - Preview production build"
	@echo "  make lint                  - Run linter (oxlint)"
	@echo "  make test                  - Run unit tests (Vitest)"
	@echo "  make clean                 - Remove dist and cache artifacts"
	@echo "  make migrate-status        - Cek status migrasi Supabase (pending / applied)"
	@echo "  make migrate               - Jalankan migrasi pending (ditolak bila ada yang menghapus data)"
	@echo "  make migrate DESTRUCTIVE=1 - Izinkan migrasi yang menghapus data (minta konfirmasi 'ya')"
	@echo "  make migrate-mark FILE=... - Catat migrasi sudah diterapkan TANPA menjalankan isinya"
	@echo "  make migrate-fresh         - HAPUS semua data public lalu jalankan ulang semua migrasi"
	@echo "  make migrate-reset         - HAPUS semua tabel/fungsi/enum di schema public"
	@echo "  make migrate-down FILE=... - Jalankan rollback migrasi (.down.sql)"
	@echo "  make seed                  - Isi data dummy (menu, kategori, gambar, pesanan contoh, fitur POS inti)"
	@echo "  make seed-pos              - Hanya data demo fitur POS inti (role baru, meja, member, voucher, stok)"
	@echo "  make db-check              - Uji otorisasi & perhitungan di database (butuh seed; jangan di produksi)"
	@echo "  make reset-month           - HAPUS transaksi (1 toko demo) pada rentang simulasi; dry-run kecuali YES=1"
	@echo "  make sim-month             - Hapus transaksi + simulasikan 30 hari + audit (YES=1 DAYS=30)"
	@echo "  make e2e                   - Playwright semua alur (butuh database demo)"
	@echo "  make test-all              - lint, unit, build, migrate, db-check, sim-month, e2e (YES=1)"
	@echo "  make migrate-info          - Buka instruksi dashboard Supabase"

dev:
	bun dev --host

stop:
	@echo "Stopping dev servers on port 5173 & 5174..."
	@-sh -c 'fuser -k 5173/tcp 5174/tcp 2>/dev/null || true'
	@echo "Dev server stopped."

build:
	bun run build

preview:
	bun run preview

lint:
	bun run lint

test:
	bun run test

clean:
	rm -rf dist node_modules/.tmp

migrate-status:
	bun scripts/supabase-migrate.js status

# Selalu tampilkan status dulu. Migrasi yang menghapus data ditolak skrip kecuali DESTRUCTIVE=1 + ketik 'ya'.
migrate:
	@bun scripts/supabase-migrate.js status
	@if [ -n "$(DESTRUCTIVE)" ]; then \
		read -p "⚠️  Migrasi yang MENGHAPUS DATA akan dijalankan. Ketik 'ya' untuk lanjut: " ok && [ "$$ok" = "ya" ] && \
		ALLOW_DESTRUCTIVE=1 bun scripts/supabase-migrate.js up; \
	else \
		bun scripts/supabase-migrate.js up; \
	fi

migrate-mark:
	@[ -n "$(FILE)" ] || (echo "Contoh: make migrate-mark FILE=20261016000034_xxx.sql" && exit 1)
	bun scripts/supabase-migrate.js mark $(FILE)

migrate-fresh:
	@read -p "⚠️  Semua data di schema public akan DIHAPUS. Ketik 'ya' untuk lanjut: " ok && [ "$$ok" = "ya" ]
	bun scripts/supabase-migrate.js fresh

migrate-reset:
	@read -p "⚠️  Semua data di schema public akan DIHAPUS. Ketik 'ya' untuk lanjut: " ok && [ "$$ok" = "ya" ]
	bun scripts/supabase-migrate.js reset

seed:
	bun scripts/supabase-migrate.js seed

seed-pos:
	bun scripts/supabase-migrate.js seed-pos

seed-inventory: ## Data demo Inventory Stock (bahan, resep, barcode)
	bun scripts/supabase-migrate.js seed-inventory

seed-purchasing: ## Data contoh Pembelian (pemasok, daftar belanja, utang)
	bun scripts/supabase-migrate.js seed-purchasing

db-check:
	bun scripts/db-check.mjs

migrate-down:
	@[ -n "$(FILE)" ] || (echo "Contoh: make migrate-down FILE=20261016000037_xxx.sql" && exit 1)
	@read -p "⚠️  Rollback $(FILE) (bisa menghapus kolom/tabel & datanya). Ketik 'ya' untuk lanjut: " ok && [ "$$ok" = "ya" ]
	bun scripts/supabase-migrate.js down $(FILE)

migrate-info:
	@echo "Buka SQL Editor project Supabase kamu (Dashboard -> pilih project -> SQL Editor)."
	@echo "Jalankan supabase/migrations/*.sql (urut nama file), lalu supabase/seed.sql dan supabase/seed_pos.sql"

# --- Pengujian menyeluruh (HANYA database demo/dev) ---
DAYS ?= 30
SIM_FLAGS = $(if $(YES),--yes,) --days $(DAYS)

reset-month:
	bun scripts/sim-month.mjs $(SIM_FLAGS) --reset-only

sim-month:
	bun scripts/sim-month.mjs $(SIM_FLAGS)

e2e:
	bunx playwright test

test-all:
	@[ -n "$(YES)" ] || (echo "test-all menghapus transaksi toko demo. Jalankan: make test-all YES=1" && exit 1)
	bun run lint
	bun run test
	bun run build
	bun scripts/supabase-migrate.js up
	bun scripts/db-check.mjs
	bun scripts/sim-month.mjs $(SIM_FLAGS)
	bunx playwright test

drive-check: ## Uji Google Drive: unggah gambar uji, buka alamatnya, hapus lagi
	bun scripts/media-to-drive.js check

media-status: ## Hitung media per tempat penyimpanan
	bun scripts/media-to-drive.js status

media-to-drive: ## Pindahkan semua media yang belum di Google Drive
	bun scripts/media-to-drive.js migrate

landing-video: ## Rekam ulang video demo landing (butuh dev server + OPENAI_API_KEY), lalu unggah ke Google Drive
	node scripts/generate-synced-showcase.mjs
	bun scripts/landing-media-to-drive.js
	rm -f public/landing/*.webm public/landing/audio/*.mp3

landing-media-upload: ## Unggah video/audio di public/landing ke Google Drive & perbarui manifest
	bun scripts/landing-media-to-drive.js

seed-history: ## Data contoh 90 hari terakhir (pesanan per jam, shift, kas) untuk toko demo
	bun scripts/supabase-migrate.js seed-history
