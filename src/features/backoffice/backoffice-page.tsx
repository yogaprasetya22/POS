import { Outlet, useOutletContext } from 'react-router'
import { useState } from 'react'
import { useCatalog } from '@features/menu-catalog'
import { ErrorAlert } from '@shared/components/error-alert'
import { PageSkeleton } from '@shared/components/page-skeleton'
import { useStaff } from '@shared/lib/auth'

type Catalog = NonNullable<ReturnType<typeof useCatalog>['data']>
export type AdminCtx = {
  data: Catalog
  /** Jalankan operasi tulis; pesan error tampil di atas halaman, katalog dimuat ulang bila berhasil. */
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
  reload: () => void
  fail: (message: string) => void
}

export const useAdmin = () => useOutletContext<AdminCtx>()

/**
 * Induk semua halaman /admin/*: memuat katalog toko sekali dan membagikannya lewat Outlet context,
 * jadi pindah halaman tidak memuat ulang data. Setiap fitur punya route sendiri (lihat pages.tsx).
 */
export function AdminRoot() {
  const { storeId } = useStaff()
  const { data, error, reload } = useCatalog('id', storeId)
  const [msg, setMsg] = useState('')

  if (error) return <p className="p-6 text-destructive">{error}</p>
  if (!data) return <PageSkeleton />

  const run: AdminCtx['run'] = async (p) => {
    const { error: err } = await p
    setMsg(err?.message ?? '')
    if (!err) reload()
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ErrorAlert message={msg} />
      <Outlet context={{ data, run, reload, fail: setMsg } satisfies AdminCtx} />
    </div>
  )
}
