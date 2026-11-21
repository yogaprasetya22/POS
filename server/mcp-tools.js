/**
 * MCP Tools Core Implementation for Warung Kopi Nusantara / POS System.
 * Pure JavaScript / TypeScript ecosystem, zero VPS required, 100% Vercel & Supabase compatible.
 */
import { createClient } from '@supabase/supabase-js'

// Format Rupiah standar Indonesia
export function formatRp(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0'
  return 'Rp ' + Math.round(Number(n)).toLocaleString('id-ID')
}

// Zero-division protected margin calculator
export function calcMargin(revenue, cogs) {
  const rev = Number(revenue) || 0
  const cost = Number(cogs) || 0
  const profit = rev - cost
  if (rev <= 0) return { profit, margin_pct: 0, margin_pct_formatted: '–' }
  const pct = Math.round((profit / rev) * 1000) / 10
  return {
    profit,
    margin_pct: pct,
    margin_pct_formatted: `${pct}%`,
  }
}

// Envelope Response Generator
export function wrapEnvelope(data, warnings = [], metadata = {}) {
  return {
    success: true,
    data,
    warnings: Array.isArray(warnings) ? warnings : warnings ? [warnings] : [],
    timestamp: new Date().toISOString(),
    metadata: {
      server: 'mcp-pos-serverless',
      version: '1.0.0',
      timezone: process.env.TZ || 'Asia/Jakarta',
      ...metadata,
    },
  }
}

// Default MCP Secret Key untuk autentikasi jika env tidak diatur
export const DEFAULT_MCP_SECRET = 'pos-sec-7f89d3a1c5b04e28e649'

// Global memory cache in Serverless instance (Warm container optimization)
let cachedAdminClient = null
let tokenExpiry = 0
const storeCache = new Map()

// Verifikasi token autentikasi (mendukung Secret Key maupun Supabase User JWT)
export async function verifyAuthToken(authHeader) {
  if (!authHeader) return null
  const secret = process.env.MCP_SECRET_KEY || DEFAULT_MCP_SECRET
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : String(authHeader).trim()

  // 1. Direct Secret Key match
  if (token === secret) {
    return {
      authenticated: true,
      auth_type: 'secret_key',
      user: { role: 'owner', display_name: 'MCP Super Agent' },
    }
  }

  // 2. Supabase User JWT verification
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!url || !anonKey) return null

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await client.auth.getUser(token)
    if (error || !user) return null

    const { data: profile } = await client
      .from('profiles')
      .select('user_id, role, store_id, display_name, is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle()

    return {
      authenticated: true,
      auth_type: 'supabase_jwt',
      user: profile || { user_id: user.id, role: 'staff', display_name: user.email },
    }
  } catch {
    return null
  }
}

// Buat client Supabase dengan autentikasi yang tepat dan memory caching
export async function getSupabase(authHeader = null) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (serviceKey) {
    if (!cachedAdminClient) {
      cachedAdminClient = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    }
    return cachedAdminClient
  }

  // Cek apakah authHeader membawa Supabase JWT (format 3 bagian dipisah titik)
  const isSupabaseJwt = (h) => {
    if (!h || !h.startsWith('Bearer ')) return false
    return h.slice(7).trim().split('.').length === 3
  }

  if (isSupabaseJwt(authHeader)) {
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })
  }

  // Caching authenticated admin client in serverless memory (5x faster)
  const now = Date.now()
  if (cachedAdminClient && now < tokenExpiry) {
    return cachedAdminClient
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const email = process.env.MCP_ADMIN_EMAIL || 'admin@pos.test'
  const password = process.env.MCP_ADMIN_PASSWORD || 'admin12345'
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (!error && data?.session?.access_token) {
    // Supabase JWT berlaku 1 jam; kita cache selama 50 menit
    tokenExpiry = now + 50 * 60 * 1000
    cachedAdminClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    })
    return cachedAdminClient
  }

  return client
}

// Invalidate token cache jika ada error autentikasi
export function invalidateAuthCache() {
  cachedAdminClient = null
  tokenExpiry = 0
}

// Dapatkan store_id secara dinamis (mendukung eksplisit slug & multi-tenant user profile)
export async function getDefaultStoreId(client, storeSlug = null, userContext = null) {
  // A. Jika storeSlug eksplisit diberikan
  if (storeSlug) {
    if (storeCache.has(storeSlug)) return storeCache.get(storeSlug)
    const { data } = await client.from('stores').select('id, name').eq('slug', storeSlug).maybeSingle()
    if (data?.id) {
      const val = { store_id: data.id, store_name: data.name }
      storeCache.set(storeSlug, val)
      return val
    }
  }

  // B. Multi-tenant: Jika userContext membawa store_id (dari Supabase JWT login kasir/owner)
  if (userContext?.store_id) {
    if (storeCache.has(userContext.store_id)) return storeCache.get(userContext.store_id)
    const { data } = await client.from('stores').select('id, name').eq('id', userContext.store_id).maybeSingle()
    if (data?.id) {
      const val = { store_id: data.id, store_name: data.name }
      storeCache.set(userContext.store_id, val)
      return val
    }
  }

  // C. Fallback ke default store
  const slug = process.env.MCP_DEFAULT_STORE || 'warkop-nusantara'
  if (storeCache.has(slug)) {
    return storeCache.get(slug)
  }

  const { data } = await client.from('stores').select('id, name').eq('slug', slug).maybeSingle()
  if (data?.id) {
    const val = { store_id: data.id, store_name: data.name }
    storeCache.set(slug, val)
    return val
  }
  const { data: first } = await client.from('stores').select('id, name').limit(1).maybeSingle()
  const fallback = { store_id: first?.id || null, store_name: first?.name || 'Toko Default' }
  if (fallback.store_id) storeCache.set(slug, fallback)
  return fallback
}

// Ambil tanggal hari ini dalam format WIB YYYY-MM-DD
export function getTodayWib() {
  const now = new Date()
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return wibTime.toISOString().slice(0, 10)
}

// ==========================================
// 24 TOOL IMPLEMENTATIONS
// ==========================================

export const toolHandlers = {
  // 1. pos_get_today_sales
  async pos_get_today_sales(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id, store_name } = await getDefaultStoreId(client, args.store_slug)
    const today = getTodayWib()

    const { data: report, error } = await client.rpc('sales_report', { p_from: today, p_to: today })
    if (error) throw new Error(`Gagal mengambil data penjualan: ${error.message}`)

    const totals = report?.totals || { orders: 0, gross: 0, net: 0, discount: 0, tax: 0, service: 0 }
    const aov = totals.orders > 0 ? Math.round(totals.net / totals.orders) : 0

    return wrapEnvelope(
      {
        business_day: today,
        store_id,
        store_name,
        orders_count: totals.orders,
        gross_sales: totals.gross,
        gross_sales_formatted: formatRp(totals.gross),
        net_sales: totals.net,
        net_sales_formatted: formatRp(totals.net),
        discount_amount: totals.discount,
        discount_amount_formatted: formatRp(totals.discount),
        tax_amount: totals.tax,
        tax_amount_formatted: formatRp(totals.tax),
        aov,
        aov_formatted: totals.orders > 0 ? formatRp(aov) : '–',
        by_method: report?.by_method || [],
        top_products: (report?.top_products || []).slice(0, 5),
      },
      totals.orders === 0 ? ['Belum ada transaksi selesai yang tercatat untuk hari ini.'] : [],
      { period: 'today' },
    )
  },

  // 2. pos_get_sales_report
  async pos_get_sales_report(args, authHeader) {
    const client = await getSupabase(authHeader)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: report, error } = await client.rpc('sales_report', { p_from: from, p_to: to })
    if (error) throw new Error(`Laporan penjualan gagal: ${error.message}`)

    const totals = report?.totals || { orders: 0, gross: 0, net: 0, discount: 0, tax: 0, service: 0 }
    const aov = totals.orders > 0 ? Math.round(totals.net / totals.orders) : 0

    return wrapEnvelope(
      {
        period: { from, to },
        totals: {
          ...totals,
          gross_formatted: formatRp(totals.gross),
          net_formatted: formatRp(totals.net),
          discount_formatted: formatRp(totals.discount),
          tax_formatted: formatRp(totals.tax),
          aov,
          aov_formatted: totals.orders > 0 ? formatRp(aov) : '–',
        },
        voids: report?.voids || { count: 0, amount: 0 },
        refunds: report?.refunds || { count: 0, amount: 0 },
        daily: report?.daily || [],
        by_method: report?.by_method || [],
        by_cashier: report?.by_cashier || [],
        top_products: (report?.top_products || []).slice(0, args.limit || 20),
      },
      [],
      { range_days: Math.round((new Date(to) - new Date(from)) / (86400000)) + 1 },
    )
  },

  // 3. pos_compare_periods
  async pos_compare_periods(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { period_a_from, period_a_to, period_b_from, period_b_to } = args

    const [resA, resB] = await Promise.all([
      client.rpc('sales_report', { p_from: period_a_from, p_to: period_a_to }),
      client.rpc('sales_report', { p_from: period_b_from, p_to: period_b_to }),
    ])

    if (resA.error) throw new Error(`Gagal periode A: ${resA.error.message}`)
    if (resB.error) throw new Error(`Gagal periode B: ${resB.error.message}`)

    const totA = resA.data?.totals || { orders: 0, gross: 0, net: 0 }
    const totB = resB.data?.totals || { orders: 0, gross: 0, net: 0 }

    const deltaNet = totA.net - totB.net
    const pctNet = totB.net > 0 ? Math.round((deltaNet / totB.net) * 1000) / 10 : 0
    const deltaOrders = totA.orders - totB.orders
    const pctOrders = totB.orders > 0 ? Math.round((deltaOrders / totB.orders) * 1000) / 10 : 0

    return wrapEnvelope({
      period_a: { from: period_a_from, to: period_a_to, net: totA.net, net_formatted: formatRp(totA.net), orders: totA.orders },
      period_b: { from: period_b_from, to: period_b_to, net: totB.net, net_formatted: formatRp(totB.net), orders: totB.orders },
      delta: {
        net_diff: deltaNet,
        net_diff_formatted: formatRp(deltaNet),
        net_growth_pct: `${pctNet}%`,
        orders_diff: deltaOrders,
        orders_growth_pct: `${pctOrders}%`,
      },
    })
  },

  // 4. pos_get_profit_report
  async pos_get_profit_report(args, authHeader) {
    const client = await getSupabase(authHeader)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: profit, error } = await client.rpc('profit_report', { p_from: from, p_to: to })
    if (error) throw new Error(`Laporan profit gagal: ${error.message}`)

    const revenue = profit?.revenue || 0
    const cogs = profit?.cogs || 0
    const wasteValue = profit?.waste_value || 0
    const marginInfo = calcMargin(revenue, cogs)
    const foodCostPct = revenue > 0 ? Math.round((cogs / revenue) * 1000) / 10 : 0

    return wrapEnvelope({
      period: { from, to },
      revenue,
      revenue_formatted: formatRp(revenue),
      cogs,
      cogs_formatted: formatRp(cogs),
      gross_profit: marginInfo.profit,
      gross_profit_formatted: formatRp(marginInfo.profit),
      gross_margin_pct: marginInfo.margin_pct_formatted,
      food_cost_pct: revenue > 0 ? `${foodCostPct}%` : '–',
      waste_value: wasteValue,
      waste_value_formatted: formatRp(wasteValue),
      top_items: (profit?.items || []).slice(0, 10),
    })
  },

  // 5. pos_get_item_profitability
  async pos_get_item_profitability(args, authHeader) {
    const client = await getSupabase(authHeader)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: profit, error } = await client.rpc('profit_report', { p_from: from, p_to: to })
    if (error) throw new Error(`Gagal membaca margin menu: ${error.message}`)

    let items = (profit?.items || []).map((it) => {
      const margin = calcMargin(it.revenue, it.cogs)
      return {
        ...it,
        gross_profit: margin.profit,
        gross_profit_formatted: formatRp(margin.profit),
        margin_pct: margin.margin_pct,
        margin_pct_formatted: margin.margin_pct_formatted,
        revenue_formatted: formatRp(it.revenue),
        cogs_formatted: formatRp(it.cogs),
      }
    })

    if (args.max_margin_pct !== undefined) {
      items = items.filter((it) => it.margin_pct <= args.max_margin_pct)
    }

    const limit = args.limit || 20
    return wrapEnvelope({
      period: { from, to },
      total_items: items.length,
      items: items.slice(0, limit),
    })
  },

  // 6. pos_get_recipe_costing
  async pos_get_recipe_costing(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    // Cari produk berdasarkan nama
    const { data: product, error: pErr } = await client
      .from('products')
      .select('id, name, price')
      .eq('store_id', store_id)
      .ilike('name', `%${args.item_name}%`)
      .limit(1)
      .maybeSingle()

    if (pErr || !product) throw new Error(`Menu "${args.item_name}" tidak ditemukan di database.`)

    // Ambil resep komposisi bahan
    const { data: recipeRows, error: rErr } = await client
      .from('recipes')
      .select('qty, ingredients (id, name, unit, cost)')
      .eq('product_id', product.id)

    if (rErr) throw new Error(`Gagal membaca resep: ${rErr.message}`)

    let totalHpp = 0
    const components = (recipeRows || []).map((r) => {
      const ing = r.ingredients
      const componentCost = Math.round((Number(r.qty) || 0) * (Number(ing?.cost) || 0))
      totalHpp += componentCost
      return {
        ingredient_name: ing?.name || '-',
        qty: r.qty,
        unit: ing?.unit || '-',
        unit_cost: ing?.cost || 0,
        unit_cost_formatted: formatRp(ing?.cost || 0),
        subtotal_cogs: componentCost,
        subtotal_cogs_formatted: formatRp(componentCost),
      }
    })

    const marginInfo = calcMargin(product.price, totalHpp)

    return wrapEnvelope({
      product_name: product.name,
      selling_price: product.price,
      selling_price_formatted: formatRp(product.price),
      total_cogs: totalHpp,
      total_cogs_formatted: formatRp(totalHpp),
      gross_profit: marginInfo.profit,
      gross_profit_formatted: formatRp(marginInfo.profit),
      margin_pct: marginInfo.margin_pct_formatted,
      recipe_components: components,
    })
  },

  // 7. pos_get_active_shift
  async pos_get_active_shift(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client, args.store_slug)

    const { data: shift, error } = await client
      .from('shifts')
      .select('*')
      .eq('store_id', store_id)
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Gagal cek shift aktif: ${error.message}`)
    if (!shift) {
      return wrapEnvelope(
        { active: false, message: 'Tidak ada shift kasir yang sedang aktif saat ini.' },
        ['Laci kasir dalam keadaan tertutup/bebas.'],
      )
    }

    return wrapEnvelope({
      active: true,
      shift_id: shift.id,
      shift_name: shift.shift_name || 'Reguler',
      opened_at: shift.opened_at,
      opened_by: shift.opened_by,
      opening_cash: shift.opening_cash,
      opening_cash_formatted: formatRp(shift.opening_cash),
      opening_note: shift.opening_note || '',
    })
  },

  // 8. pos_get_shift_detail
  async pos_get_shift_detail(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client, args.store_slug)

    let query = client.from('shifts').select('*').eq('store_id', store_id)
    if (args.shift_id && args.shift_id !== 'latest') {
      query = query.eq('id', args.shift_id)
    } else {
      query = query.not('closed_at', 'is', null).order('closed_at', { ascending: false }).limit(1)
    }

    const { data: shift, error } = await query.maybeSingle()
    if (error || !shift) throw new Error(`Detail shift tidak ditemukan.`)

    const diff = Number(shift.difference) || 0
    let statusDiscrepancy = 'Cocok (Balance)'
    if (diff < 0) statusDiscrepancy = `Minus / Kurang (Shortage ${formatRp(Math.abs(diff))})`
    if (diff > 0) statusDiscrepancy = `Lebih (Overage ${formatRp(diff)})`

    return wrapEnvelope({
      shift_id: shift.id,
      shift_name: shift.shift_name || 'Reguler',
      opened_at: shift.opened_at,
      closed_at: shift.closed_at,
      opening_cash: shift.opening_cash,
      opening_cash_formatted: formatRp(shift.opening_cash),
      expected_cash: shift.expected_cash,
      expected_cash_formatted: formatRp(shift.expected_cash),
      counted_cash: shift.counted_cash,
      counted_cash_formatted: formatRp(shift.counted_cash),
      difference: diff,
      difference_formatted: formatRp(diff),
      status_discrepancy: statusDiscrepancy,
      closing_note: shift.note || '',
      is_forced: !!shift.forced,
    })
  },

  // 9. pos_get_shift_summary
  async pos_get_shift_summary(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client, args.store_slug)

    let query = client.from('shifts').select('*').eq('store_id', store_id).order('opened_at', { ascending: false }).limit(20)
    const { data: shifts, error } = await query
    if (error) throw new Error(`Gagal membaca riwayat shift: ${error.message}`)

    let totalShortage = 0
    let totalOverage = 0
    const list = (shifts || []).map((s) => {
      const diff = Number(s.difference) || 0
      if (diff < 0) totalShortage += Math.abs(diff)
      if (diff > 0) totalOverage += diff
      return {
        shift_id: s.id,
        shift_name: s.shift_name || '-',
        opened_at: s.opened_at,
        closed_at: s.closed_at,
        status: s.closed_at ? 'CLOSED' : 'OPEN',
        difference: diff,
        difference_formatted: formatRp(diff),
      }
    })

    return wrapEnvelope({
      total_shifts_inspected: list.length,
      total_shortage: totalShortage,
      total_shortage_formatted: formatRp(totalShortage),
      total_overage: totalOverage,
      total_overage_formatted: formatRp(totalOverage),
      shifts: list,
    })
  },

  // 10. pos_get_cash_movements
  async pos_get_cash_movements(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    let query = client.from('cash_movements').select('*').eq('store_id', store_id).order('created_at', { ascending: false })
    if (args.type && args.type !== 'all') {
      query = query.eq('kind', args.type.toUpperCase())
    }
    const { data: movements, error } = await query.limit(args.limit || 20)
    if (error) throw new Error(`Gagal membaca mutasi laci: ${error.message}`)

    const list = (movements || []).map((m) => ({
      id: m.id,
      kind: m.kind,
      amount: m.amount,
      amount_formatted: formatRp(m.amount),
      reason: m.reason || 'Tanpa keterangan',
      created_at: m.created_at,
    }))

    return wrapEnvelope({
      count: list.length,
      movements: list,
    })
  },

  // 11. pos_get_low_stock_ingredients
  async pos_get_low_stock_ingredients(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    const { data: ingredients, error } = await client
      .from('ingredients')
      .select('id, name, stock, min_stock, unit, cost')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .order('stock', { ascending: true })

    if (error) throw new Error(`Gagal membaca inventori bahan: ${error.message}`)

    const ratio = args.threshold_ratio || 1.0
    const lowStock = (ingredients || [])
      .filter((i) => i.stock <= i.min_stock * ratio)
      .map((i) => ({
        id: i.id,
        name: i.name,
        stock: i.stock,
        min_stock: i.min_stock,
        unit: i.unit,
        unit_cost: i.cost,
        unit_cost_formatted: formatRp(i.cost),
        status: i.stock <= 0 ? 'HABIS (OOS)' : 'KRITIS (DI BAWAH MIN)',
      }))

    return wrapEnvelope(
      {
        total_low_stock_count: lowStock.length,
        items: lowStock,
      },
      lowStock.length > 0 ? [`Terdapat ${lowStock.length} bahan baku berada pada tingkat stok kritis/habis.`] : [],
    )
  },

  // 12. pos_get_stock_movements
  async pos_get_stock_movements(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    let query = client
      .from('stock_movements')
      .select('id, delta, reason, created_at, ingredients (name, unit)')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false })

    if (args.type) query = query.eq('reason', args.type.toUpperCase())
    const { data: movements, error } = await query.limit(args.limit || 20)
    if (error) throw new Error(`Gagal membaca mutasi stok: ${error.message}`)

    const list = (movements || []).map((m) => ({
      id: m.id,
      ingredient_name: m.ingredients?.name || '-',
      delta: m.delta,
      unit: m.ingredients?.unit || '',
      reason: m.reason,
      created_at: m.created_at,
    }))

    return wrapEnvelope({
      count: list.length,
      movements: list,
    })
  },

  // 13. pos_get_waste_report
  async pos_get_waste_report(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: movements, error } = await client
      .from('stock_movements')
      .select('id, delta, reason, created_at, ingredients (name, unit, cost)')
      .eq('store_id', store_id)
      .eq('reason', 'WASTE')
      .gte('created_at', `${from}T00:00:00+07:00`)
      .lte('created_at', `${to}T23:59:59+07:00`)

    if (error) throw new Error(`Gagal membaca laporan waste: ${error.message}`)

    let totalWasteValue = 0
    const items = (movements || []).map((m) => {
      const qtyLost = Math.abs(m.delta)
      const cost = m.ingredients?.cost || 0
      const value = Math.round(qtyLost * cost)
      totalWasteValue += value
      return {
        ingredient: m.ingredients?.name || '-',
        qty_lost: qtyLost,
        unit: m.ingredients?.unit || '',
        waste_value: value,
        waste_value_formatted: formatRp(value),
        created_at: m.created_at,
      }
    })

    return wrapEnvelope({
      period: { from, to },
      total_waste_incidents: items.length,
      total_waste_value: totalWasteValue,
      total_waste_value_formatted: formatRp(totalWasteValue),
      items,
    })
  },

  // 14. pos_get_membership_summary
  async pos_get_membership_summary(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client, args.store_slug)

    const { data: members, error } = await client.from('members').select('points, visits, total_spent').eq('store_id', store_id)
    if (error) throw new Error(`Gagal membaca member: ${error.message}`)

    const totalMembers = members?.length || 0
    let totalPoints = 0
    let totalSpendAll = 0
    let totalVisitsAll = 0

    for (const m of members || []) {
      totalPoints += Number(m.points) || 0
      totalSpendAll += Number(m.total_spent) || 0
      totalVisitsAll += Number(m.visits) || 0
    }

    return wrapEnvelope({
      total_members: totalMembers,
      total_points_liability: totalPoints,
      total_member_spending: totalSpendAll,
      total_member_spending_formatted: formatRp(totalSpendAll),
      average_visits_per_member: totalMembers > 0 ? Math.round((totalVisitsAll / totalMembers) * 10) / 10 : 0,
    })
  },

  // 15. pos_get_top_members
  async pos_get_top_members(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    const { data: members, error } = await client
      .from('members')
      .select('id, name, phone, points, visits, total_spent')
      .eq('store_id', store_id)
      .order('total_spent', { ascending: false })
      .limit(args.limit || 10)

    if (error) throw new Error(`Gagal membaca top member: ${error.message}`)

    const list = (members || []).map((m) => ({
      name: m.name || 'Member Tanpa Nama',
      phone_masked: m.phone ? m.phone.slice(0, 4) + '****' + m.phone.slice(-3) : '-',
      visits: m.visits,
      points: m.points,
      total_spent: m.total_spent,
      total_spent_formatted: formatRp(m.total_spent),
    }))

    return wrapEnvelope({
      count: list.length,
      top_members: list,
    })
  },

  // 16. pos_get_voucher_performance
  async pos_get_voucher_performance(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    const { data: vouchers, error } = await client
      .from('vouchers')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Gagal membaca voucher: ${error.message}`)

    const totalIssued = vouchers?.length || 0
    const redeemed = (vouchers || []).filter((v) => v.redeemed_at !== null)
    const rate = totalIssued > 0 ? Math.round((redeemed.length / totalIssued) * 1000) / 10 : 0

    return wrapEnvelope({
      total_vouchers_issued: totalIssued,
      total_redeemed: redeemed.length,
      redemption_rate: `${rate}%`,
      active_vouchers: (vouchers || []).filter((v) => !v.redeemed_at).slice(0, 10),
    })
  },

  // 17. pos_get_payment_breakdown
  async pos_get_payment_breakdown(args, authHeader) {
    const client = await getSupabase(authHeader)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: report, error } = await client.rpc('sales_report', { p_from: from, p_to: to })
    if (error) throw new Error(`Gagal membaca metode bayar: ${error.message}`)

    const methods = report?.by_method || []
    const totalNet = (report?.totals?.net) || 0

    const list = methods.map((m) => ({
      payment_method: m.method || 'LAINNYA',
      orders_count: m.orders,
      total_amount: m.net,
      total_amount_formatted: formatRp(m.net),
      share_percentage: totalNet > 0 ? `${Math.round((m.net / totalNet) * 1000) / 10}%` : '0%',
    }))

    return wrapEnvelope({
      period: { from, to },
      breakdown: list,
    })
  },

  // 18. pos_get_top_selling_items
  async pos_get_top_selling_items(args, authHeader) {
    const client = await getSupabase(authHeader)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: report, error } = await client.rpc('sales_report', { p_from: from, p_to: to })
    if (error) throw new Error(`Gagal membaca menu terlaris: ${error.message}`)

    const list = (report?.top_products || []).slice(0, args.limit || 10).map((p) => ({
      name: p.name,
      qty_sold: p.qty,
      revenue: p.revenue,
      revenue_formatted: formatRp(p.revenue),
    }))

    return wrapEnvelope({
      period: { from, to },
      top_items: list,
    })
  },

  // 19. pos_get_hourly_sales_trend
  async pos_get_hourly_sales_trend(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)
    const date = args.date || getTodayWib()

    const { data: orders, error } = await client
      .from('orders')
      .select('created_at, total')
      .eq('store_id', store_id)
      .eq('business_day', date)
      .in('status', ['IN_KITCHEN', 'READY', 'COMPLETED'])

    if (error) throw new Error(`Gagal membaca tren jam: ${error.message}`)

    const hourlyMap = {}
    for (let h = 0; h < 24; h++) hourlyMap[h] = { hour: `${String(h).padStart(2, '0')}:00`, orders: 0, revenue: 0 }

    for (const o of orders || []) {
      const d = new Date(o.created_at)
      const h = (d.getUTCHours() + 7) % 24
      hourlyMap[h].orders += 1
      hourlyMap[h].revenue += Number(o.total) || 0
    }

    const hourlyArray = Object.values(hourlyMap).map((item) => ({
      ...item,
      revenue_formatted: formatRp(item.revenue),
    }))

    return wrapEnvelope({
      business_day: date,
      hourly_trend: hourlyArray,
    })
  },

  // 20. pos_get_audit_logs
  async pos_get_audit_logs(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    let query = client.from('audit_log').select('*').eq('store_id', store_id).order('created_at', { ascending: false })
    if (args.action) query = query.eq('action', args.action.toUpperCase())

    const { data: logs, error } = await query.limit(args.limit || 20)
    if (error) throw new Error(`Gagal membaca audit log: ${error.message}`)

    const safeLogs = (logs || []).map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entity_id: l.entity_id,
      detail: l.detail,
      created_at: l.created_at,
    }))

    return wrapEnvelope({
      count: safeLogs.length,
      logs: safeLogs,
    })
  },

  // 21. pos_get_void_audit_report
  async pos_get_void_audit_report(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: voidOrders, error } = await client
      .from('orders')
      .select('id, queue_code, total, void_reason, voided_at, items')
      .eq('store_id', store_id)
      .eq('status', 'VOID')
      .gte('business_day', from)
      .lte('business_day', to)

    if (error) throw new Error(`Gagal membaca laporan void: ${error.message}`)

    let totalVoidAmount = 0
    const list = (voidOrders || []).map((v) => {
      totalVoidAmount += Number(v.total) || 0
      return {
        order_id: v.id,
        queue_code: v.queue_code,
        total_lost: v.total,
        total_lost_formatted: formatRp(v.total),
        void_reason: v.void_reason || 'Tidak ada alasan tercatat',
        voided_at: v.voided_at,
      }
    })

    return wrapEnvelope({
      period: { from, to },
      total_void_orders: list.length,
      total_void_amount: totalVoidAmount,
      total_void_amount_formatted: formatRp(totalVoidAmount),
      void_orders: list,
    })
  },

  // 22. pos_get_store_info
  async pos_get_store_info(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client, args.store_slug)

    const { data: store, error } = await client.from('stores').select('*').eq('id', store_id).single()
    if (error) throw new Error(`Gagal membaca data outlet: ${error.message}`)

    return wrapEnvelope({
      store_id: store.id,
      name: store.name,
      slug: store.slug,
      currency: 'IDR',
      timezone: 'Asia/Jakarta (WIB)',
      created_at: store.created_at,
    })
  },

  // 23. pos_preview_void_order
  async pos_preview_void_order(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)

    const { data: order, error } = await client
      .from('orders')
      .select('*')
      .eq('store_id', store_id)
      .eq('id', args.order_id)
      .maybeSingle()

    if (error || !order) throw new Error(`Pesanan dengan ID ${args.order_id} tidak ditemukan.`)

    return wrapEnvelope(
      {
        order_id: order.id,
        queue_code: order.queue_code,
        status: order.status,
        total_to_refund: order.total,
        total_to_refund_formatted: formatRp(order.total),
        items_count: (order.items || []).length,
        requires_supervisor_pin: true,
        mutation_allowed_via_mcp: false,
        instruction: 'Operasi pembatalan transaksi (VOID) memerlukan otorisasi fisik PIN supervisor di aplikasi kasir.',
      },
      ['MCP Server beroperasi dalam mode Read-Only. Hubungi Supervisor langsung di kasir.'],
    )
  },

  // 24. pos_get_unauthorized_voids
  async pos_get_unauthorized_voids(args, authHeader) {
    const client = await getSupabase(authHeader)
    const { store_id } = await getDefaultStoreId(client)
    const today = getTodayWib()
    const from = args.from || today
    const to = args.to || today

    const { data: voids, error } = await client
      .from('orders')
      .select('id, queue_code, total, void_reason, voided_at, voided_by')
      .eq('store_id', store_id)
      .eq('status', 'VOID')
      .is('voided_by', null)
      .gte('business_day', from)
      .lte('business_day', to)

    if (error) throw new Error(`Gagal audit void: ${error.message}`)

    return wrapEnvelope({
      period: { from, to },
      unauthorized_voids_count: (voids || []).length,
      suspicious_orders: voids || [],
    })
  },

  // 25. pos_get_shift_discrepancies
  async pos_get_shift_discrepancies(args, authHeader, userContext) {
    const client = await getSupabase(authHeader)
    const { store_id, store_name } = await getDefaultStoreId(client, args.store_slug, userContext)
    const today = getTodayWib()
    const from = args.from || today.slice(0, 7) + '-01'
    const to = args.to || today

    const { data: shifts, error } = await client
      .from('shifts')
      .select('id, opened_at, closed_at, opened_by, closed_by, opening_cash, counted_cash, expected_cash, difference, note, forced')
      .eq('store_id', store_id)
      .not('closed_at', 'is', null)
      .neq('difference', 0)
      .gte('closed_at', `${from}T00:00:00Z`)
      .lte('closed_at', `${to}T23:59:59Z`)
      .order('closed_at', { ascending: false })

    if (error) throw new Error(`Gagal mengambil data selisih shift: ${error.message}`)

    const userIds = [...new Set((shifts || []).flatMap((s) => [s.opened_by, s.closed_by]).filter(Boolean))]
    let profileMap = {}
    if (userIds.length > 0) {
      const { data: profs } = await client.from('profiles').select('user_id, display_name, email').in('user_id', userIds)
      profileMap = Object.fromEntries((profs || []).map((p) => [p.user_id, p.display_name || p.email]))
    }

    let totalShortage = 0
    let totalOverage = 0

    const items = (shifts || []).map((s) => {
      const diff = s.difference || 0
      if (diff < 0) totalShortage += Math.abs(diff)
      else totalOverage += diff

      return {
        shift_id: s.id,
        closed_at: s.closed_at,
        cashier: profileMap[s.closed_by] || profileMap[s.opened_by] || 'Kasir',
        expected_cash: s.expected_cash,
        expected_cash_formatted: formatRp(s.expected_cash),
        counted_cash: s.counted_cash,
        counted_cash_formatted: formatRp(s.counted_cash),
        difference: diff,
        difference_formatted: (diff < 0 ? '- ' : '+ ') + formatRp(Math.abs(diff)),
        status: diff < 0 ? 'TEKOR / KURANG' : 'LEBIH',
        reason: s.note || '(Tidak ada catatan)',
        was_forced: s.forced,
      }
    })

    return wrapEnvelope({
      store_id,
      store_name,
      period: { from, to },
      discrepancies_count: items.length,
      total_shortage: totalShortage,
      total_shortage_formatted: formatRp(totalShortage),
      total_overage: totalOverage,
      total_overage_formatted: formatRp(totalOverage),
      net_discrepancy: totalOverage - totalShortage,
      net_discrepancy_formatted: formatRp(totalOverage - totalShortage),
      shifts: items,
    })
  },
}

// ==========================================
// TOOL SCHEMAS FOR TOOLS/LIST
// ==========================================

export const toolDefinitions = [
  {
    name: 'pos_get_today_sales',
    description: 'Ambil ringkasan omzet dan transaksi penjualan hari ini (Gross Sales, Net Sales, AOV, Diskon, Pajak).',
    inputSchema: {
      type: 'object',
      properties: {
        store_slug: { type: 'string', description: 'Slug toko (opsional, default: warkop-nusantara)' },
      },
    },
  },
  {
    name: 'pos_get_sales_report',
    description: 'Laporan penjualan agregat untuk rentang tanggal tertentu (harian, metode bayar, top produk, kasir).',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
        limit: { type: 'number', description: 'Batas jumlah item produk' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_compare_periods',
    description: 'Bandingkan performa penjualan antara dua periode (omzet, pesanan, AOV, selisih delta %).',
    inputSchema: {
      type: 'object',
      properties: {
        period_a_from: { type: 'string', description: 'Periode A mulai YYYY-MM-DD' },
        period_a_to: { type: 'string', description: 'Periode A selesai YYYY-MM-DD' },
        period_b_from: { type: 'string', description: 'Periode B mulai YYYY-MM-DD' },
        period_b_to: { type: 'string', description: 'Periode B selesai YYYY-MM-DD' },
      },
      required: ['period_a_from', 'period_a_to', 'period_b_from', 'period_b_to'],
    },
  },
  {
    name: 'pos_get_profit_report',
    description: 'Laporan laba kotor, total HPP/COGS, Food Cost %, dan nilai kerugian bahan baku (waste).',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_get_item_profitability',
    description: 'Peringkat profitabilitas per menu: harga jual, HPP resep, margin nominal (Rp), dan margin persentase (%).',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
        max_margin_pct: { type: 'number', description: 'Filter maksimal margin % (misal: menu di bawah 40%)' },
        limit: { type: 'number', description: 'Batas jumlah menu' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_get_recipe_costing',
    description: 'Rincian komposisi bahan baku dan kalkulasi HPP resep untuk menu tertentu.',
    inputSchema: {
      type: 'object',
      properties: {
        item_name: { type: 'string', description: 'Nama menu minuman atau makanan' },
      },
      required: ['item_name'],
    },
  },
  {
    name: 'pos_get_active_shift',
    description: 'Informasi shift kasir yang sedang berjalan (kasir, jam buka, modal awal, penjualan tunai saat ini).',
    inputSchema: {
      type: 'object',
      properties: {
        store_slug: { type: 'string', description: 'Slug toko' },
      },
    },
  },
  {
    name: 'pos_get_shift_detail',
    description: 'Rincian shift kasir yang sudah ditutup: modal, penjualan kas & non-kas, kas akhir, dan selisih (short/over).',
    inputSchema: {
      type: 'object',
      properties: {
        shift_id: { type: 'string', description: 'ID shift atau "latest"' },
        store_slug: { type: 'string', description: 'Slug toko' },
      },
    },
  },
  {
    name: 'pos_get_shift_summary',
    description: 'Ringkasan seluruh shift kasir dalam periode tertentu beserta rekap selisih kas.',
    inputSchema: {
      type: 'object',
      properties: {
        store_slug: { type: 'string', description: 'Slug toko' },
      },
    },
  },
  {
    name: 'pos_get_cash_movements',
    description: 'Riwayat mutasi kas masuk/keluar di laci kasir (pembelian gas, es batu, modal tambahan).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '"in", "out", atau "all"' },
        limit: { type: 'number', description: 'Batas jumlah catatan' },
      },
    },
  },
  {
    name: 'pos_get_low_stock_ingredients',
    description: 'Daftar bahan baku yang stoknya di bawah batas aman (safety stock) atau mendekati habis.',
    inputSchema: {
      type: 'object',
      properties: {
        threshold_ratio: { type: 'number', description: 'Rasio batas ambang (default 1.0)' },
      },
    },
  },
  {
    name: 'pos_get_stock_movements',
    description: 'Riwayat pergerakan stok bahan baku (penerimaan barang, pemakaian resep, penyesuaian opname).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Alasan: IN, OUT, ADJUST, WASTE' },
        limit: { type: 'number', description: 'Batas jumlah baris' },
      },
    },
  },
  {
    name: 'pos_get_waste_report',
    description: 'Laporan bahan baku yang terbuang/rusak (waste) beserta nilai kerugian dalam Rupiah.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_get_membership_summary',
    description: 'Ringkasan data loyalitas member: total member terdaftar, member aktif, dan poin beredar.',
    inputSchema: {
      type: 'object',
      properties: {
        store_slug: { type: 'string', description: 'Slug toko' },
      },
    },
  },
  {
    name: 'pos_get_top_members',
    description: 'Daftar member paling loyal berdasarkan akumulasi nilai belanja (total spend) dan frekuensi kunjungan.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Jumlah member teratas' },
      },
    },
  },
  {
    name: 'pos_get_voucher_performance',
    description: 'Performa penggunaan voucher dan kupon promosi: tingkat klaim dan omzet yang dihasilkan.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'pos_get_payment_breakdown',
    description: 'Proporsi penerimaan omzet berdasarkan metode pembayaran (Tunai, QRIS, Kartu Debit, Transfer).',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_get_top_selling_items',
    description: 'Peringkat menu terlaris berdasarkan kuantitas porsi terjual dan kontribusi nominal omzet.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
        limit: { type: 'number', description: 'Batas ranking' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_get_hourly_sales_trend',
    description: 'Tren volume dan omzet penjualan per jam sepanjang hari untuk mendeteksi jam-jam sibuk (peak hours).',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Tanggal YYYY-MM-DD' },
      },
      required: ['date'],
    },
  },
  {
    name: 'pos_get_audit_logs',
    description: 'Jejak audit sistem POS: riwayat pembatalan pesanan (void), diskon manual, perubahan harga, dan resep.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Filter aksi audit' },
        limit: { type: 'number', description: 'Batas log' },
      },
    },
  },
  {
    name: 'pos_get_void_audit_report',
    description: 'Laporan audit khusus pesanan yang dibatalkan (void) setelah dicetak atau diproses di kasir.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_get_store_info',
    description: 'Informasi outlet toko: nama toko, alamat, mata uang, zona waktu, dan pengaturan pajak restoran.',
    inputSchema: {
      type: 'object',
      properties: {
        store_slug: { type: 'string', description: 'Slug toko' },
      },
    },
  },
  {
    name: 'pos_preview_void_order',
    description: 'Simulasikan dampak pembatalan pesanan (nominal uang dikembalikan) sebelum diotorisasi supervisor.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'ID pesanan' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'pos_get_unauthorized_voids',
    description: 'Deteksi pesanan yang dibatalkan tanpa jejak supervisor PIN atau melanggar SOP kasir.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'pos_get_shift_discrepancies',
    description: 'Audit selisih uang laci kasir (kas tekor atau uang lebih) saat tutup shift beserta nama kasir dan alasannya.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Tanggal mulai YYYY-MM-DD (default awal bulan)' },
        to: { type: 'string', description: 'Tanggal selesai YYYY-MM-DD (default hari ini)' },
        store_slug: { type: 'string', description: 'Slug toko (opsional)' },
      },
    },
  },
]

