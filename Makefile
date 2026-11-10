.PHONY: help dev stop build preview lint test clean migrate-status migrate migrate-fresh migrate-reset migrate-down migrate-info seed seed-pos

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

db-check:
	bun scripts/db-check.mjs

migrate-down:
	bun scripts/supabase-migrate.js down $(FILE)

migrate-info:
	@echo "Buka SQL Editor project Supabase kamu (Dashboard -> pilih project -> SQL Editor)."
	@echo "Jalankan supabase/migrations/*.sql (urut nama file), lalu supabase/seed.sql dan supabase/seed_pos.sql"
