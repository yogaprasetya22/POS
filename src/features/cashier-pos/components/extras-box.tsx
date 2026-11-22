import { Gift, QrCode, Search, Ticket, UserPlus, X } from 'lucide-react'
import { MemberQrDialog } from '@shared/components/member-qr-dialog'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { rpc } from '@shared/lib/api'
import { loyaltyOn } from '@shared/lib/store-config'
import { supabase } from '@shared/lib/supabase'
import { formatPhone, rupiah } from '@shared/lib/utils'
import { MemberSchema, type Member, type Quote, type StoreConfig } from '@shared/types/contracts'

type Props = {
  config: StoreConfig | null
  code: string
  onCode: (code: string) => void
  member: Member | null
  onMember: (m: Member | null) => void
  redeem: number
  onRedeem: (points: number) => void
  quote: Quote | null
  /** true selagi total sedang dihitung ulang (hasil lama belum boleh dipakai menilai kode) */
  checking?: boolean
}

/** Kode promo/voucher, member, dan tukar poin untuk satu pesanan. */
export function ExtrasBox({ config, code, onCode, member, onMember, redeem, onRedeem, quote, checking = false }: Props) {
  const [draftCode, setDraftCode] = useState('')
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Member[]>([])
  const [qrOpen, setQrOpen] = useState(false)
  const [error, setError] = useState('')
  const loyalty = loyaltyOn(config)
  const looksLikePhone = /^[0-9+\s-]{8,}$/.test(q.trim())

  useEffect(() => {
    const term = q.trim()
    if (!loyalty || term.length < 2 || member) return setFound([])
    const t = setTimeout(async () => {
      const safe = term.replace(/[%,()]/g, '')
      const digits = safe.replace(/\D/g, '')
      const phone = digits ? (digits.startsWith('0') ? '62' + digits.slice(1) : digits) : safe
      const { data } = await supabase.from('members').select('*').ilike('phone', `%${phone}%`).limit(5)
      const parsed = z.array(MemberSchema).safeParse(data ?? [])
      setFound(parsed.success ? parsed.data : [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, loyalty, member])

  const register = async () => {
    const { data, error: err } = await rpc('upsert_member', { p_phone: q })
    if (err) return setError(err.message)
    const parsed = MemberSchema.safeParse(data)
    if (parsed.success) {
      onMember(parsed.data)
      setQ('')
      setError('')
    }
  }

  const codeApplied = code !== ''
  const codeWorks = !!quote && (quote.promo_discount > 0 || quote.voucher_discount > 0)

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Kode promo / voucher</p>
        {codeApplied ? (
          <div className="flex h-11 items-center justify-between rounded-lg border px-3 text-sm">
            <span className="flex items-center gap-2">
              <Ticket className="size-4" />
              <span className="font-mono font-semibold">{code}</span>
              {checking ? <span className="text-muted-foreground">memeriksa…</span> : quote && <span className={codeWorks ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{codeWorks ? 'terpasang' : 'tidak berlaku'}</span>}
            </span>
            <button type="button" aria-label="Hapus kode" className="grid size-9 place-items-center text-muted-foreground" onClick={() => onCode('')}>
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (draftCode.trim()) {
                onCode(draftCode.trim().toUpperCase())
                setDraftCode('')
              }
            }}
          >
            <Input value={draftCode} onChange={(e) => setDraftCode(e.target.value.toUpperCase())} placeholder="Opsional" className="h-11 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case" maxLength={20} aria-label="Kode promo atau voucher" />
            <Button type="submit" variant="outline" className="h-11 px-4" disabled={!draftCode.trim()}>Pakai</Button>
          </form>
        )}
      </div>

      {loyalty && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Member</p>
          {member ? (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono font-semibold">{formatPhone(member.phone)}</p>
                  <p className="text-muted-foreground">{member.points} poin</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setQrOpen(true)} title="Pelanggan scan untuk melihat poin di HP-nya">
                    <QrCode className="size-4" /> QR member
                  </Button>
                  <button type="button" aria-label="Lepas member" className="grid size-9 place-items-center text-muted-foreground" onClick={() => { onMember(null); onRedeem(0) }}>
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              {qrOpen && <MemberQrDialog memberId={member.id} memberName={formatPhone(member.phone)} onClose={() => setQrOpen(false)} />}
              {config && config.points_value > 0 && member.points > 0 && (
                <Button
                  type="button"
                  variant={redeem > 0 ? 'default' : 'outline'}
                  className="h-11 w-full"
                  onClick={() => onRedeem(redeem > 0 ? 0 : member.points)}
                >
                  <Gift />
                  {redeem > 0 ? `Poin dipakai: ${quote?.points_redeemed ?? redeem} (−${rupiah(quote?.points_discount ?? 0)})` : `Tukar poin (1 poin = ${rupiah(config.points_value)})`}
                </Button>
              )}
              {quote && quote.points_earned > 0 && <p className="text-xs text-muted-foreground">Dapat +{quote.points_earned} poin dari pesanan ini.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={q} inputMode="tel" onChange={(e) => setQ(e.target.value)} placeholder="Nomor HP member (08…)" aria-label="Cari member" className="h-11 pl-9" />
              </div>
              {found.map((m) => (
                <button key={m.id} type="button" onClick={() => { onMember(m); setQ('') }} className="flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-sm hover:bg-muted">
                  <span className="font-mono font-medium">{formatPhone(m.phone)}</span>
                  <span className="text-muted-foreground">{m.points} poin</span>
                </button>
              ))}
              {q.trim().length >= 2 && found.length === 0 && looksLikePhone && (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={register}>
                  <UserPlus /> Daftarkan {q.trim()} jadi member
                </Button>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
