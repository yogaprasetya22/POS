import { getDevice, lockDevice } from '@shared/lib/device-binding'
import { Banknote, CheckCircle2, Lock, LockOpen, Moon, Sun, TriangleAlert } from 'lucide-react'
import { useShiftNames } from '@shared/lib/shift-names'
import { useI18n } from '@shared/i18n'
import { useEffect, useState } from 'react'
import { CurrencyInput } from '@shared/components/currency-input'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { rpc } from '@shared/lib/api'
import { PAYMENT_LABEL, ShiftDetailSchema, can, type ShiftStatus, type ShiftSummary, type StaffRole } from '@shared/types/contracts'
import { rupiah, timeJakarta } from '@shared/lib/utils'


/** Pesan selisih dengan arti yang jelas (kurang = uang di laci lebih sedikit dari seharusnya). */
function DiffNote({ diff }: { diff: number }) {
  const { t } = useI18n()
  if (diff === 0) return <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('shift.ui.diff_exact')}</p>
  return (
    <p className={`text-sm font-medium ${diff < 0 ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>
      {t(diff < 0 ? 'shift.ui.diff_short' : 'shift.ui.diff_over', { amount: Math.abs(diff) })}
    </p>
  )
}

/**
 * Bar "Buka shift". Satu laci = satu shift: kalau kasir lain masih memegang laci, tampil pesan serah terima
 * (manager bisa menutup paksa). Modal awal otomatis terisi uang hasil hitung shift sebelumnya.
 */
export function OpenShiftCard({ status, role, onOpened }: { status: ShiftStatus | null; role: StaffRole | null; onOpened: () => void }) {
  const { t } = useI18n()
  const handover = status?.last_closed?.counted_cash ?? null
  const [cash, setCash] = useState(handover != null ? String(handover) : '')
  const [touched, setTouched] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [force, setForce] = useState(false)
  const shiftNames = useShiftNames().active
  const [shiftName, setShiftName] = useState(() => (shiftNames.length === 1 ? shiftNames[0].id : ''))

  useEffect(() => {
    if (!touched && handover != null) setCash(String(handover))
  }, [handover, touched])

  useEffect(() => {
    if (shiftNames.length > 0 && !shiftName) {
      const hour = new Date().getHours()
      const morning = shiftNames.find((s) => s.name.toLowerCase().includes('pagi'))
      const evening = shiftNames.find((s) => s.name.toLowerCase().includes('sore') || s.name.toLowerCase().includes('malam'))
      if (hour < 14 && morning) setShiftName(morning.id)
      else if (hour >= 14 && evening) setShiftName(evening.id)
      else setShiftName(shiftNames[0].id)
    }
  }, [shiftNames, shiftName])

  const holder = status?.open && !status.open.mine ? status.open : null
  const amount = Number(cash) || 0
  const differs = handover != null && cash !== '' && amount !== handover

  if (holder) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 backdrop-blur-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <TriangleAlert className="size-5" aria-hidden />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-foreground">
                {t('shift.ui.held_title', { who: holder.who ?? '—' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('shift.ui.held_hint', { at: timeJakarta(holder.opened_at) })}
              </p>
            </div>
          </div>
          {can.manage(role) && (
            <Button variant="outline" className="h-11 rounded-xl border-amber-500/30 font-semibold hover:bg-amber-500/10" onClick={() => setForce(true)}>
              <Lock className="mr-1.5 size-4" /> Tutup paksa shift
            </Button>
          )}
        </div>
        {force && <ForceClosePanel shiftId={holder.id} who={holder.who} onClose={() => setForce(false)} onDone={() => { setForce(false); onOpened() }} />}
      </div>
    )
  }

  const open = async () => {
    setBusy(true)
    const { error: err } = await rpc('open_shift', { p_opening_cash: amount, p_note: note, p_shift_name: shiftName || null })
    setBusy(false)
    if (err) return setError(err.message)
    onOpened()
  }

  return (
    <form
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.04] p-4 sm:p-5 shadow-xs transition-all"
      onSubmit={(e) => {
        e.preventDefault()
        void open()
      }}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-primary rounded-l-2xl" />

      <div className="flex flex-col gap-4 pl-1 sm:pl-2">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <Banknote className="size-5" aria-hidden />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground sm:text-lg">
                  {t('shift.ui.not_open_title')}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Laci Belum Dibuka
                </span>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {handover != null ? (
                  <span>
                    Serah terima dari <strong className="text-foreground">{status?.last_closed?.who ?? 'kasir sebelumnya'}</strong>: kas di laci tercatat <strong className="tabular-nums text-foreground">{rupiah(handover)}</strong>.
                  </span>
                ) : (
                  <span>{t('shift.ui.hint_first')}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Input & Shift Selection Row */}
        <div className="flex flex-wrap items-end gap-3 pt-1">
          {/* Shift Segmented Pills */}
          {shiftNames.length > 0 && (
            <div className="min-w-44 flex-1 space-y-1.5 sm:flex-initial">
              <span className="text-xs font-semibold text-muted-foreground">Pilih Sesi Shift:</span>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Shift yang dibuka">
                {shiftNames.map((n) => {
                  const isSelected = shiftName === n.id
                  const isPagi = n.name.toLowerCase().includes('pagi')
                  return (
                    <button
                      key={n.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setShiftName(n.id)}
                      className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-sm font-bold transition-all ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border/80 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isPagi ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
                      <span>{n.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Modal Awal Input */}
          <div className="min-w-56 flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="open-cash" className="text-xs font-semibold text-muted-foreground">
                Modal Awal di Laci:
              </Label>
              {handover != null && amount !== handover && (
                <button
                  type="button"
                  onClick={() => {
                    setCash(String(handover))
                    setTouched(true)
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Sesuai Laci (Rp{handover.toLocaleString('id-ID')})
                </button>
              )}
            </div>
            <CurrencyInput
              id="open-cash"
              value={cash}
              onValueChange={(raw) => {
                setTouched(true)
                setCash(raw)
              }}
              placeholder="0"
              aria-label="Modal awal (Rp)"
              className="h-11 rounded-xl border-border/80 bg-background font-semibold text-base"
            />
          </div>

          {/* Action CTA Button */}
          <div className="w-full sm:w-auto">
            <Button
              type="submit"
              disabled={busy || (differs && note.trim().length < 3) || (shiftNames.length > 0 && !shiftName)}
              className="h-11 w-full sm:w-auto px-6 rounded-xl font-bold shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <LockOpen className="mr-1.5 size-4" />
              <span>{busy ? 'Membuka Shift…' : 'Buka Shift Sekarang'}</span>
            </Button>
          </div>
        </div>

        {/* Diff Reason Alert when amount !== handover */}
        {differs && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <TriangleAlert className="size-3.5 shrink-0" />
              {t('shift.ui.opening_differs', { diff: amount - (handover ?? 0) })}
            </p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Jelaskan alasan selisih (mis. ada tambahan modal dari owner)..."
              aria-label="Catatan selisih serah terima"
              maxLength={200}
              className="h-10 rounded-lg bg-background text-xs sm:text-sm"
            />
          </div>
        )}

        {error && <ErrorAlert message={error} />}
      </div>
    </form>
  )
}

/** Baris status shift + akses ke kas masuk/keluar dan tutup shift. */
export function ShiftBar({ shift, onChange }: { shift: ShiftSummary; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3 sm:px-4 sm:py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold text-foreground">
                Shift Kasir Aktif
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                · dibuka {timeJakarta(shift.opened_at)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Kas di laci saat ini:{' '}
              <span className="font-bold tabular-nums text-foreground">
                {rupiah(shift.expected_cash ?? 0)}
              </span>
              {shift.cash_sales > 0 && (
                <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                  (+{rupiah(shift.cash_sales)} tunai)
                </span>
              )}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9.5 rounded-xl border-border px-3.5 text-xs font-semibold hover:bg-muted"
          onClick={() => setOpen(true)}
        >
          <Lock className="mr-1.5 size-3.5 text-muted-foreground" />
          <span>Kelola Kas &amp; Tutup Shift</span>
        </Button>
      </div>
      {open && <ShiftPanel shift={shift} onClose={() => setOpen(false)} onChange={onChange} />}
    </>
  )
}

const Line = ({ label, value, strong, hint }: { label: string; value: number; strong?: boolean; hint?: string }) => (
  <div className={`flex justify-between gap-3 ${strong ? 'text-base font-bold' : 'text-muted-foreground'}`}>
    <span>{label}{hint && <span className="block text-xs font-normal">{hint}</span>}</span>
    <span className="tabular-nums">{rupiah(value)}</span>
  </div>
)

function ShiftPanel({ shift, onClose, onChange }: { shift: ShiftSummary; onClose: () => void; onChange: () => void }) {
  const { t } = useI18n()
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [mvKind, setMvKind] = useState<'IN' | 'OUT'>('OUT')
  const [mvAmount, setMvAmount] = useState('')
  const [mvReason, setMvReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [closedInfo, setClosedInfo] = useState<{ expected: number; counted: number; difference: number } | null>(null)
  // modal laci tetap toko: sisanya disetor ke owner saat tutup
  const [float, setFloat] = useState(100_000)
  useEffect(() => {
    void rpc('shift_status').then(({ data }) => {
      const f = (data as { cash_float?: number } | null)?.cash_float
      if (typeof f === 'number') setFloat(f)
    })
  }, [])
  const keepOf = (c: number) => Math.min(c, float)

  const expected = shift.expected_cash ?? 0
  const diff = (Number(counted) || 0) - expected
  const needsNote = counted !== '' && diff !== 0

  const move = async () => {
    setBusy(true)
    const { error: err } = await rpc('cash_movement', { p_kind: mvKind, p_amount: Number(mvAmount) || 0, p_reason: mvReason })
    setBusy(false)
    if (err) return setError(err.message)
    setMvAmount('')
    setMvReason('')
    setError('')
    onChange()
  }

  const close = async () => {
    setBusy(true)
    const { data, error: err } = await rpc('close_shift', { p_counted_cash: Number(counted) || 0, p_note: note })
    setBusy(false)
    if (err) return setError(err.message)
    const r = data as { expected_cash: number; counted_cash: number; difference: number }
    setClosedInfo({ expected: r.expected_cash, counted: r.counted_cash, difference: r.difference })
    // jangan muat ulang dulu: shift jadi kosong dan bar ini (beserta ringkasan) akan hilang sebelum sempat dibaca
  }

  if (closedInfo) {
    // Perangkat kasir terikat: setelah tutup shift langsung kembali ke layar PIN untuk kasir berikutnya
    const done = () => { onChange(); onClose(); if (getDevice()) void lockDevice() }
    return (
      <Panel onClose={done} title="Shift ditutup" description={t('shift.ui.closed_hint')} footer={<Button size="lg" className="h-12 w-full" onClick={done}>{getDevice() ? 'Selesai & ganti kasir' : 'Selesai'}</Button>}>
        <div className="space-y-2 text-sm">
          <Line label="Kas diharapkan" value={closedInfo.expected} />
          <Line label="Uang dihitung di laci" value={closedInfo.counted} />
          <DiffNote diff={closedInfo.difference} />
          <div className="mt-3 space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-base">
            <Line label="Setor ke owner" value={closedInfo.counted - keepOf(closedInfo.counted)} strong />
            <Line label="Tinggalkan di laci (modal berikutnya)" value={keepOf(closedInfo.counted)} />
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      onClose={onClose}
      title="Kas & tutup shift"
      description={`Dibuka ${timeJakarta(shift.opened_at)}`}
      footer={
        <Button size="lg" className="h-12 w-full text-base" disabled={busy || counted === '' || (needsNote && note.trim().length < 3)} onClick={close}>
          Tutup shift
        </Button>
      }
    >
      <div className="space-y-1.5 text-sm">
        <Line label="Modal awal" value={shift.opening_cash} />
        <Line label="Penjualan tunai" value={shift.cash_sales} hint="pesanan tunai yang dibayar di shift ini" />
        <Line label="Kas masuk" value={shift.cash_in} />
        <Line label="Kas keluar" value={-shift.cash_out} />
        {shift.cash_reversals > 0 && <Line label="Uang dikembalikan (shift lain)" value={-shift.cash_reversals} />}
        <Line label="Kas diharapkan di laci" value={expected} strong />
        {Object.entries(shift.by_method).length > 0 && (
          <p className="pt-2 text-xs text-muted-foreground">
            {Object.entries(shift.by_method)
              .map(([m, v]) => `${PAYMENT_LABEL[m as keyof typeof PAYMENT_LABEL] ?? m}: ${v.count} transaksi, ${rupiah(v.total)}`)
              .join(' · ')}
          </p>
        )}
      </div>

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-semibold">Catat kas masuk / keluar</p>
        <div className="grid grid-cols-2 gap-2">
          {(['OUT', 'IN'] as const).map((k) => (
            <Button key={k} type="button" variant={mvKind === k ? 'default' : 'outline'} className="h-11" onClick={() => setMvKind(k)}>
              {k === 'OUT' ? 'Kas keluar' : 'Kas masuk'}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-[8rem_1fr] gap-2">
          <CurrencyInput aria-label="Jumlah" placeholder="Jumlah" value={mvAmount} onValueChange={setMvAmount} className="h-11" />
          <Input aria-label="Alasan" placeholder="Alasan (mis. beli es batu)" value={mvReason} onChange={(e) => setMvReason(e.target.value)} className="h-11" maxLength={100} />
        </div>
        <Button type="button" variant="outline" className="h-11 w-full" disabled={busy || !mvAmount || mvReason.trim().length < 3} onClick={move}>
          Simpan
        </Button>
      </div>

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-semibold">Tutup shift</p>
        <div className="space-y-1.5">
          <Label htmlFor="counted">Uang yang dihitung di laci (Rp)</Label>
          <CurrencyInput id="counted" value={counted} onValueChange={setCounted} className="h-12 text-lg" placeholder="0" />
        </div>
        {counted !== '' && <DiffNote diff={diff} />}
        {counted !== '' && (
          <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
            <Line label="Setor ke owner" value={(Number(counted) || 0) - keepOf(Number(counted) || 0)} strong />
            <Line label="Tinggalkan di laci" value={keepOf(Number(counted) || 0)} />
          </div>
        )}
        <Input aria-label="Catatan" placeholder={needsNote ? 'Penyebab selisih (wajib)' : 'Catatan (opsional)'} value={note} onChange={(e) => setNote(e.target.value)} className="h-11" maxLength={200} />
        <p className="text-xs text-muted-foreground">Hitung semua uang di laci. Ambil uang setoran untuk owner, tinggalkan {rupiah(float)} sebagai modal shift berikutnya.</p>
      </div>
      <ErrorAlert message={error} />
    </Panel>
  )
}

/** Manager menutup shift yang terlupa (kasirnya sudah pulang). Tercatat sebagai "tutup paksa" di rincian dan log audit. */
export function ForceClosePanel({ shiftId, who, onClose, onDone }: { shiftId: string; who: string | null; onClose: () => void; onDone: () => void }) {
  const [expected, setExpected] = useState<number | null>(null)
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void rpc('shift_detail', { p_shift: shiftId }).then(({ data }) => {
      const p = ShiftDetailSchema.safeParse(data)
      if (p.success) setExpected(p.data.totals.expected)
    })
  }, [shiftId])

  const diff = (Number(counted) || 0) - (expected ?? 0)
  const submit = async () => {
    setBusy(true)
    const { error: err } = await rpc('force_close_shift', { p_shift: shiftId, p_counted_cash: Number(counted) || 0, p_note: note })
    setBusy(false)
    if (err) return setError(err.message)
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title="Tutup paksa shift"
      description={`Shift ${who ?? 'kasir lain'} akan ditutup atas nama kamu`}
      footer={<Button size="lg" variant="destructive" className="h-12 w-full" disabled={busy || counted === '' || note.trim().length < 3} onClick={submit}>Tutup paksa</Button>}
    >
      <div className="space-y-1.5 text-sm">
        <Line label="Kas diharapkan di laci" value={expected ?? 0} strong />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fc-counted">Uang yang dihitung di laci sekarang (Rp)</Label>
        <CurrencyInput id="fc-counted" value={counted} onValueChange={setCounted} className="h-12 text-lg" />
      </div>
      {counted !== '' && <DiffNote diff={diff} />}
      <div className="space-y-1.5">
        <Label htmlFor="fc-note">Alasan tutup paksa (wajib)</Label>
        <Input id="fc-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: kasir lupa menutup, sudah pulang" className="h-11" maxLength={200} />
      </div>
      <ErrorAlert message={error} />
    </Panel>
  )
}
