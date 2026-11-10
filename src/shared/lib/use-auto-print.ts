import { useCallback, useEffect, useRef, useState } from 'react'
import type { Order } from '@shared/types/contracts'
import { escposKitchenTicket, hasPairedPrinter, pairPrinter, sendToPrinter } from './print'

const ON_KEY = 'pos_autoprint'
const SEEN_KEY = 'pos_autoprint_seen'
const SEEN_MAX = 300

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

/**
 * Cetak tiket dapur otomatis untuk pesanan yang baru masuk.
 * - Pesanan yang sudah ada saat halaman dibuka tidak dicetak ulang.
 * - Id yang sudah tercetak disimpan di perangkat ini, jadi refresh tidak mencetak dua kali.
 * - Antrean berurutan: satu tiket selesai dulu sebelum tiket berikutnya.
 */
export function useAutoPrint(orders: Order[], ready: boolean) {
  const [enabled, setEnabledState] = useState(() => read(ON_KEY) === '1')
  const [paired, setPaired] = useState(false)
  const [error, setError] = useState('')
  const [printed, setPrinted] = useState(0)
  const seen = useRef<Set<string> | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    hasPairedPrinter().then(setPaired, () => setPaired(false))
  }, [])

  const print = useCallback((o: Order) => {
    chain.current = chain.current.then(async () => {
      const res = await sendToPrinter(escposKitchenTicket(o), { auto: true })
      if (res.ok) {
        setError('')
        setPrinted((n) => n + 1)
      } else setError(res.error)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!seen.current) {
      // pertama kali: tandai yang sudah ada sebagai "sudah diketahui"
      let stored: string[] = []
      try {
        stored = JSON.parse(read(SEEN_KEY) ?? '[]')
      } catch {
        /* abaikan data rusak */
      }
      seen.current = new Set([...stored, ...orders.map((o) => o.id)])
      write(SEEN_KEY, JSON.stringify([...seen.current].slice(-SEEN_MAX)))
      return
    }
    const fresh = orders.filter((o) => !seen.current!.has(o.id))
    if (!fresh.length) return
    fresh.forEach((o) => seen.current!.add(o.id))
    write(SEEN_KEY, JSON.stringify([...seen.current].slice(-SEEN_MAX)))
    if (enabled) fresh.forEach(print)
  }, [orders, ready, enabled, print])

  const setEnabled = (v: boolean) => {
    setEnabledState(v)
    write(ON_KEY, v ? '1' : '0')
  }

  const pair = async () => {
    const r = await pairPrinter()
    if (r.ok) {
      setPaired(true)
      setError('')
    } else setError(r.error)
  }

  return { enabled, setEnabled, paired, pair, error, printed, print }
}
