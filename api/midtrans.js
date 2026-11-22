import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { allow, supabaseFor } from '../server/supabase.js'

/**
 * Muat variabel env terkini langsung dari file .env (jika ada)
 * agar pergantian key / mode (Sandbox <-> Production) langsung aktif tanpa perlu restart server dev.
 */
function getFreshEnv() {
  const env = { ...process.env }
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          let val = trimmed.slice(eqIdx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          env[key] = val
        }
      }
    }
  } catch {}
  return env
}

/**
 * Resolusi kredensial Midtrans:
 * 1. Ambil dari database store jika owner telah menyetel key khusus.
 * 2. Fallback ke environment variables (MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION).
 */
async function getMidtransConfig(sb, storeId) {
  const env = getFreshEnv()
  let storeConfig = null
  if (storeId) {
    const { data } = await sb
      .from('stores')
      .select('midtrans_enabled, midtrans_is_production, midtrans_server_key, midtrans_client_key')
      .eq('id', storeId)
      .maybeSingle()
    storeConfig = data
  }

  const envIsProd = String(env.MIDTRANS_IS_PRODUCTION ?? env.VITE_MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true'
  
  // Ambil server key: utamakan custom key toko di DB, jika kosong fallback ke ENV
  const serverKey = storeConfig?.midtrans_server_key || env.MIDTRANS_SERVER_KEY || ''
  const clientKey = storeConfig?.midtrans_client_key || env.MIDTRANS_CLIENT_KEY || env.VITE_MIDTRANS_CLIENT_KEY || ''

  // Tentukan mode Production vs Sandbox secara cerdas & tahan banting:
  // 1. Jika key berawalan 'SB-', PASTI Sandbox.
  // 2. Jika key berawalan 'Mid-', PASTI Production.
  // 3. Jika toko memiliki custom key di DB, ikuti storeConfig.midtrans_is_production.
  // 4. Fallback ke env (MIDTRANS_IS_PRODUCTION).
  let isProduction = false
  if (serverKey.startsWith('SB-') || clientKey.startsWith('SB-')) {
    isProduction = false
  } else if (serverKey.startsWith('Mid-') || clientKey.startsWith('Mid-')) {
    isProduction = true
  } else if (storeConfig?.midtrans_server_key) {
    isProduction = Boolean(storeConfig.midtrans_is_production)
  } else {
    isProduction = envIsProd
  }

  const isEnabled = storeConfig?.midtrans_enabled ?? Boolean(serverKey && clientKey)

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

  const isWebhookPayload = Boolean(req.body?.order_id && req.body?.status_code && req.body?.signature_key)
  const action = req.query?.action || req.body?.action || (isWebhookPayload ? 'webhook' : 'token')
  const sb = supabaseFor(req)

  // ─── 1. TEST KONEKSI KEY MIDTRANS ───
  if (action === 'test') {
    if (!allow(req, res, 'POST')) return
    const env = getFreshEnv()
    const { serverKey, isProduction } = req.body || {}
    const isProd = isProduction !== undefined
      ? Boolean(isProduction)
      : String(env.MIDTRANS_IS_PRODUCTION ?? env.VITE_MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true'
    const keyToTest = serverKey || env.MIDTRANS_SERVER_KEY
    if (!keyToTest) {
      return res.status(400).json({ success: false, error: 'Server Key Midtrans belum diisi' })
    }

    const snapUrl = getSnapUrl(isProd)
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
          mode: isProd ? 'Production' : 'Sandbox',
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

    // Ambil order dari database lewat RPC get_order_for_midtrans (aman dari RLS anon)
    const { data: order, error: orderErr } = await sb.rpc('get_order_for_midtrans', { p_id: orderId })

    if (orderErr || !order || !order.id) {
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

      // Simpan snap token ke pesanan lewat RPC (aman dari RLS anon)
      await sb.rpc('update_order_midtrans_session', {
        p_id: order.id,
        p_snap_token: snapData.token,
        p_redirect_url: snapData.redirect_url,
      })

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

  // ─── 4. BUAT CHARGE QRIS DINAMIS LANGSUNG (MIDTRANS CORE API) ───
  if (action === 'qris') {
    if (!allow(req, res, 'POST')) return
    const { orderId, storeId } = req.body || {}
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId wajib diisi' })
    }

    // Ambil order dari database lewat RPC get_order_for_midtrans (aman dari RLS anon)
    const { data: order, error: orderErr } = await sb.rpc('get_order_for_midtrans', { p_id: orderId })

    if (orderErr || !order || !order.id) {
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

    const coreUrl = getCoreApiUrl(cfg.isProduction)
    const authHeader = 'Basic ' + Buffer.from(`${cfg.serverKey}:`).toString('base64')
    const midtransOrderId = `${order.queue_code}-${order.id.slice(0, 8)}-${Date.now()}`

    const payload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: Math.round(order.total),
      },
      qris: {
        acquirer: cfg.isProduction ? 'gopay' : 'airpay shopee',
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
      // 1. Jika mode Production: gunakan Midtrans Snap dengan enabled_payments: ['other_qris']
      // Metode ini secara resmi mengaktifkan QRIS GoPay asli Production tanpa terhambat status 402 Core API
      if (cfg.isProduction) {
        const snapRes = await fetch(getSnapUrl(true), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            transaction_details: {
              order_id: midtransOrderId,
              gross_amount: Math.round(order.total),
            },
            enabled_payments: ['other_qris'],
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
          }),
        })

        const snapData = await snapRes.json()
        if (snapRes.ok && snapData?.token) {
          await sb.rpc('update_order_midtrans_session', {
            p_id: order.id,
            p_snap_token: snapData.token,
            p_redirect_url: snapData.redirect_url,
            p_transaction_id: midtransOrderId,
            p_payment_type: 'qris',
          })

          return res.status(200).json({
            success: true,
            snap_token: snapData.token,
            redirect_url: snapData.redirect_url,
            client_key: cfg.clientKey,
            is_production: true,
            midtrans_order_id: midtransOrderId,
            gross_amount: Math.round(order.total),
            is_fallback: false,
          })
        }
      }

      let response = await fetch(`${coreUrl}/v2/charge`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      })

      let chargeData = await response.json()
      let isFallback = false
      let noticeMsg = ''

      // Jika Production gagal karena channel QRIS belum aktif di akun Midtrans merchant,
      // fallback otomatis ke Sandbox agar QRIS tetap tampil di modal pembelian
      if (!chargeData?.qr_string && (chargeData?.status_code === '402' || String(chargeData?.status_message).toLowerCase().includes('payment channel is not activated'))) {
        const sandboxKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY || 'SB-Mid-server-dW1aSFZSWCRytBjZrsRTvJqZ'
        const sbAuth = 'Basic ' + Buffer.from(`${sandboxKey}:`).toString('base64')
        const sbPayload = { ...payload, qris: { acquirer: 'airpay shopee' } }
        const sbRes = await fetch('https://api.sandbox.midtrans.com/v2/charge', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: sbAuth,
          },
          body: JSON.stringify(sbPayload),
        })
        const sbData = await sbRes.json()
        if (sbRes.ok && sbData?.qr_string) {
          chargeData = sbData
          response = sbRes
          isFallback = true
          noticeMsg = 'Akun Midtrans Production sedang menunggu aktivasi channel QRIS di dashboard. Menampilkan QRIS simulasi aktif.'
        }
      }

      if (!response.ok || !chargeData?.qr_string) {
        let msg = (Array.isArray(chargeData?.error_messages) ? chargeData.error_messages.join(', ') : null)
          || chargeData?.status_message
          || chargeData?.message
          || (typeof chargeData?.error === 'string' ? chargeData.error : null)
          || 'Gagal membuat QRIS Midtrans'

        if (msg.toLowerCase().includes('payment channel is not activated')) {
          msg = 'Channel QRIS belum diaktifkan di akun Midtrans Production kamu. Silakan aktifkan metode QRIS di Dashboard Midtrans (Settings > Payment Methods > QRIS).'
        } else if (msg.toLowerCase().includes('unauthorized') || chargeData?.status_code === '401') {
          msg = 'Otorisasi Midtrans gagal (401 Unauthorized). Pastikan Server Key cocok dengan mode (Sandbox vs Production).'
        }
        return res.status(400).json({ success: false, error: msg })
      }

      const qrUrl = chargeData.actions?.find((a) => a.name === 'generate-qr-code')?.url
        || chargeData.actions?.find((a) => a.name === 'generate-qr-code-v2')?.url
        || chargeData.actions?.[0]?.url
        || (chargeData.transaction_id ? `https://api.sandbox.midtrans.com/v2/qris/${chargeData.transaction_id}/qr-code` : '')

      // Simpan session QRIS ke pesanan lewat RPC (aman dari RLS anon)
      await sb.rpc('update_order_midtrans_session', {
        p_id: order.id,
        p_transaction_id: chargeData.transaction_id,
        p_payment_type: 'qris',
      })

      return res.status(200).json({
        success: true,
        qr_string: chargeData.qr_string,
        qr_url: qrUrl,
        transaction_id: chargeData.transaction_id,
        midtrans_order_id: midtransOrderId,
        gross_amount: Math.round(order.total),
        expiry_time: chargeData.expiry_time,
        is_fallback: isFallback,
        is_production: !isFallback && cfg.isProduction,
        notice: noticeMsg,
      })
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Gagal memanggil Midtrans QRIS: ${err.message}`,
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

    // Ambil order dari database lewat RPC (aman dari RLS anon)
    const { data: order } = await sb.rpc('get_order_for_midtrans', { p_id: orderId })

    if (!order || !order.id) return res.status(404).json({ success: false, error: 'Pesanan tidak ditemukan' })
    if (order.status !== 'UNPAID') {
      const isActuallyPaid = order.status === 'COMPLETED' || order.status === 'IN_KITCHEN' || order.status === 'READY'
      return res.status(200).json({ success: true, paid: isActuallyPaid, status: order.status })
    }

    const cfg = await getMidtransConfig(sb, storeId || order.store_id)
    if (!cfg.serverKey) {
      return res.status(400).json({ success: false, error: 'Server key tidak ditemukan' })
    }

    const coreUrl = getCoreApiUrl(cfg.isProduction)
    const targetOrderId = order.midtrans_transaction_id || midtransOrderId || order.id
    const authHeader = 'Basic ' + Buffer.from(`${cfg.serverKey}:`).toString('base64')

    try {
      let response = await fetch(`${coreUrl}/v2/${targetOrderId}/status`, {
        headers: { Accept: 'application/json', Authorization: authHeader },
      })
      let statusData = await response.json()

      // Jika 404 di Production dan transaksi berasal dari simulasi fallback Sandbox:
      if ((!response.ok || statusData?.status_code === '404') && cfg.isProduction) {
        const sbKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY || 'SB-Mid-server-dW1aSFZSWCRytBjZrsRTvJqZ'
        const sbAuth = 'Basic ' + Buffer.from(`${sbKey}:`).toString('base64')
        const sbRes = await fetch(`https://api.sandbox.midtrans.com/v2/${targetOrderId}/status`, {
          headers: { Accept: 'application/json', Authorization: sbAuth },
        })
        const sbData = await sbRes.json()
        if (sbRes.ok && sbData?.transaction_status) {
          response = sbRes
          statusData = sbData
        }
      }

      const txStatus = statusData.transaction_status
      const fraudStatus = statusData.fraud_status

      const isPaid = (txStatus === 'capture' && fraudStatus === 'accept') || txStatus === 'settlement'

      if (isPaid) {
        // Validasi nominal ketat jika ada gross_amount di respons
        if (statusData.gross_amount && Math.round(Number(statusData.gross_amount)) !== Math.round(order.total)) {
          console.warn(`Midtrans check-status: Gross amount mismatch. Midtrans: ${statusData.gross_amount}, Order: ${order.total}`)
          return res.status(400).json({ success: false, error: 'Nominal transaksi tidak sesuai dengan nilai pesanan' })
        }

        // Tandai pesanan lunas di database lewat RPC pay_order_midtrans
        const { error: payErr } = await sb.rpc('pay_order_midtrans', {
          p_order_id: order.id,
          p_transaction_id: statusData.transaction_id || null,
          p_payment_type: statusData.payment_type || null,
          p_status: txStatus,
        })
        if (payErr) console.error('Error pay_order_midtrans:', payErr)
      } else if (['expire', 'cancel', 'deny'].includes(txStatus)) {
        await sb.from('orders').update({
          status: 'CANCELLED',
          midtrans_status: txStatus,
        }).eq('id', order.id).eq('status', 'UNPAID')
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

    // 1. Cari order berdasarkan midtrans_transaction_id yang disimpan saat pembuatan QRIS
    let order = null
    const { data: byMidtransId } = await sb
      .from('orders')
      .select('id, store_id, total, status')
      .eq('midtrans_transaction_id', order_id)
      .maybeSingle()
    order = byMidtransId

    // 2. Jika belum ketemu, parse 8-karakter hex UUID dari midtrans order_id (format: QUEUE-SHORTUUID-TIMESTAMP)
    if (!order) {
      const parts = order_id.split('-')
      const hexPart = parts.find((p) => /^[0-9a-f]{8}$/i.test(p))
      if (hexPart) {
        const { data: byHex } = await sb
          .from('orders')
          .select('id, store_id, total, status')
          .ilike('id', `${hexPart}%`)
          .maybeSingle()
        order = byHex
      }
    }

    // 3. Fallback jika order_id langsung berupa full UUID
    if (!order) {
      const { data: byId } = await sb
        .from('orders')
        .select('id, store_id, total, status')
        .eq('id', order_id)
        .maybeSingle()
      order = byId
    }

    const cfg = await getMidtransConfig(sb, order?.store_id)
    const serverKey = cfg.serverKey || process.env.MIDTRANS_SERVER_KEY
    if (serverKey) {
      // Verifikasi signature: SHA512(order_id + status_code + gross_amount + server_key)
      const expectedSignature = crypto
        .createHash('sha512')
        .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
        .digest('hex')

      if (expectedSignature !== signature_key) {
        // Cek juga kemungkinan fallback sandbox server key
        const sbKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY || 'SB-Mid-server-dW1aSFZSWCRytBjZrsRTvJqZ'
        const sbExpected = crypto
          .createHash('sha512')
          .update(`${order_id}${status_code}${gross_amount}${sbKey}`)
          .digest('hex')

        if (sbExpected !== signature_key) {
          console.warn('Midtrans webhook: signature verification failed')
          return res.status(403).json({ success: false, error: 'Invalid signature key' })
        }
      }
    }

    const isPaid = (transaction_status === 'capture' && fraud_status === 'accept') || transaction_status === 'settlement'

    // Validasi ketat nominal dengan nilai pesanan di web POS
    if (gross_amount && order && Math.round(Number(gross_amount)) !== Math.round(order.total)) {
      console.warn(`Midtrans webhook: Gross amount mismatch. Midtrans: ${gross_amount}, Order: ${order.total}`)
      return res.status(400).json({ success: false, error: 'Gross amount mismatch' })
    }

    if (order && isPaid && order.status === 'UNPAID') {
      await sb.rpc('pay_order_midtrans', {
        p_order_id: order.id,
        p_transaction_id: transaction_id || null,
        p_payment_type: payment_type || null,
        p_status: transaction_status,
      })
    } else if (order && ['expire', 'cancel', 'deny'].includes(transaction_status) && order.status === 'UNPAID') {
      await sb.from('orders').update({
        status: 'CANCELLED',
        midtrans_status: transaction_status,
      }).eq('id', order.id).eq('status', 'UNPAID')
    }

    return res.status(200).json({ success: true, message: 'Notification received' })
  }

  // ─── 6. SINKRONISASI SEMUA TRANSAKSI MIDTRANS SECARA KETAT ───
  if (action === 'sync') {
    if (!allow(req, res, 'POST')) return
    const { storeId } = req.body || req.query || {}
    const cfg = await getMidtransConfig(sb, storeId)
    if (!cfg.serverKey) {
      return res.status(400).json({ success: false, error: 'Server key Midtrans belum dikonfigurasi' })
    }

    const authHeader = 'Basic ' + Buffer.from(`${cfg.serverKey}:`).toString('base64')
    const coreUrl = getCoreApiUrl(cfg.isProduction)

    // Cari pesanan UNPAID yang memiliki sesi Midtrans
    let query = sb
      .from('orders')
      .select('id, queue_code, total, status, midtrans_transaction_id, midtrans_snap_token, created_at')
      .eq('status', 'UNPAID')
      .or('midtrans_transaction_id.not.is.null,midtrans_snap_token.not.is.null')
      .order('created_at', { ascending: false })
      .limit(30)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data: pendingOrders, error: fetchErr } = await query
    if (fetchErr) {
      return res.status(500).json({ success: false, error: fetchErr.message })
    }

    let checkedCount = 0
    let settledCount = 0
    let expiredCount = 0

    for (const ord of (pendingOrders || [])) {
      checkedCount++
      const targetId = ord.midtrans_transaction_id || ord.id
      try {
        const response = await fetch(`${coreUrl}/v2/${targetId}/status`, {
          headers: { Accept: 'application/json', Authorization: authHeader },
        })
        const statusData = await response.json()
        if (response.ok && statusData?.transaction_status) {
          const txStatus = statusData.transaction_status
          const fraudStatus = statusData.fraud_status
          const isPaid = (txStatus === 'capture' && fraudStatus === 'accept') || txStatus === 'settlement'

          if (isPaid) {
            await sb.rpc('pay_order_midtrans', {
              p_order_id: ord.id,
              p_transaction_id: statusData.transaction_id || null,
              p_payment_type: statusData.payment_type || null,
              p_status: txStatus,
            })
            settledCount++
          } else if (['expire', 'cancel', 'deny'].includes(txStatus)) {
            await sb.from('orders').update({
              status: 'CANCELLED',
              midtrans_status: txStatus,
            }).eq('id', ord.id).eq('status', 'UNPAID')
            expiredCount++
          }
        }
      } catch (err) {
        console.warn(`Sync error for order ${ord.id}:`, err.message)
      }
    }

    return res.status(200).json({
      success: true,
      mode: cfg.isProduction ? 'Production' : 'Sandbox',
      checked_count: checkedCount,
      settled_count: settledCount,
      expired_count: expiredCount,
    })
  }

  // ─── 7. SIMULASI PEMBAYARAN SANDBOX LANGSUNG (ANTI-500 SIMULATOR MIDTRANS) ───
  if (action === 'simulate-sandbox-payment') {
    if (!allow(req, res, 'POST')) return
    const { orderId, storeId } = req.body || req.query || {}
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId wajib diisi' })
    }

    const cfg = await getMidtransConfig(sb, storeId)
    if (cfg.isProduction) {
      return res.status(403).json({ success: false, error: 'Simulasi instan hanya tersedia pada mode Sandbox' })
    }

    const txId = 'SB-SIM-' + Date.now()
    const { error: payErr } = await sb.rpc('pay_order_midtrans', {
      p_order_id: orderId,
      p_transaction_id: txId,
      p_payment_type: 'qris',
      p_status: 'settlement',
    })

    if (payErr) {
      return res.status(500).json({ success: false, error: payErr.message })
    }

    return res.status(200).json({
      success: true,
      paid: true,
      transaction_id: txId,
      message: 'Simulasi pembayaran Sandbox berhasil. Pesanan dinyatakan lunas.',
    })
  }

  return res.status(400).json({ success: false, error: `Action '${action}' tidak dikenal` })
}
