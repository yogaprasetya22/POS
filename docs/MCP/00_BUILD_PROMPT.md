# 00: Build Prompt — Membangun `mcp_pos` dengan Agen Coding
> **Prompt lengkap siap tempel ke Google Antigravity / Claude Code / Cursor untuk membangun MCP POS Intelligence secara mandiri, 100% Pure TypeScript & siap deploy ke Vercel.**

---

## Cara Pakai
1. Letakkan seluruh dokumen `docs/MCP/*.md` di repositori project POS ini.
2. Buka agen coding (Antigravity / Claude Code / Cursor) di root `/home/yoga/Dokumen/pos`.
3. Tempel prompt di bawah apa adanya. Agen coding akan membaca dokumen 01–05 sebagai spesifikasi teknis tunggal.
4. Kerjakan secara bertahap (Fase 0 s/d Fase 3).

---

## 🧱 PROMPT UTAMA (Salin Seluruh Blok)

```text
PERAN
Anda adalah Senior Full-Stack & Systems Engineer yang ahli dalam TypeScript/Node.js, Model
Context Protocol (MCP) resmi Anthropic (@modelcontextprotocol/sdk), Supabase PostgreSQL RPC,
dan arsitektur Vercel Serverless Functions.

TUJUAN
Bangun layanan MCP server terintegrasi "mcp_pos" di repositori ini yang memberikan kemampuan
AI Assistant untuk menganalisis data bisnis POS secara menyeluruh (penjualan, HPP/profit,
kasir/shift, mutasi stok, member loyalitas, dan jejak audit keamanan) secara 100% READ-ONLY,
menggunakan PURE JAVASCRIPT/TYPESCRIPT, dan siap di-deploy langsung ke VERCEL SERVERLESS
secara 100% GRATIS (Rp 0).

SUMBER SPESIFIKASI (WAJIB DIBACA DULU, JANGAN MENEBAK)
- docs/MCP/README.md
- docs/MCP/01_ARCHITECTURE_AND_DEPLOYMENT.md   ← spesifikasi 24 tools, skema envelope & api/mcp.ts
- docs/MCP/02_150_POS_QA_SCENARIOS.md          ← dataset skenario evaluasi (150 skenario operasional)
- docs/MCP/03_PROMPT_OPTIMIZATION_AND_LLM_JUDGE.md ← master system prompt & guardrail
- docs/MCP/05_MCP_CONFIG_AND_VERCEL_GUIDE.md   ← konfigurasi .env & mcp_config.json

ATURAN KERAS (NON-NEGOTIABLE)
1. 100% PURE TYPESCRIPT / JAVASCRIPT. DILARANG menggunakan Python, FastAPI, atau runtime
   eksternal. Manfaatkan @modelcontextprotocol/sdk dan @supabase/supabase-js yang sudah ada.
2. 100% GRATIS & SERVERLESS-READY. Kode harus dirancang berjalan mulus di Vercel Serverless
   Function (api/mcp.ts) dan lokal Bun (scripts/mcp-server.mjs) tanpa membutuhkan VPS sewaan.
3. READ-ONLY DI FASE 1. Dilarang keras membuat tool yang memanggil fungsi mutasi (create_order,
   pay_order, void_order, close_shift, dll.). Hanya panggil fungsi pelaporan, agregasi, atau query SELECT.
4. KEAMANAN & REDAKSI:
   - Header Authorization: Bearer <MCP_SECRET_KEY> wajib divalidasi pada setiap request Vercel.
   - Jangan pernah membocorkan PIN supervisor, password hash, service role key, atau nomor HP
     pelanggan secara mentah. Gunakan masking (mis. 0812****8899).
5. ENVELOPE RESPON SERAGAM:
   Setiap tool wajib mengembalikan format terstandarisasi:
   {
     "success": true,
     "module": "sales" | "profit" | "shifts" | "inventory" | "crm" | "audit",
     "period": { "start_date": "...", "end_date": "...", "days": ... },
     "currency": "IDR",
     "timezone": "Asia/Jakarta",
     "data": [...],
     "totals": {...},
     "warnings": [...],
     "source": { "fetched_at": ISO8601, "database": "supabase_rpc" }
   }
6. ZERO-DIVISION SAFETY:
   Setiap perhitungan rasio (AOV, margin %, persentase void, dsb.) wajib aman dari pembagian
   dengan angka 0. Jika penyebut nol, kembalikan null atau 0 (bukan NaN / Infinity).
7. TANGGAL STANDAR:
   Format tanggal selalu YYYY-MM-DD dengan zona waktu WIB (Asia/Jakarta). Default jika tidak diisi:
   hari ini atau 7 hari terakhir.

TAHAPAN PENGERJAAN
Fase 0 — Persiapan Dependensi
  - Pasang @modelcontextprotocol/sdk dan zod via Bun (bun add @modelcontextprotocol/sdk zod).
Fase 1 — Normalizer & Core Handler
  - Buat api/mcp/normalizer.ts: helper envelope, format mata uang rupiah, pembagi nol aman.
  - Buat api/mcp/auth.ts: verifikasi secret key dan store multi-tenant resolution.
Fase 2 — Registrasi 24 Tools MCP
  - Modul 1: Penjualan (sales.ts) -> bungkus rpc('sales_report')
  - Modul 2: Profit & HPP (profit.ts) -> bungkus rpc('profit_report')
  - Modul 3: Kasir & Shift (shifts.ts) -> rpc('shift_detail'), shift_summary, cash_movements
  - Modul 4: Inventori (inventory.ts) -> ingredients, stock_movements, recipes
  - Modul 5: Loyalitas (crm.ts) -> members, point_ledger, vouchers
  - Modul 6: Audit & Keamanan (audit.ts) -> audit_log, deteksi anomali
Fase 3 — Entrypoint Serverless & Lokal
  - Buat api/mcp.ts sebagai Vercel Serverless Route (mendukung HTTP POST & GET SSE).
  - Buat scripts/mcp-server.mjs sebagai runtime Stdio lokal untuk Claude Desktop / Antigravity.
Fase 4 — Verifikasi
  - Jalankan tes query menggunakan bun run scripts/mcp-server.mjs untuk memastikan tidak ada error.
```

