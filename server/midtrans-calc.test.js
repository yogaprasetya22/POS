import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  amountMatches,
  calcAvailableBalance,
  calcQrisSettlement,
  isPaidStatus,
  midtransSignature,
  verifySignature,
} from './midtrans-calc.js'

const KEY = 'SB-Mid-server-TEST'
const GROSS = 20_000

/** Bentuk notifikasi QRIS sandbox Midtrans untuk transaksi Rp20.000. */
function qrisNotif(overrides = {}) {
  const base = {
    order_id: 'A001-1a2b3c4d-1732260000000',
    status_code: '200',
    gross_amount: '20000.00',
    transaction_status: 'settlement',
    payment_type: 'qris',
    transaction_id: 'tx-qris-20000',
    fraud_status: 'accept',
    ...overrides,
  }
  return { ...base, signature_key: midtransSignature(base.order_id, base.status_code, base.gross_amount, KEY) }
}

describe('Potongan QRIS Rp20.000 (POS harus = Midtrans)', () => {
  it('MDR 0,7% = Rp140, PPN 11% dari MDR = Rp15, masuk bersih Rp19.845', () => {
    expect(calcQrisSettlement(GROSS)).toEqual({ gross: 20000, fee: 140, tax: 15, net: 19845 })
  })

  it('total Midtrans di dashboard (Rp29.000) menghasilkan potongan yang konsisten', () => {
    const s = calcQrisSettlement(29_000)
    expect(s.fee).toBe(203)
    expect(s.tax).toBe(22)
    expect(s.gross - s.fee - s.tax).toBe(s.net)
  })

  it('tarif bisa diubah dari pengaturan toko', () => {
    expect(calcQrisSettlement(GROSS, 0.3, 0)).toEqual({ gross: 20000, fee: 60, tax: 0, net: 19940 })
  })
})

describe('Validasi status & nominal', () => {
  it('hanya settlement / capture+accept yang dianggap lunas', () => {
    expect(isPaidStatus('settlement')).toBe(true)
    expect(isPaidStatus('capture', 'accept')).toBe(true)
    expect(isPaidStatus('capture', 'challenge')).toBe(false)
    expect(isPaidStatus('pending')).toBe(false)
    expect(isPaidStatus('expire')).toBe(false)
  })

  it('nominal "20000.00" dari Midtrans cocok dengan total POS 20000', () => {
    expect(amountMatches('20000.00', 20000)).toBe(true)
    expect(amountMatches('20001.00', 20000)).toBe(false)
    expect(amountMatches(undefined, 20000)).toBe(false)
  })

  it('signature harus valid; tanpa server key selalu ditolak', () => {
    const n = qrisNotif()
    expect(verifySignature(n, [KEY])).toBe(true)
    expect(verifySignature(n, ['kunci-lain'])).toBe(false)
    expect(verifySignature(n, ['', undefined])).toBe(false)
    expect(verifySignature({ ...n, gross_amount: '200000.00' }, [KEY])).toBe(false)
  })
})

describe('Saldo siap tarik POS', () => {
  const paid = (o) => ({ status: 'COMPLETED', payment_method: 'MIDTRANS', midtrans_transaction_id: 'tx', midtrans_status: 'settlement', midtrans_fee: 0, midtrans_tax: 0, ...o })

  it('1 transaksi QRIS Rp20.000 lunas -> saldo Rp19.845', () => {
    expect(calcAvailableBalance([paid({ total: GROSS })]).available).toBe(19845)
  })

  it('simulasi lokal, pending, dan tunai TIDAK menambah saldo Midtrans', () => {
    const r = calcAvailableBalance([
      paid({ total: GROSS }),
      paid({ total: GROSS, midtrans_status: 'simulated' }),
      paid({ total: GROSS, midtrans_status: 'pending' }),
      paid({ total: GROSS, payment_method: 'CASH' }),
      { ...paid({ total: GROSS }), status: 'UNPAID' },
    ])
    expect(r.gross).toBe(20000)
    expect(r.available).toBe(19845)
  })

  it('penarikan mengurangi saldo; yang gagal tidak', () => {
    const r = calcAvailableBalance(
      [paid({ total: GROSS })],
      [
        { channel: 'MIDTRANS', status: 'COMPLETED', amount: 10000 },
        { channel: 'MIDTRANS', status: 'FAILED', amount: 5000 },
      ],
    )
    expect(r.available).toBe(9845)
  })
})

/* ───────── Alur end-to-end handler webhook dengan Supabase tiruan ───────── */

const db = { orders: [], rpcCalls: [] }

vi.mock('./supabase.js', () => {
  const sb = {
    from: () => {
      const filters = []
      const q = {
        select: () => q,
        update: (patch) => {
          q._patch = patch
          return q
        },
        eq: (col, val) => {
          filters.push((o) => o[col] === val)
          return q
        },
        ilike: (col, pat) => {
          const pre = pat.replace('%', '')
          filters.push((o) => String(o[col]).startsWith(pre))
          return q
        },
        maybeSingle: async () => ({ data: db.orders.find((o) => filters.every((f) => f(o))) ?? null }),
        then: (resolve) => {
          db.orders.filter((o) => filters.every((f) => f(o))).forEach((o) => Object.assign(o, q._patch))
          resolve({ error: null })
        },
      }
      return q
    },
    rpc: async (name, args) => {
      db.rpcCalls.push({ name, args })
      if (name === 'pay_order_midtrans') {
        const o = db.orders.find((x) => x.id === args.p_order_id && x.status === 'UNPAID')
        if (o) {
          const s = calcQrisSettlement(o.total)
          Object.assign(o, {
            status: 'IN_KITCHEN',
            payment_method: 'MIDTRANS',
            midtrans_transaction_id: args.p_transaction_id,
            midtrans_status: args.p_status,
            midtrans_fee: s.fee,
            midtrans_tax: s.tax,
          })
        }
      }
      return { data: null, error: null }
    },
  }
  return {
    supabaseFor: () => sb,
    allow: (req, res, m) => req.method === m || (res.status(405).json({}), false),
  }
})

function mockRes() {
  const r = { code: 0, body: null }
  r.status = (c) => ((r.code = c), r)
  r.json = (b) => ((r.body = b), r)
  r.setHeader = () => r
  r.end = () => r
  return r
}

describe('Webhook Midtrans -> POS (QRIS Rp20.000)', () => {
  let handler
  beforeEach(async () => {
    process.env.MIDTRANS_SERVER_KEY = KEY
    process.env.MIDTRANS_SANDBOX_SERVER_KEY = KEY
    db.orders = [{ id: '1a2b3c4d-0000-4000-8000-000000000001', store_id: null, total: GROSS, status: 'UNPAID', payment_method: null }]
    db.rpcCalls = []
    handler = (await import('../api/midtrans.js')).default
  })

  const send = async (body) => {
    const res = mockRes()
    await handler({ method: 'POST', query: { action: 'webhook' }, body, headers: {} }, res)
    return res
  }

  it('settlement valid -> pesanan lunas dan saldo POS = Rp19.845', async () => {
    const res = await send(qrisNotif())
    expect(res.code).toBe(200)
    expect(db.orders[0].status).toBe('IN_KITCHEN')
    expect(calcAvailableBalance(db.orders).available).toBe(19845)
  })

  it('signature palsu ditolak 403, pesanan tetap belum lunas', async () => {
    const res = await send({ ...qrisNotif(), signature_key: 'palsu' })
    expect(res.code).toBe(403)
    expect(db.orders[0].status).toBe('UNPAID')
  })

  it('nominal Midtrans beda dari POS ditolak', async () => {
    const n = qrisNotif({ gross_amount: '15000.00' })
    n.signature_key = midtransSignature(n.order_id, n.status_code, n.gross_amount, KEY)
    const res = await send(n)
    expect(res.code).toBe(400)
    expect(db.orders[0].status).toBe('UNPAID')
  })

  it('QRIS kedaluwarsa -> pesanan dibatalkan, saldo tetap 0', async () => {
    const n = qrisNotif({ transaction_status: 'expire', status_code: '202' })
    n.signature_key = midtransSignature(n.order_id, n.status_code, n.gross_amount, KEY)
    await send(n)
    expect(db.orders[0].status).toBe('CANCELLED')
    expect(calcAvailableBalance(db.orders).available).toBe(0)
  })

  it('notifikasi ganda tidak menghitung dua kali', async () => {
    await send(qrisNotif())
    await send(qrisNotif())
    expect(db.rpcCalls.filter((c) => c.name === 'pay_order_midtrans')).toHaveLength(1)
    expect(calcAvailableBalance(db.orders).available).toBe(19845)
  })
})
