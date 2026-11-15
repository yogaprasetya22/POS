import { ArrowLeft, Home, RefreshCw, SearchX, TriangleAlert, UtensilsCrossed } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { buttonVariants } from '@shared/components/ui/button'
import { lastMenu } from '@shared/lib/last-menu'

function Shell({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{title}</h1>
        <div className="mt-3 text-lg leading-relaxed text-muted-foreground">{children}</div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div>
      </div>
    </main>
  )
}

const big = 'h-12 px-6 text-base font-bold'

/** Pembeli kembali ke menu + mejanya; selain itu ke halaman awal. */
function HomeLink({ variant }: { variant?: 'outline' }) {
  const menu = lastMenu()
  return (
    <Link to={menu?.path ?? '/'} className={buttonVariants({ variant, className: variant ? `${big} border-2 border-border` : big })}>
      {menu ? <UtensilsCrossed /> : <Home />} {menu?.label ?? 'Ke halaman awal'}
    </Link>
  )
}

function BackButton() {
  return (
    <button type="button" onClick={() => (history.length > 1 ? history.back() : location.assign(lastMenu()?.path ?? '/'))} className={buttonVariants({ variant: 'outline', className: `${big} border-2 border-border` })}>
      <ArrowLeft /> Kembali
    </button>
  )
}

/** Halaman tidak ditemukan: alamat salah atau tautan lama. */
export function NotFoundPage() {
  return (
    <Shell icon={<SearchX className="size-10" aria-hidden />} title="Halaman tidak ditemukan" actions={<><BackButton /><HomeLink /></>}>
      Alamat yang kamu buka tidak ada, atau tautannya sudah lama. Periksa lagi alamatnya, atau kembali ke halaman sebelumnya.
    </Shell>
  )
}

// Setelah versi baru di-deploy, file JS lama bisa hilang: muat ulang sekali agar memakai versi terbaru.
const RELOAD_KEY = 'pos:reload-after-deploy'
function isStaleChunk(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch/i.test(msg)
}

/**
 * Pengganti layar error bawaan React Router. Di produksi hanya pesan ramah + cara memperbaiki;
 * detail teknis (pesan & stack) hanya tampil saat pengembangan (import.meta.env.DEV).
 */
export function RouteErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  if (isStaleChunk(error) && !sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, '1')
    location.reload()
    return null
  }
  sessionStorage.removeItem(RELOAD_KEY)

  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error)
  if (import.meta.env.DEV) console.error(error)

  return (
    <Shell
      icon={<TriangleAlert className="size-10" aria-hidden />}
      title="Ada masalah di halaman ini"
      actions={
        <>
          <button type="button" onClick={() => location.reload()} className={buttonVariants({ className: big })}>
            <RefreshCw /> Coba lagi
          </button>
          <HomeLink variant="outline" />
        </>
      }
    >
      <p>Halaman gagal dimuat. Data kamu aman. Tekan “Coba lagi”. Kalau masih gagal, periksa internet lalu buka ulang aplikasinya.</p>
      {import.meta.env.DEV && (
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-sm font-semibold">Detail teknis (hanya tampil saat pengembangan)</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{detail}</pre>
        </details>
      )}
    </Shell>
  )
}
