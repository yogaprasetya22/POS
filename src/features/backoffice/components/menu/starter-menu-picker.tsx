import { Coffee, CupSoda, Soup, UtensilsCrossed } from 'lucide-react'
import { m } from 'motion/react'
import { useState } from 'react'
import { appear } from '@shared/components/motion'
import { ErrorAlert } from '@shared/components/error-alert'
import { useStaff } from '@shared/lib/auth'
import { STARTER_MENUS, seedStarterMenu, type StarterKind } from './starter-menu'

const ICON = { warkop: Coffee, kafe: CupSoda, resto: UtensilsCrossed, bakso: Soup } satisfies Record<StarterKind, unknown>

/** Pilih jenis usaha → menu contoh langsung terisi (bisa diubah atau dihapus setelahnya). */
export function StarterMenuPicker({ onDone }: { onDone: () => void }) {
  const { storeId } = useStaff()
  const [busy, setBusy] = useState<StarterKind | null>(null)
  const [error, setError] = useState('')

  const pick = async (kind: StarterKind) => {
    if (!storeId || busy) return
    setBusy(kind)
    setError('')
    const { error: err } = await seedStarterMenu(storeId, kind)
    setBusy(null)
    if (err) return setError(err.message)
    onDone()
  }

  return (
    <div className="space-y-2">
      <p className="text-base font-semibold">Usaha kamu jenis apa? Pilih satu, menu contoh langsung terisi:</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(STARTER_MENUS) as StarterKind[]).map((k, idx) => {
          const Icon = ICON[k]
          return (
            <m.button
              key={k}
              {...appear(idx)}
              whileTap={{ scale: 0.95 }}
              type="button"
              disabled={!!busy}
              onClick={() => pick(k)}
              className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-background p-3 text-center transition-colors hover:border-primary disabled:opacity-60"
            >
              <Icon className="size-7 text-primary" />
              <span className="text-base font-bold">{busy === k ? 'Mengisi…' : STARTER_MENUS[k].label}</span>
              <span className="text-xs text-foreground/70">{STARTER_MENUS[k].hint}</span>
            </m.button>
          )
        })}
      </div>
      <ErrorAlert message={error} />
    </div>
  )
}
