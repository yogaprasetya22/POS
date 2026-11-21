import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');

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
const PROJECT_REF = env.SUPABASE_PROJECT_REF || (env.VITE_SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const API_ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function sql(query) {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL Failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function runSeedFile(file) {
  console.log(`🌱 Seeding: ${file}...`);
  const content = fs.readFileSync(path.join(ROOT_DIR, 'supabase', file), 'utf8');
  await sql(`BEGIN;\n${content}\n;COMMIT;`);
  console.log(`   ✓ ${file} applied!`);
}

async function main() {
  console.log('========================================================');
  console.log('🚀 1. RUNNING MIGRATE FRESH (RESET & APPLY ALL MIGRATIONS)');
  console.log('========================================================');
  execSync('bun scripts/supabase-migrate.js fresh', { stdio: 'inherit' });

  console.log('\n========================================================');
  console.log('🌱 2. RUNNING COMPREHENSIVE SEEDERS (CATALOG, POS, INVENTORY, PURCHASING, 90-DAY HISTORY)');
  console.log('========================================================');
  await runSeedFile('seed.sql');
  await runSeedFile('seed_pos.sql');
  await runSeedFile('seed_inventory.sql');
  await runSeedFile('seed_purchasing.sql');
  await runSeedFile('seed_history.sql');

  console.log('\n========================================================');
  console.log('🍳 3. ENSURING ACTIVE ORDERS FOR KITCHEN & TODAYS SHIFT');
  console.log('========================================================');
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { error: authErr } = await client.auth.signInWithPassword({ email: 'kasir@pos.test', password: 'kasir12345' });
  if (authErr) console.warn('Kasir login notice:', authErr.message);

  const { data: store } = await client.from('stores').select('id').eq('slug', 'warkop-nusantara').single();
  const { data: shiftNames } = await client.from('shift_names').select('id, name').eq('store_id', store.id).eq('is_active', true);
  const pagiShift = shiftNames.find(s => s.name.toLowerCase().includes('pagi'))?.id || shiftNames[0]?.id;

  // Open shift if not open
  const { data: curShift } = await client.rpc('shift_status');
  if (!curShift?.open) {
    console.log('Opening active shift...');
    await client.rpc('open_shift', { p_opening_cash: 100000, p_note: 'Shift aktif operasional', p_shift_name: pagiShift });
  }

  // Active kitchen orders
  const { data: prods } = await client.from('products').select('id, name, modifiers').eq('store_id', store.id).eq('is_available', true);
  const prodMap = prods.map(p => ({
    id: p.id,
    name: p.name,
    choices: (p.modifiers ?? []).filter(g => g.required).map(g => ({ group: g.name, option: g.options[0].name }))
  }));

  const p1 = prodMap[0];
  const p2 = prodMap[1];
  const p3 = prodMap[2] || prodMap[0];

  try {
    const o1 = await client.rpc('create_order', {
      p_store_id: store.id,
      p_customer_name: 'Budi Santoso',
      p_order_type: 'DINE_IN',
      p_table_no: 'T3',
      p_lines: [
        { product_id: p1.id, qty: 1, choices: p1.choices, note: 'Pedas sedang' },
        { product_id: p2.id, qty: 2, choices: p2.choices, note: 'Less ice' }
      ]
    });
    if (o1.data) await client.rpc('pay_order', { p_order_id: o1.data.id, p_method: 'QRIS_STATIC', p_cash_received: null });
    console.log('✓ Kitchen Order 1 (T3) Created');

    const o2 = await client.rpc('create_order', {
      p_store_id: store.id,
      p_customer_name: 'Dimas & Rina',
      p_order_type: 'DINE_IN',
      p_table_no: '04',
      p_lines: [
        { product_id: p3.id, qty: 2, choices: p3.choices, note: 'Saus dipisah' }
      ]
    });
    if (o2.data) await client.rpc('pay_order', { p_order_id: o2.data.id, p_method: 'CASH', p_cash_received: o2.data.total });
    console.log('✓ Kitchen Order 2 (04) Created');

    const o3 = await client.rpc('create_order', {
      p_store_id: store.id,
      p_customer_name: 'Kak Sarah',
      p_order_type: 'TAKEAWAY',
      p_table_no: null,
      p_lines: [
        { product_id: p1.id, qty: 1, choices: p1.choices, note: 'Bungkus rapat' }
      ]
    });
    if (o3.data) {
      await client.rpc('pay_order', { p_order_id: o3.data.id, p_method: 'EDC_CARD', p_cash_received: null });
      await client.rpc('advance_order', { p_order_id: o3.data.id, p_to: 'READY' });
      console.log('✓ Kitchen Order 3 (Takeaway) Created');
    }
  } catch (err) {
    console.warn('Notice creating kitchen orders:', err.message);
  }

  console.log('\n========================================================');
  console.log('📸 4. RE-GENERATING ALL SCREENSHOTS & VIDEOS WITH ZERO SKELETON');
  console.log('========================================================');
  execSync('node scripts/capture-flawless-assets.mjs', { stdio: 'inherit' });

  console.log('\n🎉 ALL DONE FRESH & FLAWLESS!');
}

main().catch(err => {
  console.error('Fatal master seeder error:', err);
  process.exit(1);
});
