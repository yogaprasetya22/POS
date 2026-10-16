import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Plus,
  Receipt,
  Search,
  Store as StoreIcon,
  TrendingUp,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@shared/components/error-alert'
import { ToneBadge } from '@shared/components/tone-badge'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardHeader } from '@shared/components/ui/card'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@shared/components/ui/drawer'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { PageSkeleton } from '@shared/components/page-skeleton'
import { Switch } from '@shared/components/ui/switch'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import { StoreInputSchema, StoreRowSchema, type StoreRow } from '@shared/types/contracts'

/**
 * Halaman Super Admin: Kelola Seluruh Toko (/super)
 * Menggunakan keseragaman kontainer (`space-y-6 p-4 md:p-6`), metrik KPI global,
 * filter pencarian, dan Drawer formulir toko berbasis prinsip Ponytail.
 */
export function SuperPage() {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [editing, setEditing] = useState<StoreRow | 'new' | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('list_stores_with_sales')
    setLoading(false)
    if (error) return setError(error.message)
    setStores(z.array(StoreRowSchema).parse(data))
  }, [])

  useEffect(() => void load(), [load])

  const toggleActive = async (s: StoreRow) => {
    const { error } = await supabase.rpc('save_store', {
      p_id: s.id,
      p_slug: s.slug,
      p_name: s.name,
      p_wa: s.wa_number,
      p_active: !s.is_active,
    })
    setError(error?.message ?? '')
    load()
  }

  const save = async (e: FormEvent<HTMLFormElement>, active: boolean) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const parsed = StoreInputSchema.safeParse({
      slug: f.get('slug'),
      name: f.get('name'),
      wa_number: f.get('wa_number'),
      is_active: active,
      owner_email: String(f.get('owner_email') ?? '').trim(),
    })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    const v = parsed.data

    const saved = await supabase.rpc('save_store', {
      p_id: editing === 'new' ? null : editing?.id,
      p_slug: v.slug,
      p_name: v.name,
      p_wa: v.wa_number,
      p_active: v.is_active,
    })
    if (saved.error) {
      return setError(
        saved.error.message.includes('stores_slug_key') ? 'Slug sudah dipakai toko lain' : saved.error.message
      )
    }

    if (v.owner_email) {
      const { error } = await supabase.rpc('assign_owner', {
        p_store_id: saved.data,
        p_email: v.owner_email,
      })
      if (error) {
        load()
        return setError(`Toko tersimpan, tapi owner gagal ditunjuk: ${error.message}`)
      }
    }
    setError('')
    setEditing(null)
    load()
  }

  const totalSales = useMemo(() => stores.reduce((sum, s) => sum + s.sales_today, 0), [stores])
  const totalOrders = useMemo(() => stores.reduce((sum, s) => sum + s.orders_today, 0), [stores])
  const activeStores = useMemo(() => stores.filter((s) => s.is_active), [stores])

  const q = query.trim().toLowerCase()
  const shownStores = useMemo(() => {
    return stores.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.owner_emails ?? '').toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.is_active) ||
        (statusFilter === 'inactive' && !s.is_active)
      return matchesSearch && matchesStatus
    })
  }, [stores, q, statusFilter])

  if (loading && stores.length === 0) return <PageSkeleton />

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header Banner - Standardized with Backoffice */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-primary/5 text-xs font-medium">
              <Building2 className="size-3" />
              Super Admin Platform
            </Badge>
            <span className="text-xs text-muted-foreground">{stores.length} gerai terdaftar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Kelola Seluruh Toko
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Pantau ringkasan performa penjualan semua cabang dan kelola akses kepemilikan gerai.
          </p>
        </div>

        <Button onClick={() => setEditing('new')} className="gap-2 shadow-xs shadow-primary/20 shrink-0">
          <Plus className="size-4" /> Toko Baru
        </Button>
      </div>

      <ErrorAlert message={error} />

      {/* Global KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Gerai
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">{stores.length} Toko</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeStores.length} aktif beroperasi
          </p>
        </Card>

        <Card className="rounded-2xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Omzet Hari Ini
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">{rupiah(totalSales)}</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Akumulasi seluruh cabang
          </p>
        </Card>

        <Card className="rounded-2xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Transaksi
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">{totalOrders} Pesanan</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selesai terbayar hari ini
          </p>
        </Card>

        <Card className="rounded-2xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status Operasional
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">
            {stores.length > 0 ? Math.round((activeStores.length / stores.length) * 100) : 0}%
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rasio gerai aktif
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-44 sm:min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari toko berdasarkan nama, slug, atau email owner..."
            aria-label="Cari toko"
            className="pl-10 h-10 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border bg-card p-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-2.5 py-1 transition-all ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Semua ({stores.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`rounded-lg px-2.5 py-1 transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Aktif ({activeStores.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`rounded-lg px-2.5 py-1 transition-all ${
              statusFilter === 'inactive'
                ? 'bg-destructive text-white font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Nonaktif ({stores.length - activeStores.length})
          </button>
        </div>
      </div>

      {/* Store Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shownStores.map((s) => (
          <Card key={s.id} className="rounded-2xl border transition-all hover:border-primary/40 hover:shadow-md">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="size-4 text-primary shrink-0" />
                    <span className="font-bold text-base truncate text-foreground">{s.name}</span>
                  </div>
                  <a
                    href={`/s/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline mt-0.5"
                  >
                    /s/{s.slug} <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
                <ToneBadge tone={s.is_active ? 'green' : 'gray'}>
                  {s.is_active ? 'Aktif' : 'Nonaktif'}
                </ToneBadge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="size-3.5 shrink-0" />
                <span className="truncate">Owner: <strong className="text-foreground">{s.owner_emails ?? 'Belum ada owner'}</strong></span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl border bg-muted/30 p-2.5">
                  <div className="text-[11px] text-muted-foreground">Omzet Hari Ini</div>
                  <div className="font-bold text-sm text-foreground mt-0.5">{rupiah(s.sales_today)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-2.5">
                  <div className="text-[11px] text-muted-foreground">Transaksi</div>
                  <div className="font-bold text-sm text-foreground mt-0.5">{s.orders_today} pesanan</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setEditing(s)} className="rounded-xl text-xs h-8">
                  Ubah Toko
                </Button>
                <Button
                  variant={s.is_active ? 'destructive' : 'secondary'}
                  size="sm"
                  onClick={() => toggleActive(s)}
                  className="rounded-xl text-xs h-8"
                >
                  {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {shownStores.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
            <StoreIcon className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold text-foreground">Tidak ada gerai yang cocok</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stores.length === 0 ? 'Belum ada toko yang terdaftar.' : 'Coba ubah kata kunci pencarian.'}
            </p>
          </div>
        )}
      </div>

      {/* Store Form Drawer - Standardized Drawer with ProductForm */}
      {editing && (
        <StoreDrawer
          store={editing === 'new' ? null : editing}
          onSubmit={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function StoreDrawer({
  store,
  onSubmit,
  onClose,
}: {
  store: StoreRow | null
  onSubmit: (e: FormEvent<HTMLFormElement>, active: boolean) => void
  onClose: () => void
}) {
  const [active, setActive] = useState(store?.is_active ?? true)

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} swipeDirection="right">
      <DrawerContent style={{ '--drawer-content-width': 'min(100vw, 30rem)' } as React.CSSProperties}>
        <DrawerHeader className="border-b text-left">
          <DrawerTitle>{store ? `Ubah ${store.name}` : 'Tambah Toko Baru'}</DrawerTitle>
          <DrawerDescription>
            {store
              ? 'Perbarui data toko, nomor WhatsApp kasir, dan email owner.'
              : 'Daftarkan cabang baru ke dalam sistem multi-outlet.'}
          </DrawerDescription>
        </DrawerHeader>

        <form id="store-form" onSubmit={(e) => onSubmit(e, active)} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-none">
          <div className="space-y-1.5">
            <Label htmlFor="input-name" className="text-xs font-semibold">Nama Toko</Label>
            <Input id="input-name" name="name" required placeholder="Contoh: Kopi Nusantara Tebet" defaultValue={store?.name} className="h-10 rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-slug" className="text-xs font-semibold">Slug URL (Unik)</Label>
            <Input id="input-slug" name="slug" required placeholder="kopi-nusantara-tebet" defaultValue={store?.slug} className="h-10 rounded-xl font-mono text-xs" />
            <p className="text-[11px] text-muted-foreground">Dipakai untuk link pelanggan: /s/slug-toko</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-wa" className="text-xs font-semibold">Nomor WhatsApp Kasir</Label>
            <Input id="input-wa" name="wa_number" required placeholder="6281234567890" inputMode="numeric" defaultValue={store?.wa_number} className="h-10 rounded-xl font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-owner" className="text-xs font-semibold">Email Owner (Opsional)</Label>
            <Input id="input-owner" name="owner_email" type="email" placeholder="owner@gmail.com" defaultValue={store?.owner_emails ?? ''} className="h-10 rounded-xl" />
            <p className="text-[11px] text-muted-foreground">Owner harus sudah mendaftar akun terlebih dahulu di /register.</p>
          </div>

          <div className="flex items-center justify-between rounded-2xl border p-3.5">
            <div>
              <span className="block font-semibold text-xs">Status Toko</span>
              <span className="text-[11px] text-muted-foreground">Toko aktif dapat menerima pesanan pelanggan.</span>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </form>

        <DrawerFooter className="flex-row border-t pt-3">
          <DrawerClose render={<Button type="button" variant="ghost">Batal</Button>} />
          <Button form="store-form" className="flex-1 rounded-xl">
            {store ? 'Simpan Perubahan' : 'Buat Toko'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
