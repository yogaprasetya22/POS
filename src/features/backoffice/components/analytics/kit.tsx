import { Disclosure, SwapText } from '@shared/components/motion'
import { CalendarDays, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { MCard, appear } from '@shared/components/motion'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { cn } from '@shared/lib/utils'
import { todayJakarta } from '@shared/lib/utils'

/*
 * Bagian bersama halaman Hari Ini, Laporan, dan Catatan laci kasir: kartu angka, perbandingan,
 * pemilih rentang tanggal, dan kartu grafik. Susunan mengikuti shadcn dashboard-01 & charts.
 */

// ---------- tanggal ----------
export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1
export const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' })
export const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const rangeText = (from: string, to: string) => (from === to ? longDay(from) : `${dayLabel(from)} – ${dayLabel(to)} ${to.slice(0, 4)}`)
/** Daftar tanggal dari `from` sampai `to` (inklusif). */
export const eachDay = (from: string, to: string) => Array.from({ length: daysBetween(from, to) }, (_, i) => addDays(from, i))

export type Preset = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom'
export const PRESET_LABEL: Record<Preset, string> = { today: 'Hari ini', '7d': '7 hari', '30d': '30 hari', '90d': '90 hari', month: 'Bulan ini', custom: 'Pilih tanggal' }

export function rangeOf(p: Exclude<Preset, 'custom'>): [string, string] {
  const t = todayJakarta()
  const back = { today: 0, '7d': 6, '30d': 29, '90d': 89 } as const
  return p === 'month' ? [t.slice(0, 8) + '01', t] : [addDays(t, -back[p]), t]
}
/** Periode pembanding dengan panjang yang sama, tepat sebelum `from`. */
export function previousRange(from: string, to: string): [string, string] {
  const prevTo = addDays(from, -1)
  return [addDays(prevTo, -(daysBetween(from, to) - 1)), prevTo]
}

/** Pemilih rentang: tombol berderet di layar lebar, daftar pilihan di HP; "Pilih tanggal" membuka dua kotak tanggal. */
export function RangePicker({ value, presets, from, to, onChange, label = 'Rentang tanggal' }: {
  value: Preset
  presets: Preset[]
  from: string
  to: string
  onChange: (p: Preset, range: [string, string]) => void
  label?: string
}) {
  const pick = (p: Preset) => onChange(p, p === 'custom' ? [from, to] : rangeOf(p))
  const today = todayJakarta()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup aria-label={label} variant="outline" className="hidden md:flex" value={[value]} onValueChange={(v) => v[0] && pick(v[0] as Preset)}>
        {presets.map((p) => (
          <ToggleGroupItem key={p} value={p} className="h-11 px-4 text-base aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground">{PRESET_LABEL[p]}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Select value={value} onValueChange={(v) => v && pick(v as Preset)} items={presets.map((p) => ({ value: p, label: PRESET_LABEL[p] }))}>
        <SelectTrigger aria-label={label} className="h-11 w-44 text-base md:hidden"><CalendarDays className="size-4" aria-hidden /><SelectValue /></SelectTrigger>
        <SelectContent>{presets.map((p) => <SelectItem key={p} value={p}>{PRESET_LABEL[p]}</SelectItem>)}</SelectContent>
      </Select>
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="Dari tanggal" value={from} max={to} onChange={(e) => e.target.value && onChange('custom', [e.target.value, to])} className="h-11 w-40 text-base" />
          <span className="text-muted-foreground">sampai</span>
          <Input type="date" aria-label="Sampai tanggal" value={to} min={from} max={today} onChange={(e) => e.target.value && onChange('custom', [from, e.target.value])} className="h-11 w-40 text-base" />
        </div>
      )}
    </div>
  )
}

// ---------- angka ----------
/** Persen perubahan; null bila tidak ada pembanding (periode lalu 0). */
export const changePct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)

/** Lencana naik/turun. `goodWhenUp=false` untuk angka yang sebaiknya turun (mis. void, selisih kurang). */
export function Trend({ cur, prev, goodWhenUp = true }: { cur: number; prev: number; goodWhenUp?: boolean }) {
  const pct = changePct(cur, prev)
  if (pct === null) return null
  const up = pct >= 0
  const good = up === goodWhenUp
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-semibold tabular-nums', good ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
      <Icon className="size-4" aria-hidden /> {up ? '+' : '−'}{Math.abs(pct) > 999 ? '>999' : Math.abs(pct)}%
    </span>
  )
}

/** Kartu angka utama: label, nilai besar, lencana perbandingan, dan dua baris penjelasan. Bisa diketuk bila `onClick` diisi. */
export function KpiCard({ label, value, badge, title, hint, tone, index = 0, onClick }: {
  label: string
  value: string
  badge?: ReactNode
  title?: ReactNode
  hint?: ReactNode
  tone?: 'bad' | 'good'
  index?: number
  onClick?: () => void
}) {
  const body = (
    <>
      {/* label satu baris (min-h tetap) supaya angka besar di semua kartu sejajar */}
      <div className="flex min-h-7 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-base font-medium text-muted-foreground" title={label}>{label}</p>
        <span className="shrink-0">{badge}</span>
      </div>
      <p className={cn('mt-1 whitespace-nowrap font-extrabold leading-tight tabular-nums tracking-tight', 'text-[clamp(1.2rem,13cqw,1.85rem)]', tone === 'bad' && 'text-destructive', tone === 'good' && 'text-emerald-700 dark:text-emerald-400')}>{value}</p>
      {(title || hint) && (
        <div className="mt-auto space-y-0.5 border-t pt-3 text-base">
          {title && <p className="line-clamp-2 font-semibold">{title}</p>}
          {hint && <p className="line-clamp-2 text-muted-foreground">{hint}</p>}
        </div>
      )}
    </>
  )
  // kartu polos dengan tinggi sama: label + lencana, angka besar, garis tipis, dua baris keterangan
  const cls = '@container flex h-full min-w-0 flex-col gap-2 rounded-2xl border bg-card p-5 shadow-xs'
  return onClick ? (
    <MCard {...appear(index)} className={cn(cls, 'cursor-pointer gap-2 py-5 transition-colors hover:border-primary')} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}>
      {body}
    </MCard>
  ) : (
    <MCard {...appear(index)} className={cn(cls, 'gap-2 py-5')}>{body}</MCard>
  )
}

/** HP: 1 kolom · tablet tegak: 2×2 · tablet mendatar & desktop: 4 sejajar. Tidak pernah 3+1. */
export const KpiGrid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>

/** Kartu bagian (grafik, daftar) dengan judul, keterangan, dan tombol tambahan di kanan atas. */
export function Panel({ title, description, action, children, className, flush }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card className={cn('@container/card gap-0 overflow-hidden py-0', className)}>
      <CardHeader className="border-b py-4">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        {description && <CardDescription className="text-base">{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={flush ? 'p-0' : 'py-4'}>{children}</CardContent>
    </Card>
  )
}

/** Penjelasan arti tiap status, bisa dibuka-tutup. Dipasang di atas daftar yang memakai label status. */
export function StatusLegend({ items, title = 'Arti setiap status' }: { items: { label: string; tone: string; text: string }[]; title?: string }) {
  return (
    <Disclosure
      className="rounded-2xl border bg-card"
      summaryClassName="min-h-12 gap-2 px-4 text-base font-semibold"
      chevron={false}
      summary={(open) => (
        <>
          <span className="grid size-6 place-items-center rounded-full bg-muted text-sm" aria-hidden>?</span> {title}
          <SwapText value={open ? 'Sembunyikan' : 'Tampilkan'} className="ml-auto text-sm font-normal text-muted-foreground" />
        </>
      )}
    >
      <dl className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.label} className="flex items-start gap-3">
            <dt className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold', i.tone)}>{i.label}</dt>
            <dd className="text-base text-muted-foreground">{i.text}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  )
}

/** Warna lencana yang sama dengan Chip (page.tsx). */
export const TONE = {
  good: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  info: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  bad: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200',
  neutral: 'bg-muted text-foreground',
} as const

// ---------- unduh ----------
const csvCell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
/** Unduh tabel sebagai CSV (dibuka di Excel; BOM supaya huruf terbaca benar). */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
