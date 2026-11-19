import { useState } from 'react'
import { msg } from '@shared/i18n'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import { can, type Order, type StaffRole } from '@shared/types/contracts'

/** Pisah bill: pilih item yang dibayar terpisah; item itu pindah ke pesanan baru. */
export function SplitPanel({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: (newOrderId: string) => void }) {
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))

  const submit = async () => {
    setBusy(true)
    const { data, error: err } = await rpc('split_order', { p_order_id: order.id, p_indexes: picked })
    setBusy(false)
    if (err) return setError(err.message)
    onDone((data as { id: string }).id)
  }

  return (
    <Panel
      onClose={onClose}
      title="Pisah bill"
      description={`${order.queue_code} · pilih item yang dibayar terpisah`}
      footer={
        <Button size="lg" className="h-12 w-full text-base" disabled={busy || picked.length === 0 || picked.length === order.items.length} onClick={submit}>
          Pisahkan {picked.length} item
        </Button>
      }
    >
      <ul className="divide-y">
        {order.items.map((it, i) => (
          <li key={i}>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
              <Checkbox checked={picked.includes(i)} onCheckedChange={() => toggle(i)} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{it.qty}× {it.name}</span>
                {it.choices.length > 0 && <span className="block text-sm text-muted-foreground">{it.choices.map((c) => c.option).join(', ')}</span>}
              </span>
              <span className="tabular-nums">{rupiah(it.subtotal)}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Promo, voucher, dan poin tetap di pesanan awal; pesanan baru dihitung ulang tanpa itu.</p>
      <ErrorAlert message={error} />
    </Panel>
  )
}

/** Gabung bill: pesanan lain di meja yang sama ditambahkan ke pesanan ini. */
export function MergePanel({ order, candidates, onClose, onDone }: { order: Order; candidates: Order[]; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const others = candidates.filter((o) => o.id !== order.id && o.status === 'UNPAID')

  const merge = async (sourceId: string) => {
    setBusy(true)
    const { error: err } = await rpc('merge_orders', { p_target: order.id, p_source: sourceId })
    setBusy(false)
    if (err) return setError(err.message)
    onDone()
  }

  return (
    <Panel onClose={onClose} title="Gabung bill" description={`Gabungkan ke ${order.queue_code}`} footer={<Button size="lg" variant="outline" className="h-12 w-full" onClick={onClose}>Batal</Button>}>
      {others.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">Tidak ada pesanan lain yang menunggu pembayaran.</p>
      ) : (
        <ul className="space-y-2">
          {others.map((o) => (
            <li key={o.id}>
              <button type="button" disabled={busy} onClick={() => merge(o.id)} className="flex min-h-14 w-full items-center justify-between rounded-lg border px-3 text-left hover:bg-muted">
                <span>
                  <span className="block font-mono font-semibold">{o.queue_code}</span>
                  <span className="block text-sm text-muted-foreground">{o.customer_name} · {o.order_type === 'DINE_IN' ? `Meja ${o.table_no}` : 'Bawa pulang'}</span>
                </span>
                <span className="tabular-nums">{rupiah(o.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ErrorAlert message={error} />
    </Panel>
  )
}

/** Void/refund pesanan yang sudah dibayar. Kasir butuh PIN supervisor; owner/manager tidak. */
export function ReversePanel({ order, role, onClose, onDone }: { order: Order; role: StaffRole | null; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<'VOID' | 'REFUND'>('VOID')
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const needsPin = !can.manage(role)

  const submit = async () => {
    setBusy(true)
    const { data, error: err } = await rpc('reverse_order', { p_order_id: order.id, p_kind: kind, p_reason: reason, p_pin: needsPin ? pin : null })
    setBusy(false)
    if (err) return setError(err.message)
    const r = data as { ok: boolean; error?: string }
    if (!r.ok) return setError(msg(r.error ?? 'Gagal'))
    onDone()
  }

  return (
    <Panel
      onClose={onClose}
      title="Batalkan pesanan terbayar"
      description={`${order.queue_code} · ${rupiah(order.total)}`}
      footer={
        <Button size="lg" variant="destructive" className="h-12 w-full text-base" disabled={busy || reason.trim().length < 3 || (needsPin && pin.length < 4)} onClick={submit}>
          {kind === 'VOID' ? 'Batalkan pesanan' : 'Kembalikan uang pesanan'}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {(['VOID', 'REFUND'] as const).map((k) => (
          <Button key={k} type="button" variant={kind === k ? 'default' : 'outline'} className="h-11" onClick={() => setKind(k)}>
            {k === 'VOID' ? 'Batalkan (salah input)' : 'Kembalikan uang ke pembeli'}
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason">Alasan</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" maxLength={100} placeholder="Mis. pelanggan batal, salah input" />
      </div>
      {needsPin && (
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN supervisor</Label>
          <Input id="pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} className="h-11 tracking-widest" placeholder="••••" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Stok bahan, poin member, dan voucher dikembalikan. Tindakan ini tercatat di log audit.</p>
      <ErrorAlert message={error} />
    </Panel>
  )
}

export function DisabledNote({ children }: { children: string }) {
  return <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{children}</p>
}
