Viewed tsconfig.json:1-8
Viewed tsconfig.app.json:1-27
Listed directory docs
Listed directory architecture
Viewed module-map.md:1-44
Viewed overview.md:1-41
Viewed contracts.ts:1-60
Listed directory composer
Viewed index.ts:1-4

Berikut adalah penjelasan lengkap mengenai **Konfigurasi TypeScript** dan **Struktur Best Practice Arsitektur** yang diterapkan 100% sama di repositori ini:

---

### 1. Konfigurasi & Penerapan TypeScript

Konfigurasi TypeScript diatur modular menggunakan fitur **Project References** melalui [`tsconfig.json`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/tsconfig.json) yang memisahkan konteks aplikasi frontend ([`tsconfig.app.json`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/tsconfig.app.json)) dan konfigurasi build Node ([`tsconfig.node.json`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/tsconfig.node.json)).

#### Spesifikasi Compiler (`tsconfig.app.json`):
* **Target & Library**: `ES2023` dengan lib `DOM` dan `DOM.Iterable` untuk fitur ECMAScript modern.
* **Module & Resolution**: `module: "esnext"`, `moduleResolution: "bundler"` (standar optimal untuk bundler Vite modern), dan `moduleDetection: "force"`.
* **JSX Runtime**: `"jsx": "react-jsx"` (React 19 native transform tanpa perlu `import React from 'react'`).
* **Path Aliases (Clean Import)**:
  ```json
  "paths": {
    "@/*": ["src/*"],
    "@features/*": ["src/features/*"],
    "@shared/*": ["src/shared/*"]
  }
  ```
* **Build Check**: `"noEmit": true` (emisi file JavaScript diserahkan sepenuhnya ke Vite Rollup build, `tsc -b` hanya bertugas melakukan type-checking statis).

#### Best Practice Tipe: Single Source of Truth via Zod
Alih-alih menduplikasi deklarasi `interface` TypeScript dan validator runtime secara terpisah, proyek ini menerapkan pola **Zod Schema Inference** di [`src/shared/types/contracts.ts`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/src/shared/types/contracts.ts):
```typescript
// 1. Definisikan runtime schema Zod
export const PostStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED']);

// 2. Inferensi tipe TypeScript secara otomatis
export type PostStatus = z.infer<typeof PostStatusSchema>;
```
*Dengan pola ini, validasi runtime API dan static type checking di frontend selalu sinkron 100% tanpa risiko drift.*

---

### 2. Struktur Arsitektur: Feature-Based Clean Architecture

Repositori ini menerapkan **Feature-Based Clean Architecture** yang dirancang modular, berkohesi tinggi, dan minim *cognitive load*.

```
auto-poster/src/
├── app/                  # Application bootstrap, routing (React Router v7), providers
├── features/             # Domain modules mandiri (composer, schedule, history, accounts, dll)
│   └── <feature_name>/
│       ├── components/   # Komponen UI privat milik fitur tersebut
│       ├── store/        # State management (Zustand) khusus fitur
│       ├── validation.ts # Aturan validasi & skema Zod spesifik fitur
│       ├── <page>.tsx    # Entry page / view container
│       └── index.ts      # PUBLIC CONTRACT BARRIER (Satu-satunya pintu keluar fitur)
└── shared/               # Modul lintas fitur yang dapat digunakan bersama
    ├── components/
    │   ├── ui/           # Primitives reusable (Tailwind v4 + Base UI / shadcn)
    │   ├── layout/       # Sidebar, navbar, dan layout shell
    │   └── workflow/     # Stepper dan wizard lintas halaman
    ├── preview/          # Single Source of Truth simulator ponsel & preview postingan
    ├── types/            # Kontrak domain global & platform limits (contracts.ts)
    └── lib/              # Client API (supabase.ts, gdrive.ts, date.ts, utils.ts)
```

---

### 3. Golden Rules & Best Practices yang Diterapkan

#### A. Batas Modul Eksplisit (Strict Module Boundaries)
* **Wajib via `index.ts`**: Impor antar modul fitur wajib melalui file public entry point [`src/features/<feature>/index.ts`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/src/features/composer/index.ts).
* **Larangan Deep Import**: Dilarang mengimpor komponen privat fitur lain secara langsung, misalnya:
  * ❌ *Salah*: `import { MediaUploader } from '@/features/composer/components/media-uploader'`
  * ✅ *Benar*: `import { ComposerPage, useComposerStore } from '@features/composer'`

#### B. Aliran Data Satu Arah (Unidirectional Data Flow)
Aliran ketergantungan kode disusun satu arah tanpa sirkularitas:
$$\text{Page / View} \longrightarrow \text{Zustand Store / Custom Hook} \longrightarrow \text{Domain Engine / Repository} \longrightarrow \text{Domain Types \& Contracts}$$
* Aturan domain murni (seperti batas karakter Threads 500 karakter, durasi TikTok, rasio komik) tidak boleh dicampuradukkan ke dalam styling komponen UI, melainkan diisolasi di [`contracts.ts`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/src/shared/types/contracts.ts) dan [`validation.ts`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/src/features/composer/validation.ts).

#### C. Isolasi Kredensial Sensitif (Server-Side Privilege Isolation)
* File kredensial seperti `gdrive_oauth.json`, service role keys Supabase, dan kunci enkripsi `AES-256-GCM` **dilarang keras** diimpor atau bocor ke dalam folder `src/` (client-side bundle).
* Seluruh operasi yang membutuhkan kredensial sensitif wajib dieksekusi di lingkungan aman backend ([`auto-poster/api/`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/api/) dan [`auto-poster/server/`](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/server/)).

#### D. Prinsip Ponytail (Zero Overengineering)
* Hindari abstraksi berlebihan (seperti Dependency Injection containers atau state machine yang kompleks).
* Gunakan langsung **Zustand store** yang terfokus, **React hooks**, dan **fungsi murni TypeScript** untuk mempermudah pemeliharaan kode dan efisiensi eksekusi.

#### E. Pipeline Pengujian & Validasi Kualitas
Sebelum kode dideploy atau di-commit, alur validasi bertahap dijalankan:
1. **Typecheck & Build**: `bun run build` (`tsc -b && vite build`)
2. **Unit & Contract Testing**: `bun run test` ([Vitest](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/package.json))
3. **Ultra-Fast Linting**: `bun run lint` ([Oxlint](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/package.json))
4. **End-to-End Simulation**: `bun run test:e2e` ([Playwright](file:///home/yoga/Dokumen/service-auto-poster/auto-poster/package.json))