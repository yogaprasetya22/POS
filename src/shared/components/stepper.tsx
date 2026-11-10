import { Minus, Plus } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { Button } from '@shared/components/ui/button'

/** Tombol jumlah (− n +) responsif & ramah mobile */
export function Stepper({
  value,
  onChange,
  min = 1,
  size = 'default',
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  size?: 'sm' | 'default'
}) {
  const isSm = size === 'sm'

  return (
    <div
      className={`inline-flex items-center rounded-full bg-muted/80 border border-border/40 ${
        isSm ? 'gap-0.5 p-0.5' : 'gap-0.5 sm:gap-1 p-0.5'
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-6 sm:size-8 rounded-full hover:bg-background"
        aria-label="Kurangi"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-3.5" />
      </Button>
      <span
        className={`relative inline-flex justify-center overflow-hidden text-center font-black tabular-nums text-foreground select-none ${
          isSm ? 'w-4 text-xs' : 'w-6 sm:w-7 text-xs sm:text-sm'
        }`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={value}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {value}
          </m.span>
        </AnimatePresence>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-6 sm:size-8 rounded-full hover:bg-background"
        aria-label="Tambah"
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}
