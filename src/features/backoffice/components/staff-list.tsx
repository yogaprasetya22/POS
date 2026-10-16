import { ShieldCheck, UserCheck, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@shared/components/error-alert'
import { Avatar, AvatarFallback } from '@shared/components/ui/avatar'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select'
import { useStaff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import { StaffProfileSchema, StaffRoleSchema, type StaffProfile } from '@shared/types/contracts'

const ROLE_ITEMS = [
  { value: 'cashier', label: 'Kasir' },
  { value: 'owner', label: 'Owner (Pemilik)' },
]
const REMOVE = 'remove'

/**
 * Manajemen Tim & Akses Staf Toko
 * Mengatur peran operasional (Owner vs Kasir) atau mengeluarkan anggota tim.
 */
export function StaffList() {
  const { userId, storeId } = useStaff()
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [newRole, setNewRole] = useState('cashier')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, role')
      .eq('store_id', storeId)
      .order('email')
    if (error) return setError(error.message)
    setStaff(z.array(StaffProfileSchema).parse(data))
  }, [storeId])

  useEffect(() => void load(), [load])

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    setLoading(true)
    const { error } = await p
    setLoading(false)
    setError(error?.message ?? '')
    if (!error) load()
    return !error
  }

  // REMOVE = keluarkan dari toko (role null di database)
  const setRole = (id: string, value: string | null) =>
    run(
      supabase.rpc('set_staff_role', {
        p_user_id: id,
        p_role: !value || value === REMOVE ? null : StaffRoleSchema.parse(value),
      })
    )

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const email = String(new FormData(form).get('email')).trim()
    if (!email) return
    if (await run(supabase.rpc('add_staff', { p_email: email, p_role: StaffRoleSchema.parse(newRole) }))) {
      form.reset()
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Tim & Akses Staf</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Kelola siapa saja yang memiliki akses ke operasional kasir, dapur, dan laporan admin toko Anda.
        </p>
      </div>

      <ErrorAlert message={error} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Staff Members List (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="rounded-2xl border">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  <CardTitle className="text-base font-bold">Daftar Anggota Tim</CardTitle>
                </div>
                <Badge variant="secondary" className="font-medium text-xs">
                  {staff.length} orang terdaftar
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Anggota harus mendaftar akun terlebih dahulu di /register sebelum dapat ditambahkan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {staff.map((s) => {
                  const isCurrentUser = s.user_id === userId
                  const isOwner = s.role === 'owner'
                  return (
                    <div key={s.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-10 border">
                          <AvatarFallback className={isOwner ? 'bg-primary/10 text-primary font-bold' : 'bg-muted text-muted-foreground font-semibold'}>
                            {(s.email?.[0] ?? '?').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate text-foreground">
                              {s.email}
                            </span>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                                Anda
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isOwner ? 'Pemilik Toko (Full Access)' : 'Staf Operasional (Kasir & Dapur)'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <Select
                          value={s.role ?? 'cashier'}
                          disabled={isCurrentUser || loading}
                          onValueChange={(v) => setRole(s.user_id, v)}
                          items={[...ROLE_ITEMS, { value: REMOVE, label: 'Keluarkan dari Toko' }]}
                        >
                          <SelectTrigger
                            aria-label={`Peran staf ${s.email}`}
                            className="w-36 h-9 rounded-xl text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_ITEMS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                            <SelectItem value={REMOVE} className="text-destructive font-medium">
                              Keluarkan dari Toko
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
                {staff.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Belum ada anggota staf yang terdaftar di toko ini.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Add Staff & Role Guidance (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Add Staff Card */}
          <Card className="rounded-2xl border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserPlus className="size-4 text-primary" />
                Tambah Anggota Baru
              </CardTitle>
              <CardDescription className="text-xs">
                Masukkan email staf yang sudah terdaftar untuk diberi akses ke toko ini.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={add} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email Staf</label>
                  <Input
                    name="email"
                    type="email"
                    required
                    placeholder="Contoh: kasir@warkop.com"
                    aria-label="Email staf baru"
                    className="h-10 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Peran / Hak Akses</label>
                  <Select
                    value={newRole}
                    onValueChange={(v) => v && setNewRole(v)}
                    items={ROLE_ITEMS}
                  >
                    <SelectTrigger aria-label="Pilih peran staf baru" className="w-full h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_ITEMS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2 h-10 rounded-xl">
                  <UserPlus className="size-4" /> Tambah Staf
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Role explanation alerts */}
          <div className="space-y-3">
            <div className="rounded-2xl border bg-card p-4 shadow-xs flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div className="text-xs space-y-1">
                <span className="font-bold text-foreground">Peran Owner:</span>
                <p className="text-muted-foreground leading-relaxed">
                  Akses penuh ke seluruh menu Admin, laporan keuangan, pengaturan menu, dan manajemen toko.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-xs flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                <UserCheck className="size-4" />
              </div>
              <div className="text-xs space-y-1">
                <span className="font-bold text-foreground">Peran Kasir:</span>
                <p className="text-muted-foreground leading-relaxed">
                  Fokus operasional: menerima pesanan di POS kasir dan memantau status pesanan di layar dapur.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
