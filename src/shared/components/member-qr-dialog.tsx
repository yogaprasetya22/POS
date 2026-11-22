import { CheckCircle2, RefreshCw, Smartphone } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog'
import { rpc } from '@shared/lib/api'
import { memberLinkUrl } from '@shared/lib/member-session'

type Link = { token: string; expires_at: string; member_name: string }

/** Kasir menampilkan QR sekali pakai; pelanggan scan dengan HP-nya untuk masuk ke akun member. */
export function MemberQrDialog({ memberId, memberName, onClose }: { memberId: string; memberName: string; onClose: () => void }) {
  const [link, setLink] = useState<Link | null>(null)
  const [img, setImg] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const make = useCallback(async () => {
    setError('')
    setImg('')
    const { data, error: err } = await rpc('create_member_link', { p_member: memberId })
    if (err) return setError(err.message)
    const l = data as Link
    setLink(l)
    const { default: QRCode } = await import('qrcode')
    setImg(await QRCode.toDataURL(memberLinkUrl(l.token), { margin: 1, width: 320 }))
  }, [memberId])

  useEffect(() => {
    void make()
  }, [make])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const left = link ? Math.max(0, Math.floor((new Date(link.expires_at).getTime() - now) / 1000)) : 0
  const expired = Boolean(link) && left === 0

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-6 text-center sm:max-w-sm">
        <DialogTitle className="text-xl font-bold">QR member {memberName}</DialogTitle>
        <DialogDescription>Minta pelanggan scan pakai kamera HP-nya. Setelah itu poinnya bisa dilihat kapan saja tanpa login lagi.</DialogDescription>

        <div className="mx-auto grid size-64 place-items-center rounded-2xl border-2 bg-white p-2">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : expired ? (
            <p className="text-sm text-muted-foreground">QR kedaluwarsa</p>
          ) : img ? (
            <img src={img} alt="QR masuk member" className="size-full" />
          ) : (
            <span className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          )}
        </div>

        {link && !expired && (
          <p className="text-sm text-muted-foreground tabular-nums">
            Berlaku {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} · hanya bisa dipakai sekali
          </p>
        )}

        <ul className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-left text-sm">
          <li className="flex gap-2"><Smartphone className="mt-0.5 size-4 shrink-0 text-primary" /> Buka kamera HP pelanggan, arahkan ke QR.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Ganti HP? Tampilkan QR ini lagi.</li>
        </ul>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => void make()}>
            <RefreshCw /> QR baru
          </Button>
          <Button className="h-11" onClick={onClose}>Selesai</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
