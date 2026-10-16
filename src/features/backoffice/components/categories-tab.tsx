import { Tags, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { ConfirmButton } from '@shared/components/confirm-button'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { useStaff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import type { Category, Product } from '@shared/types/contracts'

type Props = {
  categories: Category[]
  products: Product[]
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
}

export function CategoriesTab({ categories, products, run }: Props) {
  const { storeId } = useStaff()

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = e.currentTarget.elements.namedItem('name') as HTMLInputElement
    const name = input.value.trim()
    if (!name) return
    input.value = ''
    run(supabase.from('categories').insert({ store_id: storeId, name, sort: categories.length }))
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Kategori menu</CardTitle>
        <CardDescription>Dipakai sebagai filter di katalog pelanggan dan kasir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <Tags className="size-4 text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">{c.name}</span>
              <Badge variant="secondary">{products.filter((p) => p.category_id === c.id).length} menu</Badge>
              <ConfirmButton
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                aria-label={`Hapus kategori ${c.name}`}
                title={`Hapus kategori ${c.name}?`}
                description="Menu di kategori ini tetap ada, tapi menjadi tanpa kategori."
                confirmLabel="Hapus"
                onConfirm={() => run(supabase.from('categories').delete().eq('id', c.id))}
              >
                <Trash2 />
              </ConfirmButton>
            </li>
          ))}
          {categories.length === 0 && <li className="py-4 text-sm text-muted-foreground">Belum ada kategori.</li>}
        </ul>
        <form onSubmit={add} className="flex gap-2">
          <Input name="name" placeholder="Nama kategori baru" aria-label="Kategori baru" />
          <Button>Tambah</Button>
        </form>
      </CardContent>
    </Card>
  )
}
