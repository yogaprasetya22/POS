import { Banknote, Lock, TriangleAlert } from 'lucide-react'
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
  const [shiftName, setShiftName] = useState('')

  useEffect(() => {
    if (!touched && handover != null) setCash(String(handover))
  }, [handover, touched])

  const holder = status?.open && !status.open.mine ? status.open : null
  const amount = Number(cash) || 0
  const differs = handover != null && cash !== '' && amount !== handover

  if (holder) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 basis-64 text-sm">
            <span className="flex items-center gap-1.5 font-medium"><TriangleAlert className="size-4 shrink-0" aria-hidden /> {t('shift.ui.held_title', { who: holder.who ?? '—' })}</span>
            <span className="block text-muted-foreground">{t('shift.ui.held_hint', { at: timeJakarta(holder.opened_at) })}</span>
          </p>
          {can.manage(role) && (
            <Button variant="outline" className="h-11" onClick={() => setForce(true)}>
              <Lock /> Tutup paksa shift
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
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-500/40 dark:bg-amber-500/10"
      onSubmit={(e) => {
        e.preventDefault()
        void open()
      }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-56 text-sm">
          <span className="flex items-center gap-1.5 font-medium"><Banknote className="size-4 shrink-0" aria-hidden /> {t('shift.ui.not_open_title')}</span>
          <span className="block text-muted-foreground">
            {handover != null ? t('shift.ui.hint_handover', { who: status?.last_closed?.who ?? '—', amount: handover }) : t('shift.ui.hint_first')}
          </span>
          <span className="block text-xs text-muted-foreground/80">{t('shift.ui.opening_why')}</span>
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="open-cash" className="sr-only">Modal awal (Rp)</Label>
          <CurrencyInput id="open-cash" value={cash} onValueChange={(raw) => { setTouched(true); setCash(raw) }} placeholder="Modal awal" aria-label="Modal awal (Rp)" className="h-11 w-48 bg-background" />
          <Button type="submit" disabled={busy || (differs && note.trim().length < 3) || (shiftNames.length > 0 && !shiftName)} className="h-11 px-5">
            {busy ? 'Membuka…' : 'Buka shift'}
          </Button>
        </div>
      </div>
      {shiftNames.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Shift yang dibuka">
          <span className="text-base font-semibold">Shift mana?</span>
          {shiftNames.map((n) => (
            <button
              key={n.id}
              type="button"
              role="radio"
              aria-checked={shiftName === n.id}
              onClick={() => setShiftName(n.id)}
              className={`h-12 rounded-full border-2 px-5 text-base font-bold ${shiftName === n.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
            >
              {n.name}
            </button>
          ))}
          {!shiftName && <span className="text-base text-muted-foreground">Pilih dulu sebelum membuka shift.</span>}
        </div>
      )}
      {differs && (
        <div className="mt-2 space-y-1.5">
          <p className="text-sm font-medium text-destructive">{t('shift.ui.opening_differs', { diff: amount - (handover ?? 0) })}</p>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: ada tambahan modal dari owner" aria-label="Catatan selisih serah terima" maxLength={200} className="h-11 bg-background" />
        </div>
      )}
      {error && <ErrorAlert message={error} />}
    </form>
  )
}

/** Baris status shift + akses ke kas masuk/keluar dan tutup shift. */
export function ShiftBar({ shift, onChange }: { shift: ShiftSummary; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <p>
          <span className="font-medium">Shift terbuka</span>
          <span className="text-muted-foreground"> sejak {timeJakarta(shift.opened_at)} · kas diharapkan </span>
          <span className="font-semibold tabular-nums">{rupiah(shift.expected_cash ?? 0)}</span>
        </p>
        <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}>
          <Lock /> Kas &amp; tutup shift
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
    const done = () => { onChange(); onClose() }
    return (
      <Panel onClose={done} title="Shift ditutup" description={t('shift.ui.closed_hint')} footer={<Button size="lg" className="h-12 w-full" onClick={done}>Selesai</Button>}>
        <div className="space-y-2 text-sm">
          <Line label="Kas diharapkan" value={closedInfo.expected} />
          <Line label="Uang dihitung (diserahkan)" value={closedInfo.counted} strong />
          <DiffNote diff={closedInfo.difference} />
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
        <Input aria-label="Catatan" placeholder={needsNote ? 'Penyebab selisih (wajib)' : 'Catatan (opsional)'} value={note} onChange={(e) => setNote(e.target.value)} className="h-11" maxLength={200} />
        <p className="text-xs text-muted-foreground">Uang ini yang diserahkan ke kasir berikutnya sebagai modal awalnya.</p>
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
