import { m } from 'motion/react'
import type { ComponentProps, ReactNode } from 'react'
import { Card } from '@shared/components/ui/card'
import { liquid, liquidSoft } from '@shared/lib/motion'

/** Kartu yang muncul membal (pegas) dengan jeda bertahap menurut urutan; `index` dibatasi supaya daftar panjang tetap cepat. */
export const MCard = m.create(Card)

export const appear = (index = 0) => ({
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { ...liquid, delay: Math.min(index, 10) * 0.03 },
})

/** Pembungkus: isi naik halus dengan pegas saat tampil. */
export function Appear({ children, index = 0, className, ...rest }: { children: ReactNode; index?: number; className?: string } & Omit<ComponentProps<typeof m.div>, 'children'>) {
  return (
    <m.div {...appear(index)} className={className} {...rest}>
      {children}
    </m.div>
  )
}

/** Baris tabel/daftar yang mengalir masuk. */
export const rowMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: liquidSoft,
}
