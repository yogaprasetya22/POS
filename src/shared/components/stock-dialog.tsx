import { AlertCircle, CheckCircle2, PackageX, Search, UtensilsCrossed } from 'lucide-react'
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
import { Switch } from '@shared/components/ui/switch'
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
 * Dialog Kelola Stok Cepat (Quick 86 / Sold Out)
 * Dirancang untuk operasional cepat dapur dan kasir:
 * 1-klik untuk mematikan/menyalakan menu yang langsung sinkron ke seluruh sistem & QR pelanggan.
 * // ponytail: filter lokal murni React state tanpa query tambahan, aksi langsung ke Supabase.
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
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b text-left bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <PackageX className="size-5 text-primary" />
              Kelola Stok Menu (Quick 86)
            </DialogTitle>
            {soldOutCount > 0 ? (
              <Badge variant="destructive" className="text-xs px-2 py-0.5 font-bold">
                {soldOutCount} Menu Habis
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 text-emerald-600 bg-emerald-500/10 border-emerald-500/20 font-bold">
                Semua Tersedia
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Matikan menu jika bahan baku di dapur habis. Status langsung sinkron real-time ke kasir dan menu QR pelanggan.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b space-y-2 bg-background">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs scrollbar-none">
            <Button
              type="button"
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="h-7 px-3 text-xs rounded-lg"
            >
              Semua ({products.length})
            </Button>
            <Button
              type="button"
              variant={filter === 'sold_out' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilter('sold_out')}
              className="h-7 px-3 text-xs rounded-lg"
            >
              Habis ({soldOutCount})
            </Button>
            <Button
              type="button"
              variant={filter === 'available' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('available')}
              className="h-7 px-3 text-xs rounded-lg"
            >
              Tersedia ({availableCount})
            </Button>
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-border/40">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-1">
              <UtensilsCrossed className="mx-auto size-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-semibold">Tidak ada menu yang sesuai</p>
              <p className="text-[11px] text-muted-foreground">Coba ubah kata kunci pencarian atau filter.</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isUpdating = updatingId === p.id
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 pt-2.5 first:pt-0 transition-opacity ${
                    isUpdating ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative size-11 rounded-lg overflow-hidden bg-muted shrink-0 border">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className={`size-full object-cover ${p.is_available ? '' : 'grayscale opacity-60'}`}
                        />
                      ) : (
                        <div className="size-full flex items-center justify-center text-muted-foreground/40">
                          <UtensilsCrossed className="size-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${p.is_available ? 'text-foreground' : 'line-through text-muted-foreground'}`}>
                        {p.name}
                      </p>
                      <p className="text-[11px] font-semibold text-primary">
                        {rupiah(p.price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {p.is_available ? (
                      <span className="text-[11px] font-semibold text-emerald-600 hidden sm:inline flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Tersedia
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-destructive hidden sm:inline flex items-center gap-1">
                        <AlertCircle className="size-3.5" /> Habis
                      </span>
                    )}
                    <Switch
                      checked={p.is_available}
                      onCheckedChange={() => handleToggle(p)}
                      aria-label={`Ubah status ${p.name}`}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
