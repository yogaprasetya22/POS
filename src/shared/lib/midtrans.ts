/**
 * Integrasi Midtrans Snap untuk Pembayaran Dinamis POS Resto
 */

export type MidtransSnapResult = {
  status_code: string
  status_message: string
  transaction_id: string
  order_id: string
  gross_amount: string
  payment_type: string
  transaction_time: string
  transaction_status: 'capture' | 'settlement' | 'pending' | 'deny' | 'cancel' | 'expire' | 'failure'
  fraud_status?: string
}

export type MidtransConfig = {
  enabled: boolean
  clientKey: string
  isProduction: boolean
}

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks: {
          onSuccess?: (result: MidtransSnapResult) => void
          onPending?: (result: MidtransSnapResult) => void
          onError?: (result: MidtransSnapResult) => void
          onClose?: () => void
        },
      ) => void
      embed?: (
        token: string,
        options: {
          embedId: string
          onSuccess?: (result: MidtransSnapResult) => void
          onPending?: (result: MidtransSnapResult) => void
          onError?: (result: unknown) => void
          onClose?: () => void
        },
      ) => void
    }
  }
}

let scriptLoadingPromise: Promise<boolean> | null = null

/**
 * Muat script snap.js Midtrans ke DOM secara dinamis jika belum tersedia
 */
export async function loadMidtransSnap(clientKey: string, isProduction = false): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.snap) return true

  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise((resolve) => {
    const existing = document.getElementById('midtrans-snap-script')
    if (existing) {
      if (window.snap) return resolve(true)
      existing.remove()
    }

    const script = document.createElement('script')
    script.id = 'midtrans-snap-script'
    script.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'
    script.setAttribute('data-client-key', clientKey)
    script.async = true

    script.onload = () => {
      resolve(true)
    }
    script.onerror = () => {
      console.error('Gagal memuat SDK Midtrans Snap')
      resolve(false)
    }

    document.head.appendChild(script)
  })

  return scriptLoadingPromise
}

/**
 * Buat transaksi QRIS Dinamis langsung (Nominal otomatis sesuai total pesanan)
 */
export async function createMidtransQris(orderId: string, storeId?: string): Promise<{
  success: boolean
  qr_string?: string
  qr_url?: string
  snap_token?: string
  redirect_url?: string
  client_key?: string
  is_production?: boolean
  transaction_id?: string
  midtrans_order_id?: string
  gross_amount?: number
  expiry_time?: string
  is_fallback?: boolean
  notice?: string
  error?: string
}> {
  try {
    const res = await fetch('/api/midtrans?action=qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, storeId }),
    })
    return await res.json()
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Buat Snap token untuk suatu pesanan
 */
export async function createMidtransSnapToken(orderId: string, storeId?: string): Promise<{
  success: boolean
  token?: string
  redirect_url?: string
  client_key?: string
  is_production?: boolean
  error?: string
}> {
  try {
    const res = await fetch('/api/midtrans?action=token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, storeId }),
    })
    const data = await res.json()
    return data
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Uji kredensial server key Midtrans
 */
export async function testMidtransCredentials(serverKey: string, isProduction: boolean): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const res = await fetch('/api/midtrans?action=test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverKey, isProduction }),
    })
    const data = await res.json()
    return data
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Cek status pembayaran transaksi ke backend
 */
export async function checkMidtransStatus(orderId: string, storeId?: string): Promise<{
  success: boolean
  paid?: boolean
  transaction_status?: string
  error?: string
}> {
  try {
    const res = await fetch('/api/midtrans?action=check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, storeId }),
    })
    return await res.json()
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Buka popup pembayaran Snap
 */
export async function openMidtransSnapPay(
  token: string,
  clientKey: string,
  isProduction: boolean,
  callbacks: {
    onSuccess?: (result: MidtransSnapResult) => void
    onPending?: (result: MidtransSnapResult) => void
    onError?: (result: MidtransSnapResult) => void
    onClose?: () => void
  },
): Promise<void> {
  const ready = await loadMidtransSnap(clientKey, isProduction)
  if (!ready || !window.snap) {
    throw new Error('Gagal memuat antarmuka pembayaran Midtrans')
  }

  window.snap.pay(token, callbacks)
}
