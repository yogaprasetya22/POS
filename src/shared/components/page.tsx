import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { appear } from '@shared/components/motion'
import { LiquidPill } from '@shared/components/liquid-pill'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { cn } from '@shared/lib/utils'

/** Kepala halaman standar: judul, penjelasan satu kalimat, dan aksi utama di kanan. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <m.div {...appear(0)} className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </m.div>
  )
}

const TONE = {
  neutral: 'bg-muted text-foreground',
  good: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  bad: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  info: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200',
} as const
export type Tone = keyof typeof TONE

/** Label status lembut (tidak berteriak): hijau = baik, merah = perlu perhatian. */
export function Chip({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', TONE[tone], className)}>{children}</span>
}

/** Ubin angka ringkas di atas daftar. */
export function StatTile({ label, value, hint, tone, index = 0 }: { label: string; value: string; hint?: ReactNode; tone?: 'bad' | 'good'; index?: number }) {
  return (
    <m.div {...appear(index)} className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums tracking-tight', tone === 'bad' && 'text-destructive', tone === 'good' && 'text-emerald-700 dark:text-emerald-400')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </m.div>
  )
}

/** Filter pilihan tunggal berbentuk pil; pilihan aktif meluncur antar pil. `id` harus unik per grup di satu halaman. */
export function FilterChips<T extends string>({ id, value, onChange, options, label }: { id: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none">
      <ToggleGroup aria-label={label} className="w-max gap-1.5" value={[value]} onValueChange={(v) => v[0] !== undefined && onChange(v[0] as T)}>
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className="relative h-10 rounded-full border bg-card px-4 text-sm aria-pressed:border-foreground aria-pressed:bg-transparent aria-pressed:text-background">
            {value === o.value && <LiquidPill id={id} />}
            <span className="relative">{o.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** Bungkus tabel/daftar: kartu tipis dengan batas, tanpa judul ganda. */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return <m.div {...appear(1)} className={cn('overflow-hidden rounded-xl border bg-card', className)}>{children}</m.div>
}

/** Bagian berjudul di dalam halaman (kartu dengan garis di bawah judul). */
export function SectionCard({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <m.section {...appear(1)} className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </header>
      <div className="p-4">{children}</div>
    </m.section>
  )
}
