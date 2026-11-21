import crypto from 'node:crypto'
import { allow, supabaseFor } from '../server/supabase.js'

/**
 * Resolusi kredensial Midtrans:
 * 1. Ambil dari database store jika owner telah menyetel key khusus.
 * 2. Fallback ke environment variables (MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION).
 */
async function getMidtransConfig(sb, storeId) {
  let storeConfig = null
  if (storeId) {
    const { data } = await sb
      .from('stores')
      .select('midtrans_enabled, midtrans_is_production, midtrans_server_key, midtrans_client_key')
      .eq('id', storeId)
      .maybeSingle()
    storeConfig = data
  }

  const serverKey = storeConfig?.midtrans_server_key || process.env.MIDTRANS_SERVER_KEY || ''
  const clientKey = storeConfig?.midtrans_client_key || process.env.MIDTRANS_CLIENT_KEY || process.env.VITE_MIDTRANS_CLIENT_KEY || ''
  const isProduction = storeConfig ? Boolean(storeConfig.midtrans_is_production) : String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true'
  const isEnabled = storeConfig ? Boolean(storeConfig.midtrans_enabled) : Boolean(serverKey && clientKey)

  return {
    serverKey,
    clientKey,
    isProduction,
    isEnabled,
  }
}

function getSnapUrl(isProduction) {
  return isProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
}

function getCoreApiUrl(isProduction) {
  return isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
}

export default async function handler(req, res) {
  // Tangani CORS preflight bila ada
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(204).end()
  }

  const action = req.query?.action || req.body?.action || 'token'
  const sb = supabaseFor(req)

  // ─── 1. TEST KONEKSI KEY MIDTRANS ───
  if (action === 'test') {
    if (!allow(req, res, 'POST')) return
    const { serverKey, isProduction } = req.body || {}
    const keyToTest = serverKey || process.env.MIDTRANS_SERVER_KEY
    if (!keyToTest) {
      return res.status(400).json({ success: false, error: 'Server Key Midtrans belum diisi' })
    }

    const snapUrl = getSnapUrl(Boolean(isProduction))
    const authHeader = 'Basic ' + Buffer.from(`${keyToTest}:`).toString('base64')

    try {
      const response = await fetch(snapUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: `TEST-CONN-${Date.now()}`,
            gross_amount: 10000,
          },
          customer_details: {
            first_name: 'Test Midtrans Antigravity',
          },
        }),
      })

      const data = await response.json()
      if (response.ok && data?.token) {
        return res.status(200).json({
          success: true,
          message: 'Koneksi ke Midtrans berhasil! Server Key valid.',
          mode: isProduction ? 'Production' : 'Sandbox',
        })
      } else {
        const errMessage = data?.error_messages ? data.error_messages.join(', ') : (data?.message || 'Koneksi ditolak oleh Midtrans')
        return res.status(400).json({
          success: false,
          error: `Midtrans Error: ${errMessage}`,
        })
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Gagal menghubungi server Midtrans: ${err.message}`,
      })
    }
  }

  // ─── 2. DAPATKAN CONFIG PUBLIK (CLIENT KEY) UNTUK FRONTEND ───
  if (action === 'config') {
    const storeId = req.query?.storeId || req.body?.storeId
    const cfg = await getMidtransConfig(sb, storeId)
    return res.status(200).json({
      success: true,
      enabled: cfg.isEnabled,
      clientKey: cfg.clientKey,
      isProduction: cfg.isProduction,
    })
  }

  // ─── 3. BUAT SNAP TOKEN TRANSAKSI ───
  if (action === 'token') {
    if (!allow(req, res, 'POST')) return
    const { orderId, storeId } = req.body || {}
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId wajib diisi' })
    }

    // Ambil order dari database
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .select('id, queue_code, total, customer_name, table_no, order_type, items, status, store_id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return res.status(404).json({ success: false, error: 'Pesanan tidak ditemukan' })
    }

    if (order.status !== 'UNPAID') {
      return res.status(400).json({ success: false, error: 'Pesanan sudah dibayar atau tidak valid' })
    }

    const targetStoreId = storeId || order.store_id
    const cfg = await getMidtransConfig(sb, targetStoreId)

    if (!cfg.serverKey) {
      return res.status(400).json({
        success: false,
        error: 'Midtrans Server Key belum dikonfigurasi untuk toko ini.',
      })
    }

    const snapUrl = getSnapUrl(cfg.isProduction)
    const authHeader = 'Basic ' + Buffer.from(`${cfg.serverKey}:`).toString('base64')

    // Midtrans order_id harus unik per percobaan bayar
    const midtransOrderId = `${order.queue_code}-${order.id.slice(0, 8)}-${Date.now()}`

    const payload = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: Math.round(order.total),
      },
      customer_details: {
        first_name: order.customer_name || 'Pelanggan',
      },
      item_details: [
        {
          id: order.id.slice(0, 8),
          price: Math.round(order.total),
          quantity: 1,
          name: `Pesanan ${order.queue_code} (${order.order_type === 'DINE_IN' ? `Meja ${order.table_no || '-'}` : 'Bawa Pulang'})`.slice(0, 50),
        },
      ],
    }

    try {
      const response = await fetch(snapUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      })

      const snapData = await response.json()
      if (!response.ok || !snapData?.token) {
        const msg = snapData?.error_messages ? snapData.error_messages.join(', ') : (snapData?.message || 'Gagal membuat token Midtrans')
        return res.status(400).json({ success: false, error: msg })
      }

      // Simpan snap token ke pesanan
      await sb
        .from('orders')
        .update({
          midtrans_snap_token: snapData.token,
          midtrans_redirect_url: snapData.redirect_url,
        })
        .eq('id', order.id)

      return res.status(200).json({
        success: true,
        token: snapData.token,
        redirect_url: snapData.redirect_url,
        client_key: cfg.clientKey,
        is_production: cfg.isProduction,
        midtrans_order_id: midtransOrderId,
      })
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Gagal memanggil Midtrans Snap: ${err.message}`,
      })
    }
  }

  // ─── 4. CEK STATUS TRANSAKSI KE MIDTRANS CORE API ───
  if (action === 'check-status') {
    if (!allow(req, res, 'POST')) return
    const { orderId, midtransOrderId, storeId } = req.body || {}
    if (!orderId && !midtransOrderId) {
      return res.status(400).json({ success: false, error: 'orderId atau midtransOrderId wajib diisi' })
    }

    const { data: order } = await sb
      .from('orders')
      .select('id, store_id, status, total')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) return res.status(404).json({ success: false, error: 'Pesanan tidak ditemukan' })
    if (order.status !== 'UNPAID') {
      return res.status(200).json({ success: true, paid: true, status: order.status })
    }

    const cfg = await getMidtransConfig(sb, storeId || order.store_id)
    if (!cfg.serverKey) {
      return res.status(400).json({ success: false, error: 'Server key tidak ditemukan' })
    }

    const coreUrl = getCoreApiUrl(cfg.isProduction)
    const targetOrderId = midtransOrderId || order.id
    const authHeader = 'Basic ' + Buffer.from(`${cfg.serverKey}:`).toString('base64')

    try {
      const response = await fetch(`${coreUrl}/v2/${targetOrderId}/status`, {
        headers: { Accept: 'application/json', Authorization: authHeader },
      })
      const statusData = await response.json()

      const txStatus = statusData.transaction_status
      const fraudStatus = statusData.fraud_status

      const isPaid = (txStatus === 'capture' && fraudStatus === 'accept') || txStatus === 'settlement'

      if (isPaid) {
        // Tandai pesanan lunas di database lewat RPC pay_order_midtrans
        const { error: payErr } = await sb.rpc('pay_order_midtrans', {
          p_order_id: order.id,
          p_transaction_id: statusData.transaction_id || null,
          p_payment_type: statusData.payment_type || null,
          p_status: txStatus,
        })
        if (payErr) console.error('Error pay_order_midtrans:', payErr)
      }

      return res.status(200).json({
        success: true,
        paid: isPaid,
        transaction_status: txStatus,
        payment_type: statusData.payment_type,
      })
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message })
    }
  }

  // ─── 5. MIDTRANS WEBHOOK / NOTIFIKASI ───
  if (action === 'webhook') {
    if (!allow(req, res, 'POST')) return
    const notif = req.body || {}
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, payment_type, transaction_id } = notif

    if (!order_id || !signature_key) {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload' })
    }

    // Ambil order id asli dari midtrans order_id (format: QUEUE-ORDERID8-TIMESTAMP)
    // Atau cari di tabel orders
    const parts = order_id.split('-')
    const shortId = parts.length >= 2 ? parts[1] : null

    let order = null
    if (shortId) {
      const { data } = await sb.from('orders').select('id, store_id, total').ilike('id', `${shortId}%`).maybeSingle()
      order = data
    }
    if (!order) {
      const { data } = await sb.from('orders').select('id, store_id, total').eq('id', order_id).maybeSingle()
      order = data
    }

    const cfg = await getMidtransConfig(sb, order?.store_id)
    if (cfg.serverKey) {
      // Verifikasi signature: SHA512(order_id + status_code + gross_amount + server_key)
      const expectedSignature = crypto
        .createHash('sha512')
        .update(`${order_id}${status_code}${gross_amount}${cfg.serverKey}`)
        .digest('hex')

      if (expectedSignature !== signature_key) {
        return res.status(403).json({ success: false, error: 'Invalid signature key' })
      }
    }

    const isPaid = (transaction_status === 'capture' && fraud_status === 'accept') || transaction_status === 'settlement'

    if (order && isPaid) {
      await sb.rpc('pay_order_midtrans', {
        p_order_id: order.id,
        p_transaction_id: transaction_id || null,
        p_payment_type: payment_type || null,
        p_status: transaction_status,
      })
    }

    return res.status(200).json({ success: true, message: 'Notification received' })
  }

  return res.status(400).json({ success: false, error: `Action '${action}' tidak dikenal` })
}
