import { CheckCircle2, MessageSquare, Save, Store as StoreIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { supabase } from '@shared/lib/supabase'
import { StoreSettingsSchema, type Store } from '@shared/types/contracts'
import { StoreLink } from './store-link'

type Props = {
  store: Store
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
  fail: (message: string) => void
}

/**
 * Tab Pengaturan Profil Toko & WhatsApp Notifikasi Kasir
 */
export function StoreTab({ store, run, fail }: Props) {
  const [busy, setBusy] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSavedSuccess(false)
    const f = new FormData(e.currentTarget)
    const parsed = StoreSettingsSchema.safeParse({
      name: f.get('name'),
      wa_number: f.get('wa_number'),
    })
    if (!parsed.success) return fail(parsed.error.issues[0].message)

    setBusy(true)
    await run(supabase.from('stores').update(parsed.data).eq('id', store.id))
    setBusy(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Pengaturan Toko</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Kelola informasi nama usaha, nomor WhatsApp kasir penerima pesanan, dan tautan katalog mandiri.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form Pengaturan Toko */}
        <Card className="rounded-2xl border">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StoreIcon className="size-5 text-primary" />
                <CardTitle className="text-base font-bold">Profil Usaha</CardTitle>
              </div>
              <Badge variant={store.is_active ? 'default' : 'secondary'} className="text-xs">
                {store.is_active ? 'Toko Aktif' : 'Toko Non-aktif'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Informasi ini tampil pada halaman katalog pemesanan pelanggan.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4">
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="store-name" className="text-xs font-semibold">
                  Nama Toko / Usaha
                </Label>
                <Input
                  id="store-name"
                  name="name"
                  defaultValue={store.name}
                  required
                  placeholder="Contoh: Kopi Nusantara"
                  className="rounded-xl h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="store-wa" className="text-xs font-semibold flex items-center justify-between">
                  <span>Nomor WhatsApp Kasir</span>
                  <span className="text-[11px] font-normal text-muted-foreground">Wajib diawali 62...</span>
                </Label>
                <div className="relative">
                  <MessageSquare className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="store-wa"
                    name="wa_number"
                    defaultValue={store.wa_number}
                    placeholder="6281234567890"
                    inputMode="numeric"
                    required
                    className="pl-10 rounded-xl h-10 text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Nomor ini akan menerima pesan ringkasan pesanan via WhatsApp saat pelanggan melakukan checkout mandiri.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={busy} className="gap-2 rounded-xl">
                  <Save className="size-4" />
                  {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
                {savedSuccess && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 animate-in fade-in">
                    <CheckCircle2 className="size-4" /> Tersimpan!
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tautan & Generator QR Toko */}
        <StoreLink slug={store.slug} />
      </div>
    </div>
  )
}
