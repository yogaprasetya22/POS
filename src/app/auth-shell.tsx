import { Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@shared/components/ui/card'

/** Bingkai dua kolom untuk halaman login / register / menunggu aktivasi. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-3xl gap-0 py-0 md:grid md:grid-cols-2">
        <div className="hidden flex-col justify-center bg-secondary p-10 md:flex">
          <Store className="size-14 text-primary" aria-hidden />
          <h1 className="mt-6 text-2xl font-bold">Kembangkan bisnismu.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pesanan WhatsApp langsung masuk ke kasir dan dapur, tanpa antre panjang.</p>
        </div>
        <div className="p-8 md:p-10">{children}</div>
      </Card>
    </div>
  )
}
