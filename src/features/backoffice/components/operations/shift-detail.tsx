import { CheckCircle2, Lock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ForceClosePanel } from '@features/cashier-pos/components/shift'
import { ErrorAlert } from '@shared/components/error-alert'
import { Chip } from '@shared/components/page'
import { RowsSkeleton } from '@shared/components/skeletons'
import { Button } from '@shared/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@shared/components/ui/drawer'
import { Input } from '@shared/components/ui/input'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import { PAYMENT_LABEL, ShiftDetailSchema, type ShiftDetail } from '@shared/types/contracts'

const when = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${rupiah(Math.abs(n))}`

function Step({ sign, label, hint, value, strong }: { sign?: '+' | '−' | '='; label: string; hint?: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2 ${strong ? 'border-t font-semibold' : ''}`}>
      <span className="flex gap-2.5">
        <span className="w-4 shrink-0 text-center text-muted-foreground">{sign}</span>
        <span>
          {label}
          {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
        </span>
      </span>
      <span className="shrink-0 tabular-nums">{rupiah(value)}</span>
    </div>
  )
}

type StockLine = { name: string; unit: string; qty: number; value: number }
type ShiftStock = { used: StockLine[]; wasted: StockLine[]; used_value: number; wasted_value: number }
const qty = (n: number) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 3 })

function StockLines({ title, note, rows, total }: { title: string; note: string; rows: StockLine[]; total: number }) {
  return (
    <section>
      <H note={note}>{title} · {rupiah(total)}</H>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{r.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{qty(r.qty)} {r.unit}</span>
              <span className="w-24 shrink-0 text-right font-medium tabular-nums">{rupiah(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const H = ({ children, note }: { children: React.ReactNode; note?: string }) => (
  <div className="mb-2">
    <h3 className="text-sm font-semibold">{children}</h3>
    {note && <p className="text-xs text-muted-foreground">{note}</p>}
  </div>
)

/** Rincian satu shift: rumus selisih langkah demi langkah, siapa yang membuat & menerima tiap pesanan, kas keluar/masuk, tinjauan. */
export function ShiftDetailDrawer({ shiftId, canReview, onClose, onChanged }: { shiftId: string | null; canReview: boolean; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<ShiftDetail | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [force, setForce] = useState(false)
  const [shiftName, setShiftName] = useState('')
  const [stock, setStock] = useState<ShiftStock | null>(null)

  const load = useCallback(async () => {
    if (!shiftId) return
    const { data, error: err } = await rpc('shift_detail', { p_shift: shiftId })
    if (err) return setError(err.message)
    const p = ShiftDetailSchema.safeParse(data)
    if (!p.success) return setError('Format rincian shift tidak dikenali')
    setError('')
    setDetail(p.data)
    // nama shift & pemakaian bahan: pelengkap, rincian tetap tampil bila gagal dimuat
    void supabase.from('shifts').select('shift_name').eq('id', shiftId).maybeSingle().then(({ data: d }) => setShiftName((d as { shift_name?: string } | null)?.shift_name ?? ''))
    void rpc('shift_stock', { p_shift: shiftId }).then(({ data: d }) => setStock((d as ShiftStock | null) ?? null))
  }, [shiftId])

  useEffect(() => {
    setDetail(null)
    setStock(null)
    setShiftName('')
    setNote('')
    void load()
  }, [load])

  const review = async () => {
    setBusy(true)
    const { error: err } = await rpc('review_shift', { p_shift: shiftId, p_note: note })
    setBusy(false)
    if (err) return setError(err.message)
    await load()
    onChanged()
  }

  const sh = detail?.shift
  const t = detail?.totals
  const diff = sh?.difference ?? null
  const closed = !!sh?.closed_at
  const cashOrders = (detail?.orders ?? []).filter((o) => o.payment_method === 'CASH')
  const otherMethods = Object.entries(detail?.by_method ?? {}).filter(([m]) => m !== 'CASH')
  const handoverDiff = sh && sh.opening_expected != null ? sh.opening_cash - sh.opening_expected : 0

  return (
    <>
      <Drawer open={!!shiftId} onOpenChange={(o) => !o && onClose()} swipeDirection="right">
        <DrawerContent size="md">
          <DrawerHeader className="border-b text-left">
            <DrawerTitle className="flex flex-wrap items-center gap-2">
              Rincian shift {shiftName ? `${shiftName} · ` : ''}{sh?.opened_by ?? ''}
              {sh?.forced && <Chip tone="warn">Ditutup paksa</Chip>}
              {!closed && sh && <Chip tone="info">Berjalan</Chip>}
            </DrawerTitle>
            <DrawerDescription>
              {sh ? `${when(sh.opened_at)}${sh.closed_at ? ` – ${clock(sh.closed_at)}` : ' – sekarang'}${sh.closed_by && sh.closed_by !== sh.opened_by ? ` · ditutup oleh ${sh.closed_by}` : ''}` : 'Memuat…'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
            <ErrorAlert message={error} />
            {!detail || !sh || !t ? (
              <RowsSkeleton rows={6} className="-mx-4" />
            ) : (
              <>
                <section>
                  <H note="Selisih = uang yang dihitung di laci − uang yang seharusnya ada. Minus berarti uang kurang.">Bagaimana selisih dihitung</H>
                  <div className="divide-y rounded-lg border px-3 text-sm">
                    <Step
                      label="Modal awal"
                      hint={
                        sh.handover_from
                          ? `Serah terima dari ${sh.handover_from}${handoverDiff !== 0 ? ` · seharusnya ${rupiah(sh.opening_expected ?? 0)}, beda ${signed(handoverDiff)}${sh.opening_note ? ` (“${sh.opening_note}”)` : ''}` : ' · sama dengan uang yang diserahkan'}`
                          : 'Shift pertama, tanpa serah terima'
                      }
                      value={t.opening}
                    />
                    <Step sign="+" label="Penjualan tunai" hint={`${cashOrders.filter((o) => o.counted).length} pesanan tunai`} value={t.cash_sales} />
                    <Step sign="+" label="Kas masuk" hint={`${detail.movements.filter((m) => m.kind === 'IN').length} catatan`} value={t.cash_in} />
                    <Step sign="−" label="Kas keluar" hint={`${detail.movements.filter((m) => m.kind === 'OUT').length} catatan`} value={t.cash_out} />
                    <Step sign="−" label="Uang dikembalikan / dibatalkan (tunai) dari shift lain" hint={`${detail.reversals.length} pesanan`} value={t.cash_reversals} />
                    <Step sign="=" label="Uang yang seharusnya ada" value={t.expected} strong />
                    {closed && <Step label="Uang yang dihitung di laci" value={sh.counted_cash ?? 0} />}
                  </div>
                  {closed && diff !== null && (
                    <p className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${diff === 0 ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100' : diff < 0 ? 'bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100'}`}>
                      {diff === 0 ? 'Kas pas, tidak ada selisih.' : `${diff < 0 ? 'Uang kurang' : 'Uang lebih'} ${rupiah(Math.abs(diff))}`}
                      {sh.note && <span className="block font-normal">Catatan kasir: “{sh.note}”</span>}
                    </p>
                  )}
                </section>

                <section>
                  <H note="Pelanggan yang memesan lewat QR tanpa login tercatat sebagai “Pelanggan”. Uangnya baru masuk laci saat kasir menerima pembayaran, dan nama kasir itu tersimpan.">Pesanan tunai di shift ini ({cashOrders.length})</H>
                  {cashOrders.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada pembayaran tunai.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {cashOrders.map((o) => (
                        <li key={o.id} className="space-y-0.5 px-3 py-2.5 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2">
                              <span className="font-mono font-semibold">{o.queue_code}</span>
                              <span className="truncate text-muted-foreground">{o.customer_name}</span>
                            </span>
                            <span className={`tabular-nums ${o.counted === false ? 'text-muted-foreground line-through' : 'font-medium'}`}>{rupiah(o.total)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {o.source === 'CUSTOMER' ? 'Dipesan pelanggan (QR, tanpa akun)' : `Dibuat staf ${o.created_by ?? '—'}`} · dibayar ke {o.paid_by ?? '—'}
                            {o.paid_at && ` · ${clock(o.paid_at)}`}
                          </p>
                          {(o.status === 'VOID' || o.status === 'REFUNDED') && (
                            <p className="text-xs text-destructive">
                              {o.status === 'VOID' ? 'Dibatalkan' : 'Uang kembali'} oleh {o.voided_by ?? '—'}{o.voided_at ? ` · ${clock(o.voided_at)}` : ''}{o.void_reason ? ` · “${o.void_reason}”` : ''}
                              {o.counted === false ? ' · dibatalkan di shift yang sama, tidak dihitung' : ' · uangnya dikembalikan di shift lain'}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {otherMethods.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Non-tunai (tidak masuk laci): {otherMethods.map(([m, v]) => `${PAYMENT_LABEL[m as keyof typeof PAYMENT_LABEL] ?? m} ${v.count}× ${rupiah(v.total)}`).join(' · ')}
                    </p>
                  )}
                </section>

                <section>
                  <H>Kas masuk &amp; keluar ({detail.movements.length})</H>
                  {detail.movements.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Tidak ada.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {detail.movements.map((m) => (
                        <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                          <span>
                            {m.reason}
                            <span className="block text-xs text-muted-foreground">{m.by ?? '—'} · {clock(m.at)}</span>
                          </span>
                          <span className={`shrink-0 tabular-nums ${m.kind === 'OUT' ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400'}`}>{m.kind === 'OUT' ? '−' : '+'}{rupiah(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {detail.reversals.length > 0 && (
                  <section>
                    <H note="Uang dikembalikan dari laci shift ini untuk pesanan yang dibayar di shift lain.">Uang dikembalikan / dibatalkan (tunai) ({detail.reversals.length})</H>
                    <ul className="divide-y rounded-lg border">
                      {detail.reversals.map((o) => (
                        <li key={o.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                          <span>
                            <span className="font-mono font-semibold">{o.queue_code}</span> {o.customer_name}
                            <span className="block text-xs text-muted-foreground">{o.status === 'VOID' ? 'Dibatalkan' : 'Uang kembali'} oleh {o.voided_by ?? '—'}{o.void_reason ? ` · “${o.void_reason}”` : ''}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-destructive">−{rupiah(o.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {stock && (
                  <>
                    <StockLines title="Bahan terpakai" note="Dari menu yang terjual selama shift ini, dihitung dari resep dan harga beli sekarang." rows={stock.used} total={stock.used_value} />
                    <StockLines title="Bahan terbuang" note="Yang dicatat terbuang selama shift ini." rows={stock.wasted} total={stock.wasted_value} />
                  </>
                )}

                {closed && (diff ?? 0) !== 0 && (
                  <section>
                    <H>Tinjauan manager</H>
                    {sh.reviewed_at ? (
                      <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                          Ditinjau {sh.reviewed_by} · {when(sh.reviewed_at)}
                          {sh.review_note && <span className="block">“{sh.review_note}”</span>}
                        </span>
                      </p>
                    ) : canReview ? (
                      <div className="space-y-2">
                        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan tinjauan (opsional), mis. dijelaskan kasir" aria-label="Catatan tinjauan" className="h-11" maxLength={200} />
                        <Button className="h-11 w-full" disabled={busy} onClick={review}>
                          <CheckCircle2 /> Tandai sudah ditinjau
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Menunggu ditinjau manager.</p>
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          <DrawerFooter className="flex-row border-t pt-3">
            <DrawerClose render={<Button variant="outline" className="h-11 flex-1">Tutup</Button>} />
            {canReview && sh && !closed && (
              <Button variant="destructive" className="h-11 flex-1" onClick={() => setForce(true)}>
                <Lock /> Tutup paksa
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      {force && shiftId && (
        <ForceClosePanel
          shiftId={shiftId}
          who={sh?.opened_by ?? null}
          onClose={() => setForce(false)}
          onDone={() => {
            setForce(false)
            void load()
            onChanged()
          }}
        />
      )}
    </>
  )
}
