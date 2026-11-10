import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { liquidSoft } from '@shared/lib/motion'

/** Muncul naik halus saat masuk layar (sekali saja). */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ ...liquidSoft, delay }}
      className={className}
    >
      {children}
    </m.div>
  )
}
