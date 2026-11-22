import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { rpc } from '@shared/lib/api'
import { QuoteSchema, type CartLine, type Quote } from '@shared/types/contracts'

type Args = {
  storeId: string | null
  lines: CartLine[]
  code?: string
  memberId?: string | null
  redeem?: number
  enabled?: boolean
}

/** Total pesanan dari database (promo, voucher, poin, service, pajak, pembulatan). Dihitung ulang tiap isi berubah (debounce 200 ms). */
export function useQuote({ storeId, lines, code = '', memberId = null, redeem = 0, enabled = true }: Args) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const key = JSON.stringify([storeId, lines, code, memberId, redeem])

  useEffect(() => {
    if (!enabled || !storeId || lines.length === 0) {
      setQuote(null)
      setError('')
      setLoading(false)
      return
    }
    const mine = ++seq.current
    setLoading(true)
    const t = setTimeout(async () => {
      const { data, error: err } = await rpc('quote_order', {
        p_store_id: storeId,
        p_lines: lines,
        p_promo_code: code || null,
        p_member_id: memberId,
        p_redeem_points: redeem,
      })
      if (mine !== seq.current) return
      setLoading(false)
      if (err) {
        setQuote(null)
        return setError(err.message)
      }
      const parsed = QuoteSchema.safeParse(data)
      if (!parsed.success) return setError('Format total dari server tidak dikenali')
      setError('')
      setQuote(parsed.data)
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { quote, error, loading }
}

export const QuoteListSchema = z.array(QuoteSchema)
