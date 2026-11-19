import { AnimatePresence, m } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
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

/**
 * Buka-tutup halus (ganti <details>). Tinggi dianimasikan sekali saat berubah; isi memudar + sedikit turun.
 * overflow-hidden hanya selama animasi supaya ring fokus di dalamnya tidak terpotong saat diam.
 */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: liquidSoft, opacity: { duration: 0.18, delay: 0.04 } } }}
          exit={{ height: 0, opacity: 0, transition: { height: { type: 'spring', stiffness: 400, damping: 40 }, opacity: { duration: 0.1 } } }}
          style={{ overflow: 'hidden' }}
          className={className}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** Teks yang berganti (label tombol, angka kecil): yang lama naik keluar, yang baru naik masuk. */
export function SwapText({ value, children, className }: { value: string | number; children?: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-grid overflow-hidden ${className ?? ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          initial={{ y: '60%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-60%', opacity: 0 }}
          transition={liquidSoft}
          className="col-start-1 row-start-1"
        >
          {children ?? value}
        </m.span>
      </AnimatePresence>
    </span>
  )
}

/** Muncul/hilang dengan sedikit membesar (tombol aksi kecil, lencana). */
export const pop = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.12 } },
  transition: liquid,
}

/**
 * Pengganti <details> yang membuka/menutup dengan halus. `summary` boleh fungsi yang menerima status buka,
 * untuk teks seperti "Tampilkan"/"Sembunyikan". Ikon panah berputar dengan pegas.
 */
export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  defaultOpen = false,
  chevron = true,
}: {
  summary: ReactNode | ((open: boolean) => ReactNode)
  children: ReactNode
  className?: string
  summaryClassName?: string
  defaultOpen?: boolean
  chevron?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex w-full items-center text-left ${summaryClassName ?? ''}`}>
        {typeof summary === 'function' ? summary(open) : summary}
        {chevron && (
          <m.span animate={{ rotate: open ? 180 : 0 }} transition={liquid} className="inline-flex shrink-0">
            <ChevronDown className="size-5" aria-hidden />
          </m.span>
        )}
      </button>
      <Collapse open={open}>{children}</Collapse>
    </div>
  )
}
