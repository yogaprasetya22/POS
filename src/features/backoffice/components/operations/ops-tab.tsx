import { AlertTriangle, CheckCircle2, Clock, Download, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { Chip, FilterChips, ListCard, type Tone } from '@shared/components/page'
import { EmptyState, Pagination } from '@shared/components/pagination'
import { ChartSkeleton, RowsSkeleton, StatTilesSkeleton } from '@shared/components/skeletons'
import { Avatar, AvatarFallback } from '@shared/components/ui/avatar'
import { Button } from '@shared/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { useStaff } from '@shared/lib/auth'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'
import { usePaged } from '@shared/lib/use-paged'
import { rupiah } from '@shared/lib/utils'
import { ShiftStatsSchema, can, type ShiftStats } from '@shared/types/contracts'
import { ShiftDetailDrawer } from './shift-detail'
import { KpiCard, KpiGrid, Panel, RangePicker, StatusLegend, TONE, addDays, downloadCsv, eachDay, rangeOf, rangeText, type Preset } from '../analytics/kit'
import { CashDiffChart } from '../analytics/lazy'

const ShiftRowSchema = z.object({
  id: z.uuid(),
  opened_by: z.string(),
  opened_at: z.string(),
  opening_cash: z.number(),
  opening_expected: z.number().nullable(),
  closed_at: z.string().nullable(),
  counted_cash: z.number().nullable(),
  expected_cash: z.number().nullable(),
  difference: z.number().nullable(),
  note: z.string(),
  forced: z.boolean(),
  reviewed_at: z.string().nullable(),
  shift_name: z.string().default(''),
})
type ShiftRow = z.infer<typeof ShiftRowSchema>
const AuditSchema = z.object({ id: z.number(), user_id: z.string().nullable(), action: z.string(), detail: z.record(z.string(), z.unknown()), created_at: z.string() })
type AuditRow = z.infer<typeof AuditSchema>
const ProfileSchema = z.object({ user_id: z.string(), display_name: z.string().nullable().optional(), email: z.string().nullable() })

const ACTION: Record<string, { label: string; tone: Tone }> = {
  'order.pay': { label: 'Pembayaran', tone: 'good' },
  'order.void': { label: 'Dibatalkan', tone: 'bad' },
  'order.refund': { label: 'Uang kembali', tone: 'bad' },
  'order.cancel': { label: 'Batal pesanan', tone: 'warn' },
  'order.split': { label: 'Pisah bill', tone: 'info' },
  'order.merge': { label: 'Gabung bill', tone: 'info' },
  'shift.open': { label: 'Buka shift', tone: 'neutral' },
  'shift.close': { label: 'Tutup shift', tone: 'neutral' },
  'shift.force_close': { label: 'Tutup paksa', tone: 'warn' },
  'shift.review': { label: 'Tinjau selisih', tone: 'good' },
  'cash.in': { label: 'Kas masuk', tone: 'neutral' },
  'cash.out': { label: 'Kas keluar', tone: 'neutral' },
  'pin.set': { label: 'Ubah PIN', tone: 'warn' },
  'points.adjust': { label: 'Atur poin', tone: 'warn' },
  'voucher.create': { label: 'Buat voucher', tone: 'neutral' },
  'store.settings': { label: 'Ubah pengaturan', tone: 'warn' },
  'store.register': { label: 'Toko dibuat', tone: 'neutral' },
  'store.plan': { label: 'Ubah paket', tone: 'neutral' },
  'staff.add': { label: 'Tambah staf', tone: 'neutral' },
  'staff.role': { label: 'Ubah peran', tone: 'warn' },
}

const AUDIT_GROUPS = {
  all: null,
  order: ['order.pay', 'order.split', 'order.merge', 'order.cancel'],
  reverse: ['order.void', 'order.refund'],
  shift: ['shift.open', 'shift.close', 'shift.force_close', 'shift.review', 'cash.in', 'cash.out'],
  settings: ['store.settings', 'pin.set', 'points.adjust', 'voucher.create'],
  team: ['staff.add', 'staff.role', 'store.register', 'store.plan'],
} as const
type AuditGroup = keyof typeof AUDIT_GROUPS

type ShiftFilter = 'all' | 'review' | 'diff' | 'open'
const tz = 'Asia/Jakarta'
const day = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { timeZone: tz, day: 'numeric', month: 'short' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
const duration = (a: string, b: string) => {
  const m = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000))
  return m < 1 ? '<1 mnt' : m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} j ${m % 60} mnt`
}
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${rupiah(Math.abs(n))}`

function detailText(d: Record<string, unknown>) {
  const x = d as Record<string, string | number | null>
  const parts: string[] = []
  if (x.queue) parts.push(String(x.queue))
  if (typeof x.total === 'number') parts.push(rupiah(x.total))
  if (typeof x.amount === 'number') parts.push(rupiah(x.amount))
  if (typeof x.difference === 'number' && x.difference !== 0) parts.push(`selisih ${signed(x.difference)}`)
  if (x.reason) parts.push(`“${x.reason}”`)
  if (x.email) parts.push(String(x.email))
  if (x.role) parts.push(String(x.role))
  return parts.join(' · ')
}

function Diff({ s }: { s: ShiftRow }) {
  if (!s.closed_at) {
    return (
      <Chip tone="info">
        <span className="size-1.5 animate-pulse rounded-full bg-sky-600" aria-hidden /> Berjalan
      </Chip>
    )
  }
  const d = s.difference ?? 0
  if (d === 0) return <Chip tone="good">Pas</Chip>
  return <Chip tone={d < 0 ? 'bad' : 'warn'} className="tabular-nums">{d < 0 ? 'Kurang' : 'Lebih'} {rupiah(Math.abs(d))}</Chip>
}

function Review({ s }: { s: ShiftRow }) {
  if (!s.closed_at || (s.difference ?? 0) === 0) return <span className="text-muted-foreground">—</span>
  return s.reviewed_at ? <Chip tone="good">Ditinjau</Chip> : <Chip tone="warn">Perlu ditinjau</Chip>
}

function Person({ email }: { email: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{(email[0] ?? '?').toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium">{email || '—'}</span>
    </span>
  )
}

const TH = 'h-11 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground'

/** Shift & audit: selisih kas per periode, riwayat shift dengan rincian, selisih per kasir, dan log audit. */
export function OpsTab() {
  const { role } = useStaff()
  const [who, setWho] = useState<Map<string, string>>(new Map())
  const [tab, setTab] = useState('shift')
  const [period, setPeriod] = useState<Preset>('30d')
  const [[from, to], setRange] = useState<[string, string]>(rangeOf('30d'))
  const [daily, setDaily] = useState<{ date: string; short: number; over: number }[] | null>(null)
  const [exporting, setExporting] = useState(false)
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all')
  const [auditGroup, setAuditGroup] = useState<AuditGroup>('all')
  const [stats, setStats] = useState<ShiftStats | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [openShifts, setOpenShifts] = useState<ShiftRow[] | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Shift yang sedang berjalan (tidak tergantung periode): ditampilkan paling atas
  const loadOpen = useCallback(async () => {
    const { data } = await supabase.from('shifts').select('*').is('closed_at', null).order('opened_at', { ascending: false }).limit(10)
    setOpenShifts(z.array(ShiftRowSchema).safeParse(data ?? []).data ?? [])
  }, [])
  useEffect(() => {
    void loadOpen()
  }, [loadOpen])

  const loadStats = useCallback(async () => {
    const { data } = await rpc('shift_stats', { p_from: from, p_to: to })
    const p = ShiftStatsSchema.safeParse(data)
    if (p.success) setStats(p.data)
  }, [from, to])

  const shifts = usePaged<ShiftRow>(
    async ({ from: a, to: b }) => {
      let q = supabase
        .from('shifts')
        .select('*', { count: 'exact' })
        .gte('opened_at', `${from}T00:00:00+07:00`)
        .lt('opened_at', `${addDays(to, 1)}T00:00:00+07:00`)
        .order('opened_at', { ascending: false })
        .range(a, b)
      if (shiftFilter === 'diff') q = q.neq('difference', 0)
      if (shiftFilter === 'review') q = q.neq('difference', 0).is('reviewed_at', null).not('closed_at', 'is', null)
      if (shiftFilter === 'open') q = q.is('closed_at', null)
      const r = await q
      return { ...r, data: z.array(ShiftRowSchema).safeParse(r.data ?? []).data ?? [] }
    },
    { pageSize: 10, deps: [shiftFilter, from, to] },
  )
  const logs = usePaged<AuditRow>(
    async ({ from: a, to: b }) => {
      let q = supabase.from('audit_log').select('id,user_id,action,detail,created_at', { count: 'exact' }).order('id', { ascending: false }).range(a, b)
      const actions = AUDIT_GROUPS[auditGroup]
      if (actions) q = q.in('action', [...actions])
      const r = await q
      return { ...r, data: z.array(AuditSchema).safeParse(r.data ?? []).data ?? [] }
    },
    { pageSize: 20, deps: [auditGroup] },
  )

  useEffect(() => {
    setStats(null)
    void loadStats()
  }, [loadStats])

  // selisih kas per hari untuk grafik (shift yang sudah ditutup di rentang ini)
  const loadDaily = useCallback(async () => {
    setDaily(null)
    const { data } = await supabase
      .from('shifts')
      .select('opened_at,difference')
      .not('closed_at', 'is', null)
      .gte('opened_at', `${from}T00:00:00+07:00`)
      .lt('opened_at', `${addDays(to, 1)}T00:00:00+07:00`)
      .limit(2000)
    const rows = z.array(z.object({ opened_at: z.string(), difference: z.number().nullable() })).safeParse(data ?? []).data ?? []
    const by = new Map(eachDay(from, to).map((d) => [d, { date: d, short: 0, over: 0 }]))
    for (const r of rows) {
      const d = new Date(r.opened_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      const x = by.get(d)
      if (!x || !r.difference) continue
      if (r.difference < 0) x.short += r.difference
      else x.over += r.difference
    }
    setDaily([...by.values()])
  }, [from, to])
  useEffect(() => {
    void loadDaily()
  }, [loadDaily])

  const exportShifts = async () => {
    setExporting(true)
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .gte('opened_at', `${from}T00:00:00+07:00`)
      .lt('opened_at', `${addDays(to, 1)}T00:00:00+07:00`)
      .order('opened_at')
      .limit(5000)
    setExporting(false)
    if (error) return toast.error('Catatan shift gagal diunduh', { description: 'Periksa internet, lalu coba lagi.' })
    const rows = z.array(ShiftRowSchema).safeParse(data ?? []).data ?? []
    downloadCsv(`shift-${from}_${to}.csv`, [
      ['Tanggal', 'Buka', 'Tutup', 'Shift', 'Kasir', 'Modal awal', 'Seharusnya', 'Dihitung', 'Selisih', 'Ditutup paksa', 'Ditinjau', 'Catatan'],
      ...rows.map((r) => [day(r.opened_at), clock(r.opened_at), r.closed_at ? clock(r.closed_at) : 'berjalan', r.shift_name, name(r.opened_by), r.opening_cash, r.expected_cash ?? '', r.counted_cash ?? '', r.difference ?? '', r.forced ? 'ya' : '', r.reviewed_at ? 'ya' : '', r.note]),
    ])
    toast.success(`${rows.length} shift diunduh`, { description: 'Buka file CSV-nya dengan Excel atau Google Sheets.' })
  }
  useEffect(() => {
    void supabase.from('profiles').select('user_id,email,display_name').then(({ data }) => {
      const pp = z.array(ProfileSchema).safeParse(data ?? [])
      if (pp.success) setWho(new Map(pp.data.map((x) => [x.user_id, x.display_name?.trim() || x.email || ''])))
    })
  }, [])

  const name = (id: string | null) => (id ? (who.get(id) ?? '—') : 'Pelanggan')
  const canReview = can.manage(role)
  const refreshAll = () => {
    shifts.reload()
    void loadOpen()
    void loadStats()
    void loadDaily()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Shift & laci kasir</h1>
          <p className="mt-1 text-lg text-muted-foreground">Siapa yang memegang laci, berapa uang yang seharusnya ada, dan apakah hasil hitungnya cocok.</p>
        </div>
        <Button variant="outline" className="h-11 border-2 text-base" disabled={exporting} onClick={() => void exportShifts()}>
          <Download /> {exporting ? 'Menyiapkan…' : 'Unduh catatan shift'}
        </Button>
      </div>

      {/* 1. Shift yang sedang berjalan */}
      <section className="rounded-3xl border-2 bg-card p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <span className="size-2.5 animate-pulse rounded-full bg-sky-500" aria-hidden /> Sedang berjalan sekarang
        </h2>
        {openShifts === null ? (
          <RowsSkeleton rows={1} />
        ) : openShifts.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Tidak ada shift yang terbuka. Laci kasir sedang tidak dipegang siapa pun.</p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {openShifts.map((o) => {
              const handoverDiff = o.opening_expected != null && o.opening_cash !== o.opening_expected ? o.opening_cash - o.opening_expected : 0
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => setDetailId(o.id)} className="flex w-full flex-wrap items-center gap-4 rounded-2xl border-2 border-sky-200 bg-sky-50/60 p-4 text-left transition-colors hover:bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10">
                    <Person email={name(o.opened_by)} />
                    <div className="flex flex-1 flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5"><Clock className="size-4 text-muted-foreground" /> Mulai {clock(o.opened_at)} · {duration(o.opened_at, new Date(now).toISOString())}</span>
                      <span className="flex items-center gap-1.5"><Wallet className="size-4 text-muted-foreground" /> Modal awal <strong>{rupiah(o.opening_cash)}</strong></span>
                      {o.shift_name && <span className="font-bold">Shift {o.shift_name}</span>}
                    </div>
                    <span className="text-sm font-semibold text-primary">Lihat rincian →</span>
                    {handoverDiff !== 0 && (
                      <p className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        <strong>Catatan:</strong> modal awal tidak sama dengan uang yang diserahkan shift sebelumnya ({rupiah(o.opening_expected ?? 0)}), beda {signed(handoverDiff)}. Tanyakan ke kasir sebelumnya.
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 2. Ringkasan "perlu perhatian" dalam kalimat biasa */}
      {stats && (() => {
        const issues: { text: string; action?: () => void; cta?: string }[] = []
        if (stats.unreviewed > 0) issues.push({ text: `${stats.unreviewed} shift punya selisih uang yang belum dicek manager.`, cta: 'Tinjau sekarang', action: () => { setTab('shift'); setShiftFilter('review') } })
        if (stats.handover_mismatch > 0) issues.push({ text: `${stats.handover_mismatch} kali modal awal shift tidak sama dengan uang yang diserahkan shift sebelumnya.` })
        if (stats.forced > 0) issues.push({ text: `${stats.forced} shift ditutup paksa (tanpa hitung uang oleh kasir).` })
        return issues.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <CheckCircle2 className="size-6 shrink-0" />
            <p><strong>Semua beres.</strong> Tidak ada selisih atau serah terima yang perlu dicek di periode ini.</p>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="flex items-center gap-2 font-extrabold"><AlertTriangle className="size-5 text-amber-600" /> Perlu perhatian</p>
            <ul className="space-y-1.5 pl-7">
              {issues.map((i) => (
                <li key={i.text} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="list-item list-disc">{i.text}</span>
                  {i.action && <Button size="sm" variant="outline" className="h-8 border-amber-400 bg-white/60" onClick={i.action}>{i.cta}</Button>}
                </li>
              ))}
            </ul>
          </div>
        )
      })()}

      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <h2 className="text-lg font-extrabold">Rekap periode <span className="font-semibold text-muted-foreground">· {rangeText(from, to)}</span></h2>
        <div className="ml-auto">
          <RangePicker value={period} presets={['today', '7d', '30d', 'month', 'custom']} from={from} to={to} label="Periode" onChange={(p, r) => { setPeriod(p); setRange(r) }} />
        </div>
      </div>

      {stats ? (
        <KpiGrid>
          <KpiCard
            index={0}
            label="Total selisih uang laci"
            value={stats.diff_total === 0 ? 'Rp0' : signed(stats.diff_total)}
            tone={stats.diff_total < 0 ? 'bad' : stats.diff_total === 0 ? 'good' : undefined}
            title={stats.with_diff === 0 ? 'Semua shift pas' : `Kurang ${rupiah(-stats.short_total)} · lebih ${rupiah(stats.over_total)}`}
            hint={`${stats.closed} shift ditutup`}
          />
          <KpiCard index={1} label="Shift yang tidak pas" value={`${stats.with_diff} dari ${stats.closed}`} tone={stats.with_diff > 0 ? 'bad' : undefined} title={stats.closed ? `${Math.round((stats.with_diff / stats.closed) * 100)}% shift tidak pas` : 'Belum ada shift ditutup'} hint="Ketuk “Rincian” di daftar untuk melihat sebabnya" />
          <KpiCard
            index={2}
            label="Belum dicek manager"
            value={String(stats.unreviewed)}
            tone={stats.unreviewed > 0 ? 'bad' : 'good'}
            title={stats.unreviewed ? 'Selisih belum dicek manager' : 'Semua selisih sudah ditinjau'}
            hint={stats.unreviewed ? 'Ketuk untuk melihat daftarnya' : 'Tidak ada yang perlu dicek'}
            onClick={stats.unreviewed ? () => { setTab('shift'); setShiftFilter('review') } : undefined}
          />
          <KpiCard
            index={3}
            label="Masalah serah terima"
            value={String(stats.handover_mismatch + stats.forced)}
            tone={undefined}
            title={`${stats.handover_mismatch} modal awal tidak sama`}
            hint={`${stats.forced} shift ditutup paksa`}
          />
        </KpiGrid>
      ) : (
        <StatTilesSkeleton count={4} className="grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" />
      )}

      {daily === null ? (
        <ChartSkeleton />
      ) : daily.every((d) => d.short === 0 && d.over === 0) ? (
        <p className="flex items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-emerald-600" /> Grafik selisih per hari tidak ditampilkan karena semua shift di periode ini pas.
        </p>
      ) : (
        <Panel title="Selisih uang per hari" description="Batang merah = uang kurang, hijau = uang lebih.">
          <CashDiffChart data={daily} />
        </Panel>
      )}

      <StatusLegend
        title="Arti setiap status & cara membaca selisih"
        items={[
          { label: 'Berjalan', tone: TONE.info, text: 'Laci sedang dipegang kasir. Selisih baru diketahui saat shift ditutup.' },
          { label: 'Pas', tone: TONE.good, text: 'Uang yang dihitung kasir sama persis dengan yang seharusnya ada.' },
          { label: 'Kurang', tone: TONE.bad, text: 'Uang di laci lebih sedikit dari seharusnya. Perlu dicari sebabnya.' },
          { label: 'Lebih', tone: TONE.warn, text: 'Uang di laci lebih banyak, mis. kembalian kurang diberikan.' },
          { label: 'Perlu ditinjau', tone: TONE.warn, text: 'Ada selisih yang belum dicek manager. Buka “Rincian” lalu tandai sudah ditinjau.' },
          { label: 'Ditinjau', tone: TONE.good, text: 'Manager sudah mengecek selisihnya.' },
          { label: 'Seharusnya', tone: TONE.neutral, text: 'Modal awal + penjualan tunai + kas masuk − kas keluar − refund tunai.' },
          { label: 'Serah terima', tone: TONE.neutral, text: 'Modal awal shift berikutnya harus sama dengan uang yang diserahkan shift sebelumnya.' },
        ]}
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b scrollbar-none">
          <TabsTrigger value="shift" className="h-12 flex-none px-4 text-base">Riwayat shift {!shifts.loading && <span className="ml-1.5 text-muted-foreground tabular-nums">{shifts.total}</span>}</TabsTrigger>
          <TabsTrigger value="cashier" className="h-12 flex-none px-4 text-base">Per kasir</TabsTrigger>
          <TabsTrigger value="audit" className="h-12 flex-none px-4 text-base">Catatan tindakan {!logs.loading && <span className="ml-1.5 text-muted-foreground tabular-nums">{logs.total}</span>}</TabsTrigger>
        </TabsList>

        <TabsContent value="shift" className="space-y-3">
          <FilterChips
            id="shift-filter"
            label="Filter shift"
            value={shiftFilter}
            onChange={setShiftFilter}
            options={[{ value: 'all', label: 'Semua' }, { value: 'review', label: 'Perlu ditinjau' }, { value: 'diff', label: 'Ada selisih' }, { value: 'open', label: 'Sedang berjalan' }]}
          />
          <ListCard>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Kasir</TableHead>
                  <TableHead className={TH}>Waktu</TableHead>
                  <TableHead className={`${TH} hidden text-right lg:table-cell`}>Seharusnya ada</TableHead>
                  <TableHead className={`${TH} hidden text-right lg:table-cell`}>Dihitung kasir</TableHead>
                  <TableHead className={`${TH} text-right`}>Selisih</TableHead>
                  <TableHead className={TH}>Tinjauan</TableHead>
                  <TableHead className={`${TH} text-right`}><span className="sr-only">Aksi</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.rows.map((s) => (
                  <TableRow key={s.id} className="h-16 cursor-pointer" onClick={() => setDetailId(s.id)}>
                    <TableCell>
                      <Person email={name(s.opened_by)} />
                      <p className="mt-0.5 flex flex-wrap gap-x-2 pl-[2.625rem] text-xs text-muted-foreground">
                        {s.shift_name && <span className="font-bold text-foreground">Shift {s.shift_name}</span>}
                        {s.forced && <span className="text-amber-700 dark:text-amber-400">ditutup paksa</span>}
                        {s.opening_expected != null && s.opening_cash !== s.opening_expected && <span className="text-amber-700 dark:text-amber-400" title="Modal awal shift ini tidak sama dengan uang yang diserahkan shift sebelumnya">modal awal tidak sama ({signed(s.opening_cash - s.opening_expected)})</span>}
                        {s.note && <span className="max-w-56 truncate" title={s.note}>“{s.note}”</span>}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{day(s.opened_at)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {clock(s.opened_at)} – {s.closed_at ? clock(s.closed_at) : 'sekarang'}
                        {s.closed_at && ` · ${duration(s.opened_at, s.closed_at)}`}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{s.closed_at ? rupiah(s.expected_cash ?? 0) : '—'}</TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{s.closed_at ? rupiah(s.counted_cash ?? 0) : '—'}</TableCell>
                    <TableCell className="text-right"><Diff s={s} /></TableCell>
                    <TableCell><Review s={s} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-9" onClick={(e) => { e.stopPropagation(); setDetailId(s.id) }}>Rincian</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {shifts.loading && shifts.rows.length === 0 && <RowsSkeleton rows={6} />}

            <ul className="divide-y md:hidden">
              {shifts.rows.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setDetailId(s.id)} className="w-full space-y-2 p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <Person email={name(s.opened_by)} />
                      {s.shift_name && <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold">Shift {s.shift_name}</span>}
                      <Diff s={s} />
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {day(s.opened_at)} · {clock(s.opened_at)} – {s.closed_at ? clock(s.closed_at) : 'sekarang'}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <Review s={s} />
                      <span className="font-medium text-primary">Lihat rincian</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {shifts.rows.length === 0 && !shifts.loading && (
              <div className="p-6">
                <EmptyState title={shiftFilter === 'all' ? 'Belum ada shift' : 'Tidak ada shift yang cocok'} hint={shiftFilter === 'all' ? 'Shift muncul setelah kasir membukanya di layar kasir.' : 'Coba ganti filter atau periode.'} />
              </div>
            )}
          </ListCard>
          <Pagination page={shifts.page} pageCount={shifts.pageCount} total={shifts.total} pageSize={shifts.pageSize} onPage={shifts.setPage} loading={shifts.loading} />
        </TabsContent>

        <TabsContent value="cashier" className="space-y-3">
          <ListCard>
            {!stats ? (
              <RowsSkeleton rows={4} />
            ) : stats.by_cashier.length === 0 ? (
              <div className="p-6"><EmptyState title="Belum ada data" hint="Belum ada shift di periode ini." /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={TH}>Kasir</TableHead>
                    <TableHead className={`${TH} text-right`}>Shift</TableHead>
                    <TableHead className={`${TH} text-right`}>Dengan selisih</TableHead>
                    <TableHead className={`${TH} hidden text-right md:table-cell`}>Total kurang</TableHead>
                    <TableHead className={`${TH} text-right`}>Selisih bersih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.by_cashier.map((c) => (
                    <TableRow key={c.cashier} className="h-14">
                      <TableCell><Person email={c.cashier} /></TableCell>
                      <TableCell className="text-right tabular-nums">{c.shifts}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.with_diff}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{c.short_sum === 0 ? '—' : rupiah(-c.short_sum)}</TableCell>
                      <TableCell className="text-right"><Chip tone={c.diff_sum === 0 ? 'good' : c.diff_sum < 0 ? 'bad' : 'warn'} className="tabular-nums">{c.diff_sum === 0 ? 'Pas' : signed(c.diff_sum)}</Chip></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ListCard>
          <p className="text-base text-muted-foreground">Dihitung dari shift yang dibuka di periode terpilih. Selisih bersih = lebih dikurangi kurang.</p>
        </TabsContent>

        <TabsContent value="audit" className="space-y-3">
          <FilterChips
            id="audit-filter"
            label="Saring catatan tindakan"
            value={auditGroup}
            onChange={setAuditGroup}
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'order', label: 'Pesanan' },
              { value: 'reverse', label: 'Dibatalkan & uang kembali' },
              { value: 'shift', label: 'Shift & kas' },
              { value: 'settings', label: 'Pengaturan' },
              { value: 'team', label: 'Tim & toko' },
            ]}
          />
          <ListCard>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${TH} w-36`}>Waktu</TableHead>
                  <TableHead className={`${TH} w-56`}>Pengguna</TableHead>
                  <TableHead className={`${TH} w-40`}>Tindakan</TableHead>
                  <TableHead className={TH}>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.rows.map((l) => {
                  const a = ACTION[l.action] ?? { label: l.action, tone: 'neutral' as Tone }
                  return (
                    <TableRow key={l.id} className="h-14">
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <span className="font-medium">{day(l.created_at)}</span> <span className="text-muted-foreground">{clock(l.created_at)}</span>
                      </TableCell>
                      <TableCell className="max-w-56 truncate">{name(l.user_id)}</TableCell>
                      <TableCell><Chip tone={a.tone}>{a.label}</Chip></TableCell>
                      <TableCell className="max-w-0 truncate text-muted-foreground" title={detailText(l.detail)}>{detailText(l.detail) || '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {logs.loading && logs.rows.length === 0 && <RowsSkeleton rows={8} />}

            <ul className="divide-y md:hidden">
              {logs.rows.map((l) => {
                const a = ACTION[l.action] ?? { label: l.action, tone: 'neutral' as Tone }
                return (
                  <li key={l.id} className="space-y-1 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Chip tone={a.tone}>{a.label}</Chip>
                      <span className="text-xs text-muted-foreground tabular-nums">{day(l.created_at)} {clock(l.created_at)}</span>
                    </div>
                    <p className="text-sm">{name(l.user_id)}</p>
                    {detailText(l.detail) && <p className="text-sm text-muted-foreground">{detailText(l.detail)}</p>}
                  </li>
                )
              })}
            </ul>

            {logs.rows.length === 0 && !logs.loading && (
              <div className="p-6">
                <EmptyState title="Belum ada catatan" hint={auditGroup === 'all' ? 'Tindakan sensitif akan tercatat di sini.' : 'Tidak ada kejadian di kategori ini.'} />
              </div>
            )}
          </ListCard>
          <Pagination page={logs.page} pageCount={logs.pageCount} total={logs.total} pageSize={logs.pageSize} onPage={logs.setPage} loading={logs.loading} />
        </TabsContent>
      </Tabs>

      <ShiftDetailDrawer shiftId={detailId} canReview={canReview} onClose={() => setDetailId(null)} onChanged={refreshAll} />
    </div>
  )
}
