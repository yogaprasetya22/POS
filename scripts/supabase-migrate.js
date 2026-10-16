/**
 * Ponytail Lean Migration Runner for Supabase
 * Pakai Supabase Management API + Personal Access Token (SUPABASE_ACCESS_TOKEN), tanpa dependensi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase', 'migrations');

// Simple .env parser (tanpa dependensi luar)
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[trimmed.slice(0, eqIdx).trim()] = val;
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF =
  env.SUPABASE_PROJECT_REF || (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!TOKEN) {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN tidak ditemukan di .env!');
  process.exit(1);
}
// Sengaja tanpa fallback ref: salah project = migrasi masuk ke database lain.
if (!PROJECT_REF) {
  console.error('❌ Error: project ref tidak ditemukan (isi VITE_SUPABASE_URL atau SUPABASE_PROJECT_REF).');
  process.exit(1);
}

const API_ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function executeSql(sql) {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const quote = (s) => `'${s.replaceAll("'", "''")}'`;

async function getAppliedMigrations() {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS public._schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- tabel internal: jangan terbuka ke anon/authenticated lewat API
    ALTER TABLE public._schema_migrations ENABLE ROW LEVEL SECURITY;
  `);
  const rows = await executeSql(`SELECT version FROM public._schema_migrations ORDER BY version ASC;`);
  return new Set(rows.map((r) => r.version));
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql')).sort();
}

async function status() {
  console.log(`📡 Memeriksa status migrasi untuk project: ${PROJECT_REF} ...\n`);
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();
  if (files.length === 0) return console.log('ℹ️ Tidak ada file migrasi di supabase/migrations/');

  console.log('Status Migrasi:');
  console.log('------------------------------------------------------------');
  for (const file of files) console.log(`${(applied.has(file) ? '✅ [APPLIED]' : '⏳ [PENDING]').padEnd(14)} ${file}`);
  console.log('------------------------------------------------------------');
}

async function up(targetFile = null) {
  console.log(`🚀 Menjalankan migrasi UP ke Supabase (${PROJECT_REF}) ...\n`);
  const applied = await getAppliedMigrations();
  const files = targetFile ? [targetFile] : getMigrationFiles();

  let count = 0;
  for (const file of files) {
    if (!targetFile && applied.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File tidak ditemukan: ${filePath}`);
      process.exit(1);
    }

    console.log(`⚡ Menerapkan: ${file} ...`);
    try {
      // satu transaksi: kalau gagal di tengah, tidak ada skema setengah jadi
      await executeSql(`BEGIN;\n${fs.readFileSync(filePath, 'utf8')}\n;INSERT INTO public._schema_migrations (version) VALUES (${quote(file)}) ON CONFLICT (version) DO NOTHING;\nCOMMIT;`);
      console.log('   ✓ Berhasil diterapkan!');
      count++;
    } catch (err) {
      console.error(`   ❌ Gagal menerapkan ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log(count === 0 ? '✨ Semua migrasi sudah up to date!' : `\n🎉 Selesai! Sebanyak ${count} file migrasi berhasil diterapkan.`);
}

async function down(targetFile) {
  if (!targetFile) {
    console.error('❌ Mohon sebutkan nama file migrasi yang ingin di-rollback!');
    console.error('Contoh: make migrate-down FILE=20261016000000_init.sql');
    process.exit(1);
  }
  const downFileName = targetFile.replace(/\.sql$/, '.down.sql');
  const downFilePath = path.join(MIGRATIONS_DIR, downFileName);
  if (!fs.existsSync(downFilePath)) {
    console.error(`❌ File down tidak ditemukan: ${downFileName}`);
    console.error(`💡 Tips: Buat file ${downFileName} yang berisi perintah pembalik (DROP/ALTER).`);
    process.exit(1);
  }

  console.log(`⏪ Menjalankan rollback DOWN: ${downFileName} ...`);
  try {
    await executeSql(`BEGIN;\n${fs.readFileSync(downFilePath, 'utf8')}\n;DELETE FROM public._schema_migrations WHERE version = ${quote(targetFile)};\nCOMMIT;`);
    console.log(`✅ Rollback untuk ${targetFile} berhasil diselesaikan!`);
  } catch (err) {
    console.error('❌ Rollback gagal:', err.message);
    process.exit(1);
  }
}

async function reset() {
  console.log(`⚠️  Menghapus seluruh tabel, fungsi, dan tipe di schema public (${PROJECT_REF}) ...`);
  await executeSql(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      FOR r IN (SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.prokind = 'f'
                  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fn || ' CASCADE';
      END LOOP;
      FOR r IN (SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('✅ Skema public berhasil di-reset bersih!\n');
}

async function fresh() {
  console.log('🔄 Menjalankan Migrate Fresh (Reset & Apply All Migrations)...\n');
  await reset();
  await up();
}

async function seed() {
  const seedPath = path.join(ROOT_DIR, 'supabase', 'seed.sql');
  console.log(`🌱 Menjalankan seed ke Supabase (${PROJECT_REF}) ...`);
  await executeSql(`BEGIN;\n${fs.readFileSync(seedPath, 'utf8')}\n;COMMIT;`);
  console.log('✅ Data dummy berhasil dimasukkan!');
}

async function main() {
  const [command = 'status', param] = process.argv.slice(2);
  switch (command) {
    case 'status': return status();
    case 'up': return up(param);
    case 'down': return down(param);
    case 'reset': return reset();
    case 'fresh': return fresh();
    case 'seed': return seed();
    default:
      console.log(`
Penggunaan:
  bun scripts/supabase-migrate.js status          - Cek status migrasi
  bun scripts/supabase-migrate.js up              - Jalankan semua migrasi pending
  bun scripts/supabase-migrate.js up <file.sql>   - Jalankan file tertentu
  bun scripts/supabase-migrate.js down <file.sql> - Jalankan file <file.down.sql>
  bun scripts/supabase-migrate.js reset           - Hapus semua tabel/fungsi/enum di schema public
  bun scripts/supabase-migrate.js fresh           - Reset & jalankan ulang semua migrasi dari awal
  bun scripts/supabase-migrate.js seed            - Isi data dummy dari supabase/seed.sql
      `);
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
