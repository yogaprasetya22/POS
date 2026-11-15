import { Info } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { Chip, FilterChips, ListCard, PageHeader, StatTile, type Tone } from '@shared/components/page'
import { EmptyState, Pagination } from '@shared/components/pagination'
import { RowsSkeleton, StatTilesSkeleton } from '@shared/components/skeletons'
import { Avatar, AvatarFallback } from '@shared/components/ui/avatar'
import { Button } from '@shared/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { useStaff } from '@shared/lib/auth'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'
import { usePaged } from '@shared/lib/use-paged'
import { rupiah, todayJakarta } from '@shared/lib/utils'
import { ShiftStatsSchema, can, type ShiftStats } from '@shared/types/contracts'
import { ShiftDetailDrawer } from './shift-detail'
import { addDays } from './report-page'

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
const ProfileSchema = z.object({ user_id: z.string(), email: z.string().nullable() })

const ACTION: Record<string, { label: string; tone: Tone }> = {
  'order.pay': { label: 'Pembayaran', tone: 'good' },
  'order.void': { label: 'Void', tone: 'bad' },
  'order.refund': { label: 'Refund', tone: 'bad' },
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
type Period = '7d' | '30d' | 'month'
const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
  { value: 'month', label: 'Bulan ini' },
]
function rangeOf(p: Period): [string, string] {
  const t = todayJakarta()
  return p === '7d' ? [addDays(t, -6), t] : p === '30d' ? [addDays(t, -29), t] : [t.slice(0, 8) + '01', t]
}

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
  const [period, setPeriod] = useState<Period>('30d')
  const [[from, to], setRange] = useState<[string, string]>(rangeOf('30d'))
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all')
  const [auditGroup, setAuditGroup] = useState<AuditGroup>('all')
  const [stats, setStats] = useState<ShiftStats | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

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
  useEffect(() => {
    void supabase.from('profiles').select('user_id,email').then(({ data }) => {
      const pp = z.array(ProfileSchema).safeParse(data ?? [])
      if (pp.success) setWho(new Map(pp.data.map((x) => [x.user_id, x.email ?? ''])))
    })
  }, [])

  const name = (id: string | null) => (id ? (who.get(id) ?? '—') : 'Pelanggan')
  const canReview = can.manage(role)
  const refreshAll = () => {
    shifts.reload()
    void loadStats()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Shift & audit" description="Pantau selisih kas tiap shift, siapa yang memegang laci, dan jejak tindakan sensitif. Buka Rincian untuk melihat dari mana selisih berasal." />

      <FilterChips id="ops-period" label="Periode" value={period} onChange={(p) => { setPeriod(p); setRange(rangeOf(p)) }} options={PERIODS} />

      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Total selisih kas"
            value={stats.diff_total === 0 ? 'Rp0' : signed(stats.diff_total)}
            tone={stats.diff_total < 0 ? 'bad' : stats.diff_total > 0 ? undefined : 'good'}
            hint={stats.with_diff === 0 ? `${stats.closed} shift, semuanya pas` : `kurang ${rupiah(-stats.short_total)} · lebih ${rupiah(stats.over_total)}`}
          />
          <StatTile index={0} label="Shift dengan selisih" value={`${stats.with_diff} / ${stats.closed}`} hint="shift ditutup di periode ini" tone={stats.with_diff > 0 ? 'bad' : undefined} />
          <button type="button" className="rounded-xl text-left" onClick={() => { setTab('shift'); setShiftFilter('review') }} aria-label="Lihat shift yang perlu ditinjau">
            <StatTile index={1} label="Perlu ditinjau" value={String(stats.unreviewed)} hint={stats.unreviewed ? 'ketuk untuk melihat daftarnya' : 'semua selisih sudah ditinjau'} tone={stats.unreviewed > 0 ? 'bad' : 'good'} />
          </button>
          <StatTile
            label="Serah terima bermasalah"
            value={String(stats.handover_mismatch + stats.forced)}
            hint={`${stats.handover_mismatch} modal awal beda · ${stats.forced} tutup paksa`}
            tone={stats.handover_mismatch + stats.forced > 0 ? 'bad' : undefined}
          />
        </div>
      ) : (
        <StatTilesSkeleton />
      )}

      <p className="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Cara membaca:</span> uang yang seharusnya ada = modal awal + penjualan tunai + kas masuk − kas keluar − refund tunai. Selisih = uang yang dihitung kasir − seharusnya.
          Minus berarti uang kurang. Modal awal shift berikutnya harus sama dengan uang yang diserahkan shift sebelumnya.
        </span>
      </p>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="shift" className="h-11 flex-none px-4">Riwayat shift {!shifts.loading && <span className="ml-1.5 text-muted-foreground tabular-nums">{shifts.total}</span>}</TabsTrigger>
          <TabsTrigger value="cashier" className="h-11 flex-none px-4">Per kasir</TabsTrigger>
          <TabsTrigger value="audit" className="h-11 flex-none px-4">Log audit {!logs.loading && <span className="ml-1.5 text-muted-foreground tabular-nums">{logs.total}</span>}</TabsTrigger>
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
                  <TableHead className={`${TH} hidden text-right lg:table-cell`}>Diharapkan</TableHead>
                  <TableHead className={`${TH} hidden text-right lg:table-cell`}>Dihitung</TableHead>
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
                        {s.opening_expected != null && s.opening_cash !== s.opening_expected && <span className="text-destructive">modal awal beda {signed(s.opening_cash - s.opening_expected)}</span>}
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
          <p className="text-xs text-muted-foreground">Dihitung dari shift yang dibuka di periode terpilih. Selisih bersih = lebih dikurangi kurang.</p>
        </TabsContent>

        <TabsContent value="audit" className="space-y-3">
          <FilterChips
            id="audit-filter"
            label="Filter log audit"
            value={auditGroup}
            onChange={setAuditGroup}
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'order', label: 'Pesanan' },
              { value: 'reverse', label: 'Void & refund' },
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
