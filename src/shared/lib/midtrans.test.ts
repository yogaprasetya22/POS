import { describe, expect, it, vi } from 'vitest'
import { createMidtransSnapToken, testMidtransCredentials, checkMidtransStatus } from './midtrans'

describe('midtrans payment gateway client', () => {
  it('handles test connection to midtrans endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, message: 'Koneksi ke Midtrans berhasil! Server Key valid.' }),
    })
    global.fetch = fetchMock

    const res = await testMidtransCredentials('SB-Mid-server-test', false)
    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/midtrans?action=test', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ serverKey: 'SB-Mid-server-test', isProduction: false }),
    }))
  })

  it('handles create snap token API call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, token: 'mock-snap-token-123', redirect_url: 'https://app.sandbox.midtrans.com/snap/v4/...' }),
    })
    global.fetch = fetchMock

    const res = await createMidtransSnapToken('order-uuid-1', 'store-uuid-1')
    expect(res.success).toBe(true)
    expect(res.token).toBe('mock-snap-token-123')
  })

  it('handles check status API call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, paid: true, transaction_status: 'settlement' }),
    })
    global.fetch = fetchMock

    const res = await checkMidtransStatus('order-uuid-1', 'store-uuid-1')
    expect(res.success).toBe(true)
    expect(res.paid).toBe(true)
  })
})

