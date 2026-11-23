import { Check, Languages } from 'lucide-react'
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@shared/components/ui/dropdown-menu'
import { LOCALES, useI18n } from '@shared/i18n'
import { getMotionPref, setMotionPref } from '@shared/lib/motion-pref'

/** Pilihan bahasa pribadi (tersimpan di perangkat ini). Bahasa bawaan toko dipakai sampai pengguna memilih. */
export function LanguageMenu() {
  const { locale, setLocale } = useI18n()
  const motion = getMotionPref()
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
          <Languages className="size-3.5" aria-hidden /> Bahasa / Language
        </DropdownMenuLabel>
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l.value} className="min-h-10 justify-between" onClick={() => setLocale(l.value)}>
            {l.label}
            {locale === l.value && <Check className="size-4" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs"> Animasi
        </DropdownMenuLabel>
        <DropdownMenuItem className="min-h-10 justify-between" onClick={() => setMotionPref(motion === 'full' ? 'system' : 'full')}>
          Selalu animasi penuh
          {motion === 'full' && <Check className="size-4" aria-hidden />}
        </DropdownMenuItem>
        <p className="px-2 pb-1.5 text-xs text-muted-foreground">Aktif secara bawaan. Matikan bila ingin mengikuti setelan “kurangi gerakan” di perangkat.</p>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  )
}
