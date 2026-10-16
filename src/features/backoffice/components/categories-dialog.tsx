import { Plus, Tags, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ConfirmButton } from '@shared/components/confirm-button'
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
import { useStaff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import type { Category, Product } from '@shared/types/contracts'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  products: Product[]
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
}

export function CategoriesDialog({ open, onOpenChange, categories, products, run }: Props) {
  const { storeId } = useStaff()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitting(true)
    await run(supabase.from('categories').insert({ store_id: storeId, name: trimmed, sort: categories.length }))
    setName('')
    setSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="size-5 text-primary" />
            Kelola Kategori Menu
          </DialogTitle>
          <DialogDescription>
            Kategori mempermudah pelanggan dan kasir memfilter pilihan menu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="mt-2 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama kategori baru..."
            aria-label="Nama kategori baru"
            className="flex-1"
          />
          <Button type="submit" disabled={!name.trim() || submitting} className="gap-1.5 shrink-0">
            <Plus className="size-4" /> Tambah
          </Button>
        </form>

        <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border divide-y scrollbar-none">
          {categories.map((c) => {
            const count = products.filter((p) => p.category_id === c.id).length
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Tags className="size-4 text-muted-foreground shrink-0" aria-hidden />
                  <span className="font-medium truncate">{c.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="font-normal text-xs">
                    {count} menu
                  </Badge>
                  <ConfirmButton
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Hapus kategori ${c.name}`}
                    title={`Hapus kategori "${c.name}"?`}
                    description="Menu di kategori ini akan tetap ada, namun berubah menjadi tanpa kategori."
                    confirmLabel="Hapus Kategori"
                    onConfirm={() => run(supabase.from('categories').delete().eq('id', c.id))}
                  >
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </div>
              </div>
            )
          })}
          {categories.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Belum ada kategori yang dibuat.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
