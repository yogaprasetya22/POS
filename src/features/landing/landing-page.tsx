import { ArrowRight, ChefHat, QrCode, Receipt } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Reveal } from '@shared/components/reveal'
import { buttonVariants } from '@shared/components/ui/button'
import { fetchStores } from '@shared/lib/api'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'POS'

const STEPS = [
  { icon: QrCode, title: 'Pelanggan memesan', text: 'Buka link atau scan QR toko, pilih menu, lalu kirim pesanan ke WhatsApp kasir.' },
  { icon: Receipt, title: 'Kasir menerima', text: 'Pesanan masuk ke layar kasir dengan kode antrean. Kasir mengecek lalu menerima pembayaran.' },
  { icon: ChefHat, title: 'Dapur menyiapkan', text: 'Setelah dibayar, pesanan muncul di layar dapur sampai siap diantar.' },
]

type StoreLink = { slug: string; name: string }

export function LandingPage() {
  const [stores, setStores] = useState<StoreLink[]>([])

  useEffect(() => {
    fetchStores().then(setStores).catch(() => setStores([]))
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight">{APP_NAME}</Link>
          <nav className="flex items-center gap-2">
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Masuk</Link>
            <Link to="/register" className={buttonVariants({ size: 'sm' })}>Daftar</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 sm:py-24">
          <Reveal>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Pesanan dari WhatsApp, langsung sampai ke kasir dan dapur.
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Pelanggan memesan lewat link toko, kasir menerima pembayaran, dapur melihat antreannya. Satu akun bisa mengelola beberapa toko.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/register" className={buttonVariants({ size: 'lg' })}>
              Buat akun <ArrowRight className="size-4" />
            </Link>
            <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Masuk staf</Link>
          </div>
          </Reveal>
        </section>

        <section aria-labelledby="alur" className="border-t py-12">
          <h2 id="alur" className="text-xl font-semibold">Alurnya</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 0.08}>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="size-4" /> Langkah {i + 1}
                </div>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {stores.length > 0 && (
          <section aria-labelledby="toko" className="border-t py-12">
            <h2 id="toko" className="text-xl font-semibold">Toko yang sedang buka</h2>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((s) => (
                <li key={s.slug}>
                  <Link to={`/s/${s.slug}`} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:bg-muted">
                    <span className="font-medium">{s.name}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl justify-between px-4 py-6 text-sm text-muted-foreground">
          <span>{APP_NAME}</span>
          <nav className="flex gap-4" aria-label="Info">
            <Link to="/privasi" className="hover:text-foreground">Privasi</Link>
            <Link to="/syarat" className="hover:text-foreground">Syarat</Link>
            <Link to="/login" className="hover:text-foreground">Masuk</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
