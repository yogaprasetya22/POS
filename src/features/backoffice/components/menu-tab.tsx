import {
  FolderPlus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/components/ui/alert-dialog'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card } from '@shared/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu'
import { Input } from '@shared/components/ui/input'
import { Switch } from '@shared/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table'
import { supabase } from '@shared/lib/supabase'
import { rupiah } from '@shared/lib/utils'
import { MenuImage } from '@shared/components/menu-image'
import type { Category, Product } from '@shared/types/contracts'
import { CategoriesDialog } from './categories-dialog'
import { ProductForm } from './product-form'

type Props = {
  products: Product[]
  categories: Category[]
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
  reload: () => void
  isAddingNew?: boolean
  onAddFinished?: () => void
}

const ALL = 'all'

/**
 * Katalog Menu: Mode ganda (Grid Kartu visual & Tabel Data Padat)
 * Dilengkapi dengan filter chip kategori interaktif & modal manajemen kategori terintegrasi.
 */
export function MenuTab({
  products,
  categories,
  run,
  reload,
  isAddingNew = false,
  onAddFinished,
}: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL)
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'soldout'>('all')

  useEffect(() => {
    if (isAddingNew) {
      setEditing('new')
      onAddFinished?.()
    }
  }, [isAddingNew, onAddFinished])

  const q = query.trim().toLowerCase()
  const shown = products.filter((p) => {
    const matchesCategory = category === ALL || p.category_id === category
    const matchesSearch =
      p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    const matchesAvailability =
      availabilityFilter === 'all' ||
      (availabilityFilter === 'available' && p.is_available) ||
      (availabilityFilter === 'soldout' && !p.is_available)

    return matchesCategory && matchesSearch && matchesAvailability
  })

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name
  const soldOut = products.filter((p) => !p.is_available).length

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Katalog Menu</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {products.length} total menu · {products.length - soldOut} aktif dijual
            {soldOut > 0 && <span className="font-semibold text-destructive"> · {soldOut} habis</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border bg-muted/40 p-1">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('grid')}
              title="Tampilan Grid Kartu"
              className={viewMode === 'grid' ? 'shadow-xs' : ''}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('table')}
              title="Tampilan Tabel Data"
              className={viewMode === 'table' ? 'shadow-xs' : ''}
            >
              <TableIcon className="size-4" />
            </Button>
          </div>

          <Button onClick={() => setEditing('new')} className="gap-2 shadow-xs shadow-primary/20">
            <Plus className="size-4" /> Tambah Menu
          </Button>
        </div>
      </div>

      {/* Category Pills Bar & Management */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button
          type="button"
          size="sm"
          variant={category === ALL ? 'default' : 'outline'}
          onClick={() => setCategory(ALL)}
          className="rounded-full text-xs shrink-0"
        >
          Semua ({products.length})
        </Button>
        {categories.map((c) => {
          const count = products.filter((p) => p.category_id === c.id).length
          const isActive = category === c.id
          return (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => setCategory(c.id)}
              className="rounded-full text-xs shrink-0"
            >
              {c.name} ({count})
            </Button>
          )
        })}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setCategoryModalOpen(true)}
          className="rounded-full text-xs shrink-0 gap-1.5 text-primary border border-dashed border-primary/40 hover:bg-primary/5"
        >
          <FolderPlus className="size-3.5" /> Kelola Kategori
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari menu berdasarkan nama atau SKU..."
            aria-label="Cari menu"
            className="pl-10 h-10 rounded-xl"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1 text-xs">
          <button
            type="button"
            onClick={() => setAvailabilityFilter('all')}
            className={`rounded-lg px-2.5 py-1 transition-all ${
              availabilityFilter === 'all'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setAvailabilityFilter('available')}
            className={`rounded-lg px-2.5 py-1 transition-all ${
              availabilityFilter === 'available'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tersedia
          </button>
          <button
            type="button"
            onClick={() => setAvailabilityFilter('soldout')}
            className={`rounded-lg px-2.5 py-1 transition-all ${
              availabilityFilter === 'soldout'
                ? 'bg-destructive text-white font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Habis ({soldOut})
          </button>
        </div>
      </div>

      {/* Product Content: Grid vs Table */}
      {viewMode === 'grid' ? (
        /* Grid Mode */
        <div>
          {shown.length === 0 ? (
            <Card className="rounded-2xl p-12 text-center text-muted-foreground">
              <UtensilsCrossed className="mx-auto size-10 text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-foreground">Tidak ada menu yang ditemukan</p>
              <p className="text-xs text-muted-foreground mt-1">
                {products.length === 0
                  ? 'Katalog masih kosong. Klik "Tambah Menu" untuk memasukkan hidangan pertama.'
                  : 'Coba ubah kata kunci pencarian atau filter kategori Anda.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => {
                const cat = categoryName(p.category_id)
                return (
                  <Card
                    key={p.id}
                    onClick={() => setEditing(p)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    {/* Food Photo Container */}
                    <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                      <MenuImage
                        src={p.image_url ? p.image_url.replace('w=600', 'w=300') : null}
                        alt={p.name}
                        className={`transition-transform duration-300 group-hover:scale-105 ${
                          p.is_available ? '' : 'grayscale opacity-60'
                        }`}
                      />

                      {/* Top Floating Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                        {cat && (
                          <Badge variant="secondary" className="backdrop-blur-md bg-background/80 text-[11px] font-medium shadow-xs">
                            {cat}
                          </Badge>
                        )}
                      </div>

                      <div className="absolute top-2.5 right-2.5">
                        <Badge
                          variant={p.is_available ? 'outline' : 'destructive'}
                          className={`backdrop-blur-md text-[11px] font-semibold ${
                            p.is_available ? 'bg-background/80 text-emerald-600 border-emerald-500/40' : 'bg-destructive/90 text-white'
                          }`}
                        >
                          {p.is_available ? 'Tersedia' : 'Habis'}
                        </Badge>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                            {p.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{p.sku ? `SKU: ${p.sku}` : 'Tanpa SKU'}</span>
                          {p.modifiers.length > 0 && (
                            <span>· {p.modifiers.length} opsi varian</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="text-base font-extrabold text-foreground tabular-nums">
                          {rupiah(p.price)}
                        </span>

                        {/* Availability Toggle and Actions */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            aria-label={`Ketersediaan ${p.name}`}
                            checked={p.is_available}
                            onCheckedChange={(on) =>
                              run(supabase.from('products').update({ is_available: on }).eq('id', p.id))
                            }
                          />

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Aksi menu ${p.name}`}
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing(p)}>
                                <Pencil className="size-3.5 mr-2" /> Ubah Menu
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleting(p)}
                              >
                                <Trash2 className="size-3.5 mr-2" /> Hapus Menu
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Table Mode */
        <Card className="rounded-2xl overflow-hidden border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">Menu</TableHead>
                <TableHead className="hidden md:table-cell">Kategori</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="hidden lg:table-cell">Varian / Opsi</TableHead>
                <TableHead>Ketersediaan</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => {
                const cat = categoryName(p.category_id)
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setEditing(p)}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-accent">
                          {p.image_url ? (
                            <img
                              src={p.image_url.replace('w=600', 'w=96')}
                              alt=""
                              loading="lazy"
                              className={`size-full object-cover ${p.is_available ? '' : 'grayscale'}`}
                            />
                          ) : (
                            <UtensilsCrossed className="m-auto mt-3 size-5 text-primary/40" aria-hidden />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku ?? '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {cat ? (
                        <Badge variant="secondary" className="font-normal text-xs">
                          {cat}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {rupiah(p.price)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {p.modifiers.length ? `${p.modifiers.length} grup varian` : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Switch
                          aria-label={`Tersedia ${p.name}`}
                          checked={p.is_available}
                          onCheckedChange={(on) =>
                            run(supabase.from('products').update({ is_available: on }).eq('id', p.id))
                          }
                        />
                        <span
                          className={`hidden text-xs sm:inline ${
                            p.is_available ? 'text-muted-foreground' : 'font-semibold text-destructive'
                          }`}
                        >
                          {p.is_available ? 'Tersedia' : 'Habis'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Aksi ${p.name}`}
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(p)}>
                            <Pencil className="size-3.5 mr-2" /> Ubah
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 className="size-3.5 mr-2" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    {products.length === 0
                      ? 'Belum ada menu. Klik "Tambah menu" untuk mulai.'
                      : 'Tidak ada menu yang sesuai dengan filter.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus menu "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Menu ini akan dihapus secara permanen dari katalog toko Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleting &&
                run(supabase.from('products').delete().eq('id', deleting.id)).then(() => setDeleting(null))
              }
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Categories Management Dialog */}
      <CategoriesDialog
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        categories={categories}
        products={products}
        run={run}
      />

      {/* Product Form Drawer */}
      {editing && (
        <ProductForm
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          categories={categories}
          onDone={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
