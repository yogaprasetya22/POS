.PHONY: reset-month sim-month e2e test-all help dev stop build preview lint test clean migrate-status migrate migrate-fresh migrate-reset migrate-down migrate-info seed seed-pos seed-inventory

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
	@echo "  make migrate               - Jalankan semua migrasi pending ke Supabase remote"
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

migrate:
	bun scripts/supabase-migrate.js up

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
