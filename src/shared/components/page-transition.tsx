import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { liquidSoft } from '@shared/lib/motion'

/** Bungkus halaman; beri `key` berbeda per halaman supaya transisi masuk berjalan saat pindah. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <m.div initial={{ opacity: 0, y: 14, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={liquidSoft}>
      {children}
    </m.div>
  )
}
