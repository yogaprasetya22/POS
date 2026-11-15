import { ChefHat } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { SectionCard } from '@shared/components/page'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Switch } from '@shared/components/ui/switch'
import { rpc } from '@shared/lib/api'
import type { StoreConfig } from '@shared/types/contracts'

/**
 * Pengaturan dapur: pakai layar dapur atau tidak, dan perkiraan waktu masak untuk pengingat kasir.
 * Disimpan terpisah dari form pajak/struk (fungsi database sendiri: save_kitchen_settings).
 */
export function KitchenSettings({ config, onSaved }: { config: StoreConfig | null; onSaved: () => void }) {
  const [useScreen, setUseScreen] = useState(config?.use_kitchen_screen ?? true)
  const [minutes, setMinutes] = useState(String(config?.cook_minutes ?? 15))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setUseScreen(config?.use_kitchen_screen ?? true)
    setMinutes(String(config?.cook_minutes ?? 15))
  }, [config])

  const n = Number(minutes)
  const valid = Number.isInteger(n) && n >= 1 && n <= 180
  const dirty = useScreen !== (config?.use_kitchen_screen ?? true) || n !== (config?.cook_minutes ?? 15)

  const save = async () => {
    if (!valid) return setError('Waktu masak harus angka 1 sampai 180 menit. Contoh: 15')
    setBusy(true)
    setError('')
    setSaved(false)
    const { error: err } = await rpc('save_kitchen_settings', { p_use_kitchen_screen: useScreen, p_cook_minutes: n })
    setBusy(false)
    if (err) return setError(err.message)
    setSaved(true)
    onSaved()
  }

  return (
    <SectionCard title="Dapur" hint="Tidak semua warung punya perangkat di dapur. Pilih yang sesuai." className="[&>div]:space-y-5">
      <label className="flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4">
        <ChefHat className="mt-0.5 size-7 shrink-0 text-primary" aria-hidden />
        <span className="flex-1">
          <span className="block text-base font-bold">Pakai layar dapur</span>
          <span className="mt-1 block text-base text-muted-foreground">
            {useScreen
              ? 'Nyala: tukang masak menandai “Siap diambil” dari layar Dapur. Kasir diberi tahu saat pesanan siap.'
              : 'Mati: tidak ada layar di dapur. Kasir atau pelayan menandai “Sudah siap” dan “Sudah diambil” dari halaman Antrean.'}
          </span>
        </span>
        <Switch checked={useScreen} onCheckedChange={setUseScreen} aria-label="Pakai layar dapur" />
      </label>

      <div className="space-y-2">
        <label htmlFor="cook-min" className="block text-base font-bold">Perkiraan waktu masak</label>
        <p className="text-base text-muted-foreground">
          Lewat dari waktu ini, pesanan diberi tanda kuning di Antrean{useScreen ? '' : ' dan kasir diingatkan untuk mengecek ke dapur'}.
        </p>
        <div className="relative max-w-48">
          <Input
            id="cook-min"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
            aria-invalid={!valid}
            className="h-12 pr-16 text-base"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground">menit</span>
        </div>
        {!valid && <p className="text-base font-semibold text-destructive">Isi angka 1 sampai 180. Contoh: 15</p>}
      </div>

      <ErrorAlert message={error} />
      {saved && !dirty && <p role="status" className="text-base font-semibold text-emerald-700 dark:text-emerald-400">Pengaturan dapur tersimpan.</p>}
      <Button className="h-12 px-6 text-base font-bold" disabled={busy || !dirty || !valid} onClick={save}>
        {busy ? 'Menyimpan…' : 'Simpan pengaturan dapur'}
      </Button>
    </SectionCard>
  )
}
