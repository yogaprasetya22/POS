import { Award, CalendarDays, LogOut, QrCode, ShoppingBag, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@shared/components/ui/button'
import { claimMemberLink, leaveMember, loadMemberCards, type MemberCard } from '@shared/lib/member-session'
import { rupiah } from '@shared/lib/utils'

const date = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })

/** Halaman member di HP pelanggan: /member?t=TOKEN (dari QR kasir) atau /member (sesi tersimpan). */
export function MemberPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState<MemberCard[] | null>(null)
  const [error, setError] = useState('')
  const [justLinked, setJustLinked] = useState(false)

  useEffect(() => {
    let alive = true
    const t = params.get('t')
    ;(async () => {
      try {
        if (t) {
          await claimMemberLink(t)
          if (alive) setJustLinked(true)
          navigate('/member', { replace: true }) // buang token dari alamat
        }
        const c = await loadMemberCards()
        if (alive) setCards(c)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
        setCards(await loadMemberCards().catch(() => []))
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const leave = async (c: MemberCard) => {
    if (!window.confirm(`Keluarkan HP ini dari member ${c.store_name}? Poin tetap aman, kamu bisa masuk lagi lewat QR kasir.`)) return
    await leaveMember(c.member_id)
    setCards((x) => x?.filter((y) => y.member_id !== c.member_id) ?? null)
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 bg-muted/30 p-4 pb-10">
      <h1 className="pt-2 text-2xl font-extrabold tracking-tight">Kartu member</h1>

      {error && <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
      {justLinked && !error && (
        <p className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Berhasil!</strong> HP ini sudah terhubung. Lain kali cukup buka halaman ini, tanpa login lagi.
        </p>
      )}

      {cards === null ? (
        <div className="h-48 animate-pulse rounded-3xl bg-muted" />
      ) : cards.length === 0 ? (
        <div className="space-y-3 rounded-3xl border-2 border-dashed bg-card p-6 text-center">
          <QrCode className="mx-auto size-12 text-muted-foreground" />
          <p className="text-lg font-bold">Belum terhubung ke member</p>
          <p className="text-muted-foreground">Saat bayar di kasir, sebutkan nomor HP-mu lalu minta <strong>QR member</strong>. Scan QR itu dengan kamera HP ini.</p>
        </div>
      ) : (
        cards.map((c) => (
          <section key={c.member_id} className="space-y-4">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow-lg">
              <p className="flex items-center gap-1.5 text-sm font-semibold opacity-90"><Store className="size-4" /> {c.store_name}</p>
              <p className="mt-4 text-sm opacity-80">Poin kamu</p>
              <p className="text-5xl font-black tabular-nums">{c.points.toLocaleString('id-ID')}</p>
              {c.points_value > 0 && c.points > 0 && <p className="text-sm opacity-90">Bisa ditukar potongan {rupiah(c.points * c.points_value)}</p>}
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-sm opacity-80">Nomor member</p>
                  <p className="font-mono text-lg font-bold tracking-wider">•••• {c.phone_tail}</p>
                </div>
                <p className="text-right text-xs opacity-80">Member sejak<br />{date(c.since)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 bg-card p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> Kunjungan</p>
                <p className="text-xl font-bold tabular-nums">{c.visits}×</p>
              </div>
              <div className="rounded-2xl border-2 bg-card p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShoppingBag className="size-3.5" /> Total belanja</p>
                <p className="text-xl font-bold tabular-nums">{rupiah(c.total_spent)}</p>
              </div>
            </div>

            <div className="rounded-2xl border-2 bg-card">
              <p className="border-b px-4 py-3 font-bold">Belanja terakhir</p>
              {c.orders.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Belum ada belanja.</p>
              ) : (
                <ul className="divide-y">
                  {c.orders.map((o) => (
                    <li key={o.queue + o.paid_at} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>
                        <span className="font-mono font-semibold">{o.queue}</span>
                        <span className="block text-xs text-muted-foreground">{o.paid_at ? date(o.paid_at) : ''}</span>
                      </span>
                      <span className="text-right">
                        <span className="font-semibold tabular-nums">{rupiah(o.total)}</span>
                        {o.points > 0 && <span className="flex items-center justify-end gap-1 text-xs text-emerald-700"><Award className="size-3" /> +{o.points} poin</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to={`/s/${c.store_slug}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90">Pesan lagi</Link>
              <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => void leave(c)}>
                <LogOut /> Keluar
              </Button>
            </div>
          </section>
        ))
      )}
    </main>
  )
}
