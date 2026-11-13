import { ArrowLeft, Boxes, ChefHat, Check, QrCode, Receipt } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'POS'

const POINTS = [
  { icon: Receipt, text: 'Kasir cepat dengan shift dan laci kas' },
  { icon: QrCode, text: 'Pelanggan pesan sendiri lewat QR meja' },
  { icon: ChefHat, text: 'Pesanan langsung tampil di layar dapur' },
  { icon: Boxes, text: 'Stok bahan terpotong otomatis dari resep' },
]

/** Bingkai dua kolom layar penuh untuk halaman login / register / menunggu aktivasi. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10 blur-3xl" />
        <Link to="/" className="relative text-xl font-bold tracking-tight">{APP_NAME}</Link>
        <div className="relative">
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">Kelola kasir, dapur, dan stok dalam satu aplikasi.</h1>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15"><Icon className="size-5" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-sm opacity-90"><Check className="size-4" /> Uji coba gratis 14 hari untuk toko baru</p>
      </aside>

      <div className="flex flex-col">
        <div className="flex items-center justify-between px-6 py-5">
          <Link to="/" className="text-lg font-bold tracking-tight lg:invisible">{APP_NAME}</Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Beranda
          </Link>
        </div>
        <div className="grid flex-1 place-items-center px-6 pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  )
}
