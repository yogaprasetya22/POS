import { CheckCircle2, ChefHat, Printer, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { useMemo, useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { ThermalPaper } from '@shared/components/thermal-preview'
import { Button } from '@shared/components/ui/button'
import { escposKitchenTicket, escposReceipt, getPaperChars, previewKitchenTicket, previewReceipt, sendToPrinter, setPaperChars, type ReceiptStore } from '@shared/lib/print'
import type { Order } from '@shared/types/contracts'

/** Pratinjau cetakan (struk atau tiket dapur) dari byte ESC/POS yang sama, lalu kirim ke printer thermal. */
export function PrintPanel({ order, store, onClose }: { order: Order; store: ReceiptStore; onClose: () => void }) {
  const [kind, setKind] = useState<'receipt' | 'kitchen'>('receipt')
  const [chars, setChars] = useState<number>(getPaperChars())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const lines = useMemo(() => (kind === 'receipt' ? previewReceipt(order, store, chars) : previewKitchenTicket(order, chars)), [kind, order, store, chars])

  const send = async () => {
    setBusy(true)
    const r = await sendToPrinter(kind === 'receipt' ? escposReceipt(order, store, chars) : escposKitchenTicket(order, chars))
    setBusy(false)
    setError(r.ok ? '' : r.error)
    if (r.ok) {
      setSent(true)
      toast.success(kind === 'receipt' ? 'Struk dikirim ke printer' : 'Tiket dapur dikirim ke printer')
    }
  }

  return (
    <Panel
      onClose={onClose}
      title="Cetak ke printer thermal"
      description={`${order.queue_code} · tampilan di kertas thermal`}
      footer={
        <Button size="lg" className="h-12 w-full text-base" disabled={busy} onClick={send}>
          {sent ? <CheckCircle2 /> : <Printer />} {busy ? 'Mengirim…' : sent ? 'Terkirim · cetak lagi' : kind === 'receipt' ? 'Cetak struk' : 'Cetak tiket dapur'}
        </Button>
      }
    >
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Yang dicetak</p>
        <div className="grid grid-cols-2 gap-2">
          {(['receipt', 'kitchen'] as const).map((k) => {
            const Icon = k === 'receipt' ? Receipt : ChefHat
            const on = kind === k
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => { setKind(k); setSent(false) }}
                className={`flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-colors ${on ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
              >
                <Icon className={`size-5 shrink-0 ${on ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>
                  <span className="block text-sm font-bold">{k === 'receipt' ? 'Struk pelanggan' : 'Tiket dapur'}</span>
                  <span className="block text-xs text-muted-foreground">{k === 'receipt' ? 'Bukti bayar, ada harga' : 'Untuk dapur, tanpa harga'}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Ukuran kertas</p>
        <div className="inline-flex rounded-xl border-2 bg-muted/50 p-1">
          {([32, 48] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={chars === n}
              onClick={() => { setChars(n); setPaperChars(n) }}
              className={`h-9 rounded-lg px-4 text-sm font-semibold ${chars === n ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              {n === 32 ? '58 mm' : '80 mm'}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-muted/50 p-4">
      <ThermalPaper lines={lines} chars={chars} logo={kind === 'receipt' ? store.logo : undefined} />
      </div>
      <ErrorAlert message={error} />
      <p className="text-center text-xs text-muted-foreground">Hasil cetak akan sama persis seperti pratinjau ini.</p>
    </Panel>
  )
}
