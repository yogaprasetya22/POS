import { Gift, Plus, Ticket, Trash2, UserPlus } from 'lucide-react'
import { CurrencyInput } from '@shared/components/currency-input'
import { RowsSkeleton } from '@shared/components/skeletons'
import { useState } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { EmptyState, LoadMore, SearchBox } from '@shared/components/pagination'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { rpc } from '@shared/lib/api'
import { usePaged } from '@shared/lib/use-paged'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import { MemberSchema, type Member, type StoreConfig } from '@shared/types/contracts'

const VoucherSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  kind: z.enum(['AMOUNT', 'PERCENT']),
  value: z.number(),
  member_id: z.string().nullable(),
  expires_at: z.string().nullable(),
  redeemed_at: z.string().nullable(),
  note: z.string(),
})
type Voucher = z.infer<typeof VoucherSchema>

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanpa batas')

/** Member (poin loyalti) dan voucher sekali pakai. */
export function MembersTab({ config }: { config: StoreConfig | null }) {
  const [error, setError] = useState('')
  const [adjusting, setAdjusting] = useState<Member | null>(null)
  const [newMember, setNewMember] = useState({ phone: '', name: '' })
  const [v, setV] = useState({ code: '', kind: 'AMOUNT' as 'AMOUNT' | 'PERCENT', value: '', days: '30', note: '' })

  // Pagination di server: hanya satu halaman yang diunduh; pencarian nama/HP dikerjakan database.
  const members = usePaged<Member>(async ({ from, to }, term) => {
    let q = supabase.from('members').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
    if (term) {
      const safe = term.replace(/[%,()]/g, '')
      const digits = safe.replace(/\D/g, '')
      const phone = digits ? (digits.startsWith('0') ? '62' + digits.slice(1) : digits) : safe
      q = q.or(`phone.ilike.%${phone}%,name.ilike.%${safe}%`)
    }
    const r = await q
    return { ...r, data: z.array(MemberSchema).safeParse(r.data ?? []).data ?? [] }
  }, { pageSize: 25, append: true })
  const vouchers = usePaged<Voucher>(
    async ({ from, to }) => {
      const r = await supabase.from('vouchers').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
      return { ...r, data: z.array(VoucherSchema).safeParse(r.data ?? []).data ?? [] }
    },
    { pageSize: 10, append: true },
  )
  const load = () => {
    members.reload()
    vouchers.reload()
  }

  const act = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: err } = await p
    setError(err?.message ?? '')
    if (!err) load()
    return !err
  }

  const loyaltyOff = !config || config.points_earn_per === 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Member &amp; Voucher</h2>
        <p className="text-sm text-muted-foreground">Poin didapat dari belanja dan bisa ditukar jadi potongan. Voucher dipakai sekali lewat kolom kode di kasir.</p>
      </div>
      {loyaltyOff && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Program poin belum aktif. Atur &quot;Rp belanja per 1 poin&quot; di Pengaturan Toko untuk mengaktifkannya (voucher tetap bisa dipakai).
        </p>
      )}
      <ErrorAlert message={error} />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="size-5" /> Member ({members.total.toLocaleString('id-ID')})</CardTitle>
            <CardDescription>Member juga bisa didaftarkan langsung dari layar kasir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input aria-label="Nomor HP" placeholder="Nomor HP" inputMode="numeric" value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} className="h-11" />
              <Input aria-label="Nama" placeholder="Nama" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} className="h-11" maxLength={60} />
              <Button className="h-11" disabled={!newMember.phone || !newMember.name.trim()} onClick={async () => { if (await act(rpc('upsert_member', { p_phone: newMember.phone, p_name: newMember.name }).then((r) => ({ error: r.error })))) setNewMember({ phone: '', name: '' }) }}>
                <UserPlus /> Tambah
              </Button>
            </div>
            <SearchBox value={members.search} onChange={members.setSearch} placeholder="Cari nama / nomor HP" />
            <ul className="divide-y">
              {members.rows.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-sm text-muted-foreground">{m.phone} · {m.visits}× datang · {rupiah(m.total_spent)}</p>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">{m.points} poin</Badge>
                  <Button variant="outline" size="sm" className="h-10" onClick={() => setAdjusting(m)}>Atur poin</Button>
                </li>
              ))}
            </ul>
            {members.loading && members.rows.length === 0 && <RowsSkeleton rows={4} className="-mx-4" />}
            {members.rows.length === 0 && !members.loading && (
              <EmptyState title={members.search ? 'Member tidak ditemukan' : 'Belum ada member'} hint={members.search ? 'Coba nama atau nomor HP lain.' : 'Daftarkan lewat form di atas atau langsung dari layar kasir.'} />
            )}
            <LoadMore shown={members.rows.length} total={members.total} pageSize={members.pageSize} onMore={members.more} loading={members.loading} noun="member" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="size-5" /> Voucher</CardTitle>
            <CardDescription>Kode sekali pakai: potongan nominal atau persen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(['AMOUNT', 'PERCENT'] as const).map((k) => (
                <Button key={k} type="button" variant={v.kind === k ? 'default' : 'outline'} className="h-11" onClick={() => setV({ ...v, kind: k })}>
                  {k === 'AMOUNT' ? 'Potongan Rp' : 'Potongan %'}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-code">Kode</Label>
                <Input id="v-code" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="Otomatis" className="h-11 font-mono" maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-val">{v.kind === 'AMOUNT' ? 'Nominal (Rp)' : 'Persen'}</Label>
                {v.kind === 'AMOUNT' ? (
                  <CurrencyInput id="v-val" value={v.value} onValueChange={(raw) => setV({ ...v, value: raw })} className="h-11" />
                ) : (
                  <Input id="v-val" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" className="h-11" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-days">Berlaku (hari)</Label>
                <Input id="v-days" value={v.days} onChange={(e) => setV({ ...v, days: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className="h-11" />
              </div>
            </div>
            <Input aria-label="Catatan" placeholder="Catatan (opsional)" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className="h-11" maxLength={100} />
            <Button
              className="h-11 w-full"
              disabled={!v.value}
              onClick={async () => {
                const days = Number(v.days)
                const ok = await act(
                  rpc('create_voucher', {
                    p_code: v.code || null,
                    p_kind: v.kind,
                    p_value: Number(v.value),
                    p_member: null,
                    p_expires: days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
                    p_note: v.note,
                  }).then((r) => ({ error: r.error })),
                )
                if (ok) setV({ ...v, code: '', value: '', note: '' })
              }}
            >
              <Plus /> Buat voucher
            </Button>
            <ul className="divide-y">
              {vouchers.rows.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold">{x.code}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {x.kind === 'AMOUNT' ? rupiah(x.value) : `${x.value}%`} · s/d {fmtDate(x.expires_at)}{x.note && ` · ${x.note}`}
                    </p>
                  </div>
                  {x.redeemed_at ? (
                    <Badge variant="secondary">Terpakai</Badge>
                  ) : (
                    <Button variant="ghost" size="icon" aria-label={`Hapus voucher ${x.code}`} className="text-destructive" onClick={() => act(rpc('delete_voucher', { p_id: x.id }).then((r) => ({ error: r.error })))}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {vouchers.loading && vouchers.rows.length === 0 && <RowsSkeleton rows={3} className="-mx-4" />}
            {vouchers.rows.length === 0 && !vouchers.loading && <EmptyState title="Belum ada voucher" hint="Buat voucher nominal atau persen di atas." />}
            <LoadMore shown={vouchers.rows.length} total={vouchers.total} pageSize={vouchers.pageSize} onMore={vouchers.more} loading={vouchers.loading} noun="voucher" />
          </CardContent>
        </Card>
      </div>

      {adjusting && (
        <AdjustPoints
          member={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={async (delta, reason) => {
            const ok = await act(rpc('adjust_points', { p_member: adjusting.id, p_delta: delta, p_reason: reason }).then((r) => ({ error: r.error })))
            if (ok) setAdjusting(null)
          }}
        />
      )}
    </div>
  )
}

function AdjustPoints({ member, onClose, onSave }: { member: Member; onClose: () => void; onSave: (delta: number, reason: string) => void }) {
  const [delta, setDelta] = useState('')
  const [sign, setSign] = useState<1 | -1>(1)
  const [reason, setReason] = useState('')
  const n = (Number(delta) || 0) * sign
  return (
    <Panel
      onClose={onClose}
      title="Atur poin"
      description={`${member.name} · saldo ${member.points} poin`}
      footer={<Button size="lg" className="h-12 w-full" disabled={n === 0 || reason.trim().length < 3} onClick={() => onSave(n, reason)}>Simpan</Button>}
    >
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={sign === 1 ? 'default' : 'outline'} className="h-11" onClick={() => setSign(1)}>Tambah</Button>
        <Button type="button" variant={sign === -1 ? 'default' : 'outline'} className="h-11" onClick={() => setSign(-1)}>Kurangi</Button>
      </div>
      <Input aria-label="Jumlah poin" inputMode="numeric" placeholder="Jumlah poin" value={delta} onChange={(e) => setDelta(e.target.value.replace(/\D/g, ''))} className="h-12 text-lg" />
      <Input aria-label="Alasan" placeholder="Alasan (wajib)" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" maxLength={100} />
      <p className="text-xs text-muted-foreground">Perubahan poin tercatat di log audit.</p>
    </Panel>
  )
}
