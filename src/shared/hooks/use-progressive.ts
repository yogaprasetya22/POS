import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Render bertahap untuk grid yang harus tampil menyatu (menu kasir & pelanggan): awalnya `step` item,
 * lalu bertambah otomatis saat sentinel di dasar daftar terlihat. Daftar ratusan item tidak membebani render pertama.
 */
export function useProgressive<T>(items: T[], { step = 24, resetKey = '' }: { step?: number; resetKey?: string } = {}) {
  const [count, setCount] = useState(step)
  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => setCount(step), [resetKey, step])

  const sentinel = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect()
      if (!node || typeof IntersectionObserver === 'undefined') return
      observer.current = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setCount((c) => c + step), { rootMargin: '400px' })
      observer.current.observe(node)
    },
    [step],
  )

  return { rows: items.slice(0, count), hasMore: count < items.length, sentinel, total: items.length, shown: Math.min(count, items.length) }
}
