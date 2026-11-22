import { KeyRound, Link2Off, MonitorSmartphone, Plus } from 'lucide-react'
import { BindDeviceDialog } from '@shared/components/bind-device-dialog'
import { getDevice } from '@shared/lib/device-binding'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'

const DeviceSchema = z.object({ id: z.string(), name: z.string(), created_at: z.string(), last_seen_at: z.string().nullable(), revoked_at: z.string().nullable() })
type Device = z.infer<typeof DeviceSchema>
const ago = (iso: string | null) => (iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'belum pernah')

/** Perangkat kasir yang terikat ke toko; manager bisa memutuskannya dari sini. */
export function DevicesCard() {
  const [rows, setRows] = useState<Device[] | null>(null)
  const [binding, setBinding] = useState(false)
  const thisBound = Boolean(getDevice())
  const load = useCallback(async () => {
    const { data } = await supabase.from('devices').select('id,name,created_at,last_seen_at,revoked_at').is('revoked_at', null).order('created_at')
    setRows(z.array(DeviceSchema).safeParse(data ?? []).data ?? [])
  }, [])
  useEffect(() => void load(), [load])

  const unbind = async (d: Device) => {
    if (!window.confirm(`Putuskan perangkat "${d.name}"? Kasir tidak bisa lagi masuk pakai PIN di perangkat itu.`)) return
    const { error } = await rpc('unbind_device', { p_device: d.id })
    if (error) return toast.error('Gagal memutuskan perangkat', { description: error.message })
    toast.success(`Perangkat "${d.name}" diputus`)
    void load()
  }

  return (
    <Card className="rounded-2xl border">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold"><MonitorSmartphone className="size-5 text-primary" /> Perangkat kasir</CardTitle>
        <CardDescription className="text-xs">
          Buka halaman ini <strong>di tablet/PC kasir</strong> (login sebagai owner/manager), lalu tekan tombol di bawah. Setelah itu kasir cukup pilih nama + PIN.
        </CardDescription>
        {!thisBound && (
          <Button className="mt-2 h-10 w-fit gap-1.5" onClick={() => setBinding(true)}>
            <Plus className="size-4" /> Jadikan perangkat ini perangkat kasir
          </Button>
        )}
        {binding && <BindDeviceDialog onClose={() => setBinding(false)} />}
      </CardHeader>
      <CardContent className="p-0">
        {rows === null ? (
          <p className="p-4 text-sm text-muted-foreground">Memuat…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Belum ada perangkat yang diaktifkan.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">Aktif sejak {ago(d.created_at)} · terakhir dipakai {ago(d.last_seen_at)}</p>
                </div>
                <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void unbind(d)}>
                  <Link2Off className="size-4" /> Putuskan
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Manager mengatur/mereset PIN staf. PIN disimpan bcrypt di database. */
export function StaffPinDialog({ userId, name, hasPin, onClose, onSaved }: { userId: string; name: string; hasPin: boolean; onClose: () => void; onSaved: () => void }) {
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = /^\d{4,6}$/.test(pin) && pin === pin2

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return setError(pin !== pin2 ? 'PIN tidak sama' : 'PIN harus 4–6 angka')
    setBusy(true)
    const { error: err } = await rpc('set_staff_pin', { p_user: userId, p_pin: pin })
    setBusy(false)
    if (err) return setError(err.message)
    toast.success(`PIN ${name} disimpan`, { description: 'Beritahukan PIN ini langsung ke orangnya, jangan lewat chat grup.' })
    onSaved()
    onClose()
  }

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={save} className="space-y-4">
          <DialogTitle className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /> {hasPin ? 'Reset' : 'Atur'} PIN · {name}</DialogTitle>
          <DialogDescription>PIN 4–6 angka untuk masuk di perangkat kasir. {hasPin && 'PIN lama langsung tidak berlaku.'}</DialogDescription>
          <Input type="password" inputMode="numeric" autoComplete="new-password" placeholder="PIN baru" value={pin} onChange={(e) => setPin(digits(e.target.value))} className="h-12 text-center text-2xl tracking-[0.5em]" aria-label="PIN baru" autoFocus />
          <Input type="password" inputMode="numeric" autoComplete="new-password" placeholder="Ulangi PIN" value={pin2} onChange={(e) => setPin2(digits(e.target.value))} className="h-12 text-center text-2xl tracking-[0.5em]" aria-label="Ulangi PIN" />
          {error && <p className="text-sm text-amber-700">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>Batal</Button>
            <Button type="submit" className="h-11" disabled={busy || !valid}>{busy ? 'Menyimpan…' : 'Simpan PIN'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
