import { Printer } from 'lucide-react'
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

  const lines = useMemo(() => (kind === 'receipt' ? previewReceipt(order, store, chars) : previewKitchenTicket(order, chars)), [kind, order, store, chars])

  const send = async () => {
    setBusy(true)
    const r = await sendToPrinter(kind === 'receipt' ? escposReceipt(order, store, chars) : escposKitchenTicket(order, chars))
    setBusy(false)
    setError(r.ok ? '' : r.error)
  }

  return (
    <Panel
      onClose={onClose}
      title="Pratinjau printer"
      description={`${order.queue_code} · tampilan di kertas thermal`}
      footer={
        <Button size="lg" className="h-12 w-full text-base" disabled={busy} onClick={send}>
          <Printer /> Kirim ke printer thermal
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {(['receipt', 'kitchen'] as const).map((k) => (
          <Button key={k} type="button" variant={kind === k ? 'default' : 'outline'} className="h-11" onClick={() => setKind(k)}>
            {k === 'receipt' ? 'Struk pelanggan' : 'Tiket dapur'}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([32, 48] as const).map((n) => (
          <Button key={n} type="button" variant={chars === n ? 'secondary' : 'ghost'} className="h-10" onClick={() => { setChars(n); setPaperChars(n) }}>
            Kertas {n === 32 ? '58 mm' : '80 mm'}
          </Button>
        ))}
      </div>
      <ThermalPaper lines={lines} chars={chars} />
      <ErrorAlert message={error} />
      <p className="text-center text-xs text-muted-foreground">Pratinjau dibaca dari perintah yang sama persis dengan yang dikirim ke printer.</p>
    </Panel>
  )
}
