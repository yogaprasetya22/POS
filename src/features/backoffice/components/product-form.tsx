import { Film, ImagePlus, Plus, Trash2, Video, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@shared/components/error-alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@shared/components/ui/drawer'
import { Switch } from '@shared/components/ui/switch'
import { useStaff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import { ModifierGroupSchema, type Category, type ModifierGroup, type Product } from '@shared/types/contracts'
import { ModifierEditor } from './modifier-editor'

const NONE = 'none'

type Props = { product: Product | null; categories: Category[]; onDone: () => void }

/** Form tambah/ubah menu dalam panel samping dengan dukungan multi-image & video. */
export function ProductForm({ product, categories, onDone }: Props) {
  const { storeId } = useStaff()
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    price: String(product?.price ?? ''),
    category_id: product?.category_id ?? '',
    is_available: product?.is_available ?? true,
    images: product?.images && product.images.length > 0 ? product.images : product?.image_url ? [product.image_url] : [],
    video_url: product?.video_url ?? '',
  })
  const [modifiers, setModifiers] = useState<ModifierGroup[]>(product?.modifiers ?? [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError('')
    const newUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = `${storeId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error: err } = await supabase.storage.from('product-images').upload(path, file)
      if (err) {
        setError(`Gagal upload ${file.name}: ${err.message}`)
      } else {
        newUrls.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl)
      }
    }
    setBusy(false)
    if (newUrls.length > 0) {
      set({ images: [...form.images, ...newUrls] })
    }
  }

  const removeImage = (indexToRemove: number) => {
    set({ images: form.images.filter((_, idx) => idx !== indexToRemove) })
  }

  const uploadVideo = async (file: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    const path = `${storeId}/video-${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error: err } = await supabase.storage.from('product-images').upload(path, file)
    setBusy(false)
    if (err) return setError(`Gagal upload video: ${err.message}`)
    set({ video_url: supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const price = Number(form.price)
    if (!form.name.trim() || !form.price || !Number.isInteger(price) || price < 0) return setError('Nama dan harga wajib diisi')
    if (modifiers.some((g) => !g.name.trim() || g.options.some((o) => !o.name.trim()))) return setError('Nama grup dan nama opsi pilihan tidak boleh kosong')

    const primaryImage = form.images[0] || null
    const row = {
      store_id: storeId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      price,
      category_id: form.category_id || null,
      is_available: form.is_available,
      modifiers: z.array(ModifierGroupSchema).parse(modifiers),
      image_url: primaryImage,
      images: form.images,
      video_url: form.video_url.trim() || null,
    }
    setBusy(true)
    const { error } = product ? await supabase.from('products').update(row).eq('id', product.id) : await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <Drawer open onOpenChange={(open) => !open && onDone()} swipeDirection="right">
      <DrawerContent style={{ '--drawer-content-width': 'min(100vw, 32rem)' } as React.CSSProperties}>
        <DrawerHeader className="border-b text-left">
          <DrawerTitle>{product ? 'Ubah menu' : 'Menu baru'}</DrawerTitle>
          <DrawerDescription>{product ? product.name : 'Isi data menu yang akan tampil di katalog pelanggan.'}</DrawerDescription>
        </DrawerHeader>

        <form id="product-form" onSubmit={submit} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 scrollbar-none">
          {/* Multi-Image Upload Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <ImagePlus className="size-4 text-primary" />
                <span>Foto Menu (Carousel Multi-Image)</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">{form.images.length} foto terpilih</span>
            </div>

            {/* Image Thumbnails Strip */}
            <div className="flex flex-wrap gap-2.5 items-center">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative size-20 rounded-xl overflow-hidden border bg-muted group">
                  <img src={url} alt={`Preview ${idx + 1}`} className="size-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-primary-foreground text-[9px] font-bold text-center py-0.5">
                      Utama
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 size-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-destructive transition-all cursor-pointer"
                    aria-label="Hapus foto"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {/* Upload Button */}
              <label className="size-20 rounded-xl border border-dashed border-border hover:border-primary/60 bg-muted/30 hover:bg-muted/60 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-muted-foreground hover:text-foreground">
                <Plus className="size-5" />
                <span className="text-[10px] font-medium">+ Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => uploadImages(e.target.files)}
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bisa pilih lebih dari satu foto untuk ditampilkan dalam carousel swipe.
            </p>
          </div>

          {/* Video Section */}
          <div className="space-y-2 rounded-2xl border p-3.5 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Video className="size-4 text-rose-500" />
                <span>Video Menu (Opsional)</span>
              </Label>
              {form.video_url && (
                <button
                  type="button"
                  onClick={() => set({ video_url: '' })}
                  className="text-[11px] text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="size-3" /> Hapus Video
                </button>
              )}
            </div>

            {form.video_url ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black">
                <video src={form.video_url} controls playsInline className="size-full object-contain" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    value={form.video_url}
                    onChange={(e) => set({ video_url: e.target.value })}
                    placeholder="URL Video (https://...mp4)"
                    className="h-8 text-xs rounded-lg flex-1"
                  />
                  <label className="h-8 px-3 rounded-lg border bg-card hover:bg-muted font-semibold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
                    <Film className="size-3.5" />
                    <span>Upload MP4</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="sr-only"
                      onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Video klip penyajian atau proses memasak untuk menarik selera pelanggan di katalog.
                </p>
              </div>
            )}
          </div>

          <Label className="flex-col items-start gap-2">
            Nama menu
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Contoh: Nasi Goreng Spesial" />
          </Label>

          <div className="grid grid-cols-2 gap-3">
            <Label className="flex-col items-start gap-2">
              Harga (Rp)
              <Input inputMode="numeric" value={form.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, '') })} placeholder="25000" />
            </Label>
            <Label className="flex-col items-start gap-2">
              SKU (opsional)
              <Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="MKN-001" />
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={form.category_id || NONE}
              onValueChange={(v) => set({ category_id: !v || v === NONE ? '' : v })}
              items={[{ value: NONE, label: 'Tanpa kategori' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            >
              <SelectTrigger aria-label="Kategori" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tanpa kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Label className="justify-between rounded-2xl border p-3 font-normal">
            <span>
              <span className="block font-medium">Tersedia</span>
              <span className="text-xs text-muted-foreground">Matikan jika menu sedang habis.</span>
            </span>
            <Switch checked={form.is_available} onCheckedChange={(on) => set({ is_available: on })} />
          </Label>

          <div className="space-y-2">
            <Label>Pilihan tambahan</Label>
            <ModifierEditor value={modifiers} onChange={setModifiers} />
          </div>

          <ErrorAlert message={error} />
        </form>

        <DrawerFooter className="flex-row border-t pt-4">
          <Button type="button" variant="ghost" onClick={onDone}>Batal</Button>
          <Button form="product-form" disabled={busy} className="flex-1">{busy ? 'Menyimpan…' : 'Simpan menu'}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
