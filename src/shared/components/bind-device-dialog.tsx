import { CheckCircle2, MonitorSmartphone } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { bindThisDevice, lockDevice } from '@shared/lib/device-binding'

/** Owner/manager yang sedang login menjadikan perangkat ini perangkat kasir (satu langkah). */
export function BindDeviceDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('Kasir 1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await bindThisDevice(name.trim() || 'Kasir')
      await lockDevice() // akun owner/manager keluar, layar PIN siap untuk kasir
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={go} className="space-y-4">
          <DialogTitle className="flex items-center gap-2"><MonitorSmartphone className="size-5 text-primary" /> Jadikan perangkat kasir</DialogTitle>
          <DialogDescription>Setelah ini, siapa pun yang memakai perangkat ini masuk dengan memilih nama lalu PIN.</DialogDescription>
          <ul className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Akunmu akan keluar dan layar berganti ke layar PIN.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Pastikan staf sudah punya PIN (Admin → Tim → Atur PIN).</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Bisa diputus kapan saja dari Admin → Tim → Perangkat kasir.</li>
          </ul>
          <div className="space-y-1.5">
            <label htmlFor="bind-name" className="text-sm font-semibold">Nama perangkat</label>
            <Input id="bind-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11" placeholder="Contoh: Kasir depan" autoFocus />
          </div>
          {error && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>Batal</Button>
            <Button type="submit" className="h-11 font-bold" disabled={busy}>{busy ? 'Memproses…' : 'Aktifkan'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
