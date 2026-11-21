# 05: Panduan Konfigurasi MCP, Variabel Lingkungan & Deployment Vercel (100% GRATIS)
> **Panduan lengkap konfigurasi variabel lingkungan, deployment Vercel Serverless Function (Rp 0), setup klien AI (Claude Desktop, Cursor, Antigravity, claude.ai), dan troubleshooting teknis.**

---

## 1. Checklist Kredensial & Variabel Lingkungan

Karena arsitektur `mcp-pos` memanfaatkan infrastruktur **Vercel Hobby Tier (Gratis)** dan **Supabase Free Tier (Gratis)**, Anda tidak memerlukan kartu kredit ataupun pembayaran bulanan VPS.

### A. Kredensial Supabase
Dapatkan dari dashboard Supabase Anda (**Project Settings → API**):

| Variabel | Deskripsi | Level Akses |
|:---|:---|:---|
| `VITE_SUPABASE_URL` | Endpoint REST/PostgREST proyek Supabase (contoh: `https://xyzcompany.supabase.co`). | Publik |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous client key (digunakan untuk koneksi frontend & RPC aman). | Publik |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Opsional)* Secret key untuk akses penuh bypass Row Level Security jika diperlukan audit khusus. | Rahasia (Hanya Backend Serverless) |

### B. Kredensial Keamanan Serverless MCP
Untuk melindungi endpoint serverless Anda dari akses publik yang tidak diizinkan, buat token acak:

| Variabel | Deskripsi | Contoh Nilai |
|:---|:---|:---|
| `MCP_SECRET_KEY` | Kunci autentikasi bearer token untuk klien AI. | `pos_mcp_sec_994821a8f7c04e` |
| `TZ` | Zona waktu operasional toko/restoran. | `Asia/Jakarta` |

---

## 2. Format `.env.local` dan Konfigurasi Vercel

### Contoh File `.env.local` (Untuk Pengembangan Lokal):
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# MCP Security & Timezone
MCP_SECRET_KEY=pos_mcp_sec_994821a8f7c04e
TZ=Asia/Jakarta
```

### Konfigurasi di Dashboard Vercel:
1. Buka repositori proyek Anda di [vercel.com](https://vercel.com).
2. Masuk ke **Settings → Environment Variables**.
3. Tambahkan seluruh pasangan kunci-nilai di atas untuk environment: `Production`, `Preview`, dan `Development`.
4. Klik **Save**.

### Konfigurasi `vercel.json`:
Pastikan file `vercel.json` di root repositori telah memetakan rute API serverless dengan benar:

```json
{
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/mcp",
      "destination": "/api/mcp.ts"
    },
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/mcp",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization, x-mcp-signature" }
      ]
    }
  ]
}
```

> [!TIP]
> **Batas Free Tier Vercel**: Vercel Serverless Function gratis memiliki batas waktu eksekusi (*execution timeout*) 10 detik. Karena fungsi `mcp-pos` memanfaatkan RPC terindeks langsung di database Supabase, rata-rata durasi respons hanya berkisar antara **30ms s/d 120ms**, sangat aman dan jauh di bawah batas limit.

---

## 3. Konfigurasi Klien MCP AI

Setelah proyek Anda ter-deploy di Vercel (misal beralamat di `https://pos-anda.vercel.app`), Anda dapat menghubungkannya ke berbagai antarmuka AI favorit Anda.

### A. Claude Desktop (macOS / Windows / Linux)

Edit file konfigurasi Claude Desktop:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Opsi 1: Menjalankan Langsung via Local Stdio Runner (Paling Cepat & Stabil)
```json
{
  "mcpServers": {
    "pos-intelligence": {
      "command": "bun",
      "args": [
        "run",
        "/home/yoga/Dokumen/pos/scripts/mcp-server.mjs"
      ],
      "env": {
        "VITE_SUPABASE_URL": "https://your-project.supabase.co",
        "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  }
}
```

#### Opsi 2: Menggunakan Remote SSE Proxy ke Vercel Serverless
```json
{
  "mcpServers": {
    "pos-intelligence-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://pos-anda.vercel.app/api/mcp",
        "--header",
        "Authorization: Bearer pos_mcp_sec_994821a8f7c04e"
      ]
    }
  }
}
```

---

### B. Antigravity IDE

Tambahkan konfigurasi server pada file config Antigravity Anda:

```json
{
  "mcpServers": {
    "pos-server": {
      "command": "bun",
      "args": ["run", "scripts/mcp-server.mjs"],
      "cwd": "/home/yoga/Dokumen/pos",
      "env": {
        "VITE_SUPABASE_URL": "https://your-project.supabase.co",
        "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  }
}
```

---

### C. Cursor IDE

Buat atau edit file `.cursor/mcp.json` di dalam root direktori workspace Anda:

```json
{
  "mcpServers": {
    "pos-ops": {
      "command": "bun",
      "args": ["run", "scripts/mcp-server.mjs"],
      "env": {
        "VITE_SUPABASE_URL": "https://your-project.supabase.co",
        "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  }
}
```

---

### D. claude.ai Web (Custom Connector via SSE Remote)

1. Buka dashboard web [claude.ai](https://claude.ai) dengan akun Pro/Team.
2. Buka menu **Settings → Features → Connectors / Integrations**.
3. Tambahkan Custom Connector baru:
   - **Name**: `POS Intelligence Warkop`
   - **URL**: `https://pos-anda.vercel.app/api/mcp`
   - **Auth Type**: Bearer Token
   - **Token**: `pos_mcp_sec_994821a8f7c04e`
4. Klik **Connect**. Seluruh 24 tool `pos_*` akan langsung terdeteksi otomatis.

---

## 4. Panduan Uji Verifikasi & Diagnostik

Untuk memverifikasi bahwa serverless endpoint Anda sudah berjalan lancar sebelum disambungkan ke AI:

### A. Uji Daftar Tool (`tools/list`)
Jalankan perintah `curl` berikut di terminal:

```bash
curl -X POST https://pos-anda.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pos_mcp_sec_994821a8f7c04e" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

**Ekspektasi Output:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "pos_get_today_sales",
        "description": "Ambil data ringkasan penjualan...",
        "inputSchema": { "type": "object", "properties": {} }
      },
      ...
    ]
  }
}
```

### B. Uji Eksekusi Tool (`tools/call`)
Jalankan pengujian pemanggilan data penjualan hari ini:

```bash
curl -X POST https://pos-anda.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pos_mcp_sec_994821a8f7c04e" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "pos_get_today_sales",
      "arguments": {}
    }
  }'
```

---

## 5. Troubleshooting Error Umum

| Masalah / Error | Penyebab | Solusi |
|:---|:---|:---|
| **401 Unauthorized** | Header `Authorization` tidak dikirim atau `MCP_SECRET_KEY` tidak cocok. | Pastikan token di sisi klien sama persis dengan variabel lingkungan di Vercel. |
| **CORS Blocked (Browser/Web)** | Permintaan OPTIONS pre-flight gagal dijawab header yang sesuai. | Periksa blok `headers` pada file `vercel.json` dan pastikan `api/mcp.ts` menangani method `OPTIONS` dengan mengembalikan status 200. |
| **500 Internal Server Error (Supabase)** | URL Supabase atau Anon Key salah, atau fungsi RPC database belum dibuat. | Pastikan migrasi SQL Supabase (termasuk `sales_report` dan `profit_report`) telah dijalankan di database proyek Anda. |
| **Data Selisih Kosong / Null** | Toko belum melakukan input hitungan uang fisik saat tutup shift. | Ini adalah perilaku normal jika shift masih berstatus aktif (*OPEN*). Sistem akan menampilkan `warnings: ["Shift masih aktif"]`. |
| **Timeout 10 Detik di Vercel** | Query SQL lambat karena tabel tidak memiliki indeks tanggal. | Pastikan kolom `created_at` pada tabel `orders`, `shifts`, dan `stock_movements` memiliki index `btree (created_at DESC)`. |

