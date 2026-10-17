import { CheckCircle2, PackageX, Search, UtensilsCrossed } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { rupiah } from '@shared/lib/utils'
import type { Product } from '@shared/types/contracts'

interface StockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onToggleAvailability: (productId: string, isAvailable: boolean) => Promise<void>
}

type Filter = 'all' | 'sold_out' | 'available'

/**
 * Dialog Kelola Stok Cepat (Quick 86 / Sold Out) - Disesuaikan untuk Layar Tablet
 * Tombol toggle jumbo min-h 48px, mudah ditekan dengan jari tangan di dapur.
 * Palet warna netral, amber, dan emerald bersih (bebas dari warna merah menyala).
 */
export function StockDialog({
  open,
  onOpenChange,
  products,
  onToggleAvailability,
}: StockDialogProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const soldOutCount = useMemo(() => products.filter((p) => !p.is_available).length, [products])
  const availableCount = products.length - soldOutCount

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase().trim())
      if (!matchSearch) return false
      if (filter === 'sold_out') return !p.is_available
      if (filter === 'available') return p.is_available
      return true
    })
  }, [products, search, filter])

  const handleToggle = async (p: Product) => {
    try {
      setUpdatingId(p.id)
      await onToggleAvailability(p.id, !p.is_available)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-4 sm:p-5 border-b text-left bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-xl font-black flex items-center gap-2">
              <PackageX className="size-5 sm:size-6 text-primary" />
              Kelola Stok Menu (Quick 86)
            </DialogTitle>
            {soldOutCount > 0 ? (
              <Badge variant="outline" className="text-xs px-2.5 py-1 font-bold rounded-lg bg-amber-500/15 text-amber-700 border-amber-500/30">
                {soldOutCount} Menu Habis
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs px-2.5 py-1 font-bold rounded-lg bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                Semua Tersedia
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
            Matikan menu jika bahan baku di dapur habis. Status langsung sinkron real-time ke kasir dan menu QR pelanggan.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Filter Bar - Ramah Jari Tablet */}
        <div className="p-3 sm:p-4 border-b space-y-3 bg-background">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 sm:h-12 text-sm rounded-2xl"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs scrollbar-none">
            <Button
              type="button"
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="h-9 sm:h-10 px-4 text-xs sm:text-sm font-bold rounded-xl"
            >
              Semua ({products.length})
            </Button>
            <Button
              type="button"
              variant={filter === 'sold_out' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('sold_out')}
              className={`h-9 sm:h-10 px-4 text-xs sm:text-sm font-bold rounded-xl ${
                filter === 'sold_out' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              Habis ({soldOutCount})
            </Button>
            <Button
              type="button"
              variant={filter === 'available' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('available')}
              className="h-9 sm:h-10 px-4 text-xs sm:text-sm font-bold rounded-xl"
            >
              Tersedia ({availableCount})
            </Button>
          </div>
        </div>

        {/* Product List - Setiap Baris Kartu Sentuh Jumbo */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredProducts.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground space-y-1">
              <UtensilsCrossed className="mx-auto size-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-bold text-foreground">Tidak ada menu yang sesuai</p>
              <p className="text-xs text-muted-foreground">Coba ubah kata kunci pencarian atau filter.</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isUpdating = updatingId === p.id
              return (
                <div
                  key={p.id}
                  className={`p-3 sm:p-3.5 rounded-2xl border bg-card/60 flex items-center justify-between gap-3 shadow-2xs hover:bg-muted/30 transition-all ${
                    isUpdating ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative size-12 sm:size-13 rounded-xl overflow-hidden bg-muted shrink-0 border">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className={`size-full object-cover ${p.is_available ? '' : 'grayscale opacity-60'}`}
                        />
                      ) : (
                        <div className="size-full flex items-center justify-center text-muted-foreground/40">
                          <UtensilsCrossed className="size-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm sm:text-base font-bold truncate ${p.is_available ? 'text-foreground' : 'line-through text-muted-foreground'}`}>
                        {p.name}
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-primary mt-0.5">
                        {rupiah(p.price)}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Sentuh Status Jumbo Khusus Tablet */}
                  <button
                    type="button"
                    onClick={() => handleToggle(p)}
                    disabled={isUpdating}
                    className={`min-h-[46px] sm:min-h-[48px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs ${
                      p.is_available
                        ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-muted/80 text-muted-foreground border border-border hover:bg-muted'
                    }`}
                    aria-label={`Ubah status ${p.name}`}
                  >
                    {p.is_available ? (
                      <>
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        <span>Tersedia</span>
                      </>
                    ) : (
                      <>
                        <PackageX className="size-4 shrink-0" />
                        <span>Habis (86)</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

