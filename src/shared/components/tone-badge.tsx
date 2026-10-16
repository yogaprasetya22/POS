import type { ComponentProps } from 'react'
import { Badge } from '@shared/components/ui/badge'
import { cn } from '@shared/lib/utils'

const TONES = {
  amber: 'bg-amber-500 text-white',
  green: 'bg-green-500 text-white',
  blue: 'bg-primary text-primary-foreground',
  gray: '',
}

/** Badge status berwarna (menunggu / dimasak / siap / aktif). */
export function ToneBadge({ tone = 'gray', className, ...props }: ComponentProps<typeof Badge> & { tone?: keyof typeof TONES }) {
  return <Badge variant="secondary" className={cn(TONES[tone], className)} {...props} />
}
