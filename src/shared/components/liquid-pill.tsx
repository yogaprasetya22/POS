import { m } from 'motion/react'
import { cn } from 'cn'
import { liquid } from '@shared/lib/motion'

/** Latar pilihan yang meluncur dari satu item ke item lain di grup yang sama (id sama = satu grup). Taruh di dalam item `relative`. */
export function LiquidPill({ id, className }: { id: string; className?: string }) {
  return <m.span aria-hidden layoutId={id} transition={liquid} className={cn('absolute inset-0 rounded-full bg-foreground', className)} />
}
