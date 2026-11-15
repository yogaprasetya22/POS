import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { MCard, appear } from '@shared/components/motion'
import { ChartSkeleton, RowsSkeleton, StatTilesSkeleton } from '@shared/components/skeletons'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { z } from 'zod'
import { Chip, PageHeader, SectionCard, type Tone } from '@shared/components/page'
import { EmptyState } from '@shared/components/pagination'
import { Badge } from '@shared/components/ui/badge'
import { buttonVariants } from '@shared/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@shared/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@shared/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Switch } from '@shared/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { supabase } from '@shared/lib/supabase'
import { rupiah, todayJakarta } from '@shared/lib/utils'
import { OrderSchema, PAYMENT_LABEL, isSellable, type Order, type Product } from '@shared/types/contracts'
import { addDays, clock, compact, dayLabel, fetchReport, type Report } from './report-page'

type Range = '7d' | '30d' | '90d'
const RANGES: { value: Range; label: string; days: number }[] = [
  { value: '7d', label: '7 hari', days: 7 },
  { value: '30d', label: '30 hari', days: 30 },
  { value: '90d', label: '90 hari', days: 90 },
]
const chartConfig = { net: { label: 'Penjualan', color: 'var(--chart-1)' } } satisfies ChartConfig

const IngredientSchema = z.object({ id: z.uuid(), name: z.string(), unit: z.string(), stock: z.coerce.number(), min_stock: z.coerce.number(), is_active: z.boolean() })

const STATUS: Record<string, { label: string; tone: Tone }> = {
  IN_KITCHEN: { label: 'Sudah dibayar', tone: 'info' },
  READY: { label: 'Siap', tone: 'info' },
  COMPLETED: { label: 'Selesai', tone: 'good' },
}

function Trend({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <Badge variant="outline" className={up ? '' : 'text-destructive'}>
      <Icon /> {up ? '+' : '−'}{Math.abs(pct) > 999 ? '>999' : Math.abs(pct)}%
    </Badge>
  )
}

function StatCard({ label, value, badge, title, hint, index = 0 }: { label: string; value: string; badge?: React.ReactNode; title: string; hint: string; index?: number }) {
  return (
    <MCard {...appear(index)} className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        {badge && <CardAction>{badge}</CardAction>}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{hint}</div>
      </CardFooter>
    </MCard>
  )
}

/** Ikhtisar: kartu ringkasan, grafik penjualan, transaksi terbaru, dan hal yang perlu perhatian. Susunan mengikuti shadcn dashboard-01. */
export function Dashboard({ products, run }: { products: Product[]; run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void> }) {
  const today = todayJakarta()
  const [now, setNow] = useState<Report | null>(null)
  const [before, setBefore] = useState<Report | null>(null)
  const [range, setRange] = useState<Range>('30d')
  const [chart, setChart] = useState<Report | null>(null)
  const [recent, setRecent] = useState<Order[]>([])
  const [low, setLow] = useState<z.infer<typeof IngredientSchema>[]>([])
  const [recentLoaded, setRecentLoaded] = useState(false)
  const [lowLoaded, setLowLoaded] = useState(false)

  useEffect(() => {
    void Promise.all([fetchReport(today, today), fetchReport(addDays(today, -1), addDays(today, -1))]).then(([a, b]) => {
      setNow(a)
      setBefore(b)
    })
    void supabase.from('orders').select('*').not('paid_at', 'is', null).in('status', ['IN_KITCHEN', 'READY', 'COMPLETED']).order('paid_at', { ascending: false }).limit(8).then(({ data }) => {
      const p = z.array(OrderSchema).safeParse(data ?? [])
      if (p.success) setRecent(p.data)
      setRecentLoaded(true)
    })
    void supabase.from('ingredients').select('id,name,unit,stock,min_stock,is_active').then(({ data }) => {
      const p = z.array(IngredientSchema).safeParse(data ?? [])
      if (p.success) setLow(p.data.filter((i) => i.is_active && i.stock <= i.min_stock))
      setLowLoaded(true)
    })
  }, [today])

  const days = RANGES.find((r) => r.value === range)!.days
  useEffect(() => {
    void fetchReport(addDays(today, -(days - 1)), today).then(setChart)
  }, [today, days])

  const series = useMemo(() => {
    if (!chart) return []
    const byDay = new Map(chart.daily.map((d) => [d.day, d.net]))
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(today, -(days - 1 - i))
      return { date, net: byDay.get(date) ?? 0 }
    })
  }, [chart, days, today])
  const rangeTotal = series.reduce((a, p) => a + p.net, 0)

  const net = now?.totals.net ?? 0
  const orders = now?.totals.orders ?? 0
  const aov = orders ? Math.round(net / orders) : 0
  const prevNet = before?.totals.net ?? 0
  const prevAov = before && before.totals.orders ? Math.round(before.totals.net / before.totals.orders) : 0
  const soldOut = products.filter((p) => !isSellable(p))

  return (
    <div className="space-y-6">
      <PageHeader title="Hari Ini" description={`${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · uang masuk dan hal yang perlu dicek.`} />

      {!now || !before ? (
        <StatTilesSkeleton count={4} className="grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" />
      ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Uang masuk hari ini" value={rupiah(net)} badge={<Trend cur={net} prev={prevNet} />} title={`dari ${orders} penjualan`} hint={before ? `Kemarin ${rupiah(prevNet)}` : 'Memuat…'} />
        <StatCard index={1} label="Rata-rata belanja per pembeli" value={rupiah(aov)} badge={<Trend cur={aov} prev={prevAov} />} title="Rata-rata uang per penjualan" hint={prevAov ? `Kemarin ${rupiah(prevAov)}` : 'Belum ada pembanding'} />
        <StatCard index={2} label="Menu yang bisa dijual" value={`${products.length - soldOut.length}/${products.length}`} title={soldOut.length ? `${soldOut.length} menu habis` : 'Semua menu tersedia'} hint={soldOut.length ? soldOut.slice(0, 2).map((p) => p.name).join(', ') + (soldOut.length > 2 ? '…' : '') : 'Tidak ada yang perlu dicek'} />
        <StatCard index={3} label="Bahan hampir habis" value={String(low.length)} badge={low.length > 0 ? <Badge variant="outline" className="text-destructive">Perlu belanja</Badge> : undefined} title={low.length ? 'Segera belanja bahan ini' : 'Bahan masih cukup'} hint={low.length ? low.slice(0, 2).map((i) => i.name).join(', ') + (low.length > 2 ? '…' : '') : 'Tidak ada yang perlu dibeli'} />
      </div>
      )}

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Penjualan</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">Total {rupiah(rangeTotal)} dalam {RANGES.find((r) => r.value === range)!.label} terakhir</span>
            <span className="@[540px]/card:hidden">{RANGES.find((r) => r.value === range)!.label} terakhir</span>
          </CardDescription>
          <CardAction>
            <ToggleGroup multiple={false} value={[range]} onValueChange={(v) => v[0] && setRange(v[0] as Range)} variant="outline" className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex">
              {RANGES.map((r) => <ToggleGroupItem key={r.value} value={r.value}>{r.label}</ToggleGroupItem>)}
            </ToggleGroup>
            <Select value={range} onValueChange={(v) => v && setRange(v as Range)} items={RANGES.map((r) => ({ value: r.value, label: r.label }))}>
              <SelectTrigger className="flex w-32 @[767px]/card:hidden" size="sm" aria-label="Rentang grafik"><SelectValue /></SelectTrigger>
              <SelectContent>{RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {!chart ? (
            <ChartSkeleton />
          ) : rangeTotal === 0 ? (
            <EmptyState title="Belum ada penjualan" hint="Grafik muncul setelah ada penjualan pertama." />
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-net)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-net)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => dayLabel(String(v))} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => dayLabel(String(v))} formatter={(value) => <span className="font-mono font-medium tabular-nums">{rupiah(Number(value))}</span>} />}
                />
                <Area dataKey="net" type="monotone" fill="url(#fillNet)" stroke="var(--color-net)" />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Penjualan terakhir" hint="8 penjualan terakhir yang sudah dibayar" className="xl:col-span-2 [&>div]:p-0">
          {!recentLoaded ? (
            <RowsSkeleton rows={5} />
          ) : recent.length === 0 ? (
            <div className="p-4"><EmptyState title="Belum ada penjualan" hint="Penjualan yang sudah dibayar muncul di sini. Mulai dari tombol Jualan." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11 text-xs uppercase tracking-wide text-muted-foreground">Antrean</TableHead>
                  <TableHead className="h-11 text-xs uppercase tracking-wide text-muted-foreground">Pelanggan</TableHead>
                  <TableHead className="hidden h-11 text-xs uppercase tracking-wide text-muted-foreground md:table-cell">Metode</TableHead>
                  <TableHead className="h-11 text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="h-11 text-right text-xs uppercase tracking-wide text-muted-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((o) => {
                  const s = STATUS[o.status] ?? { label: o.status, tone: 'neutral' as Tone }
                  return (
                    <TableRow key={o.id} className="h-12">
                      <TableCell className="font-mono font-semibold">{o.queue_code}</TableCell>
                      <TableCell>
                        <span className="block max-w-48 truncate">{o.customer_name}</span>
                        <span className="text-xs text-muted-foreground">{dayLabel(o.business_day)} {o.paid_at && clock(o.paid_at)}</span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{o.payment_method ? PAYMENT_LABEL[o.payment_method] : '—'}</TableCell>
                      <TableCell><Chip tone={s.tone}>{s.label}</Chip></TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{rupiah(o.total)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <div className="border-t px-4 py-3">
            <Link to="/admin/laporan" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Lihat semua penjualan <ArrowUpRight /></Link>
          </div>
        </SectionCard>

        <SectionCard title="Perlu perhatian" hint={`${soldOut.length + low.length} item`}>
          {!lowLoaded ? (
            <RowsSkeleton rows={3} />
          ) : soldOut.length === 0 && low.length === 0 ? (
            <EmptyState title="Semua aman" hint="Tidak ada menu habis atau bahan yang hampir habis." />
          ) : (
            <ul className="space-y-4">
              {soldOut.length > 0 && (
                <li>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Menu habis</p>
                  <ul className="divide-y">
                    {soldOut.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="truncate">{p.name}</span>
                        <Switch checked={p.is_available} aria-label={`Aktifkan ${p.name}`} onCheckedChange={(v) => run(supabase.from('products').update({ is_available: v }).eq('id', p.id))} />
                      </li>
                    ))}
                  </ul>
                </li>
              )}
              {low.length > 0 && (
                <li>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bahan hampir habis</p>
                  <ul className="divide-y">
                    {low.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="truncate">{i.name}</span>
                        <span className="tabular-nums text-destructive">{compact(i.stock)} {i.unit}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}


