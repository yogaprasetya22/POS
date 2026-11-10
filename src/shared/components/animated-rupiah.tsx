import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { rupiah } from '@shared/lib/utils'

/** Nominal yang berubah mengalir ke angka baru. Memperbarui teks langsung (tanpa render ulang React per frame). */
export function AnimatedRupiah({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (reduce || from === value) {
      if (ref.current) ref.current.textContent = rupiah(value)
      return
    }
    const controls = animate(from, value, {
      type: 'spring',
      stiffness: 180,
      damping: 24,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = rupiah(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return <span ref={ref}>{rupiah(value)}</span>
}
