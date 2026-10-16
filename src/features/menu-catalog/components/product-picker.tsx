import { useState } from 'react'
import { itemKey, unitPrice, type CartItem } from '@features/cart-checkout'
import { Panel } from '@shared/components/panel'
import { Stepper } from '@shared/components/stepper'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Label } from '@shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group'
import { Textarea } from '@shared/components/ui/textarea'
import { rupiah } from '@shared/lib/utils'
import type { Choice, ModifierGroup, Product } from '@shared/types/contracts'

import { MediaCarousel } from '@shared/components/media-carousel'

type Props = { product: Product; onAdd: (item: CartItem) => void; onClose: () => void }

const OptionRow = ({ control, name, price }: { control: React.ReactNode; name: string; price: number }) => (
  <Label className="cursor-pointer rounded-xl border px-3 py-3 font-normal transition has-data-checked:border-primary has-data-checked:bg-accent">
    {control}
    <span className="flex-1">{name}</span>
    <span className="text-muted-foreground">{price > 0 ? `+${rupiah(price)}` : 'Gratis'}</span>
  </Label>
)

export function ProductPicker({ product, onAdd, onClose }: Props) {
  const [picked, setPicked] = useState<Choice[]>(() =>
    product.modifiers.filter((g) => g.required && !g.multiple).map((g) => ({ group: g.name, option: g.options[0].name })),
  )
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')

  const isPicked = (g: ModifierGroup, option: string) => picked.some((c) => c.group === g.name && c.option === option)
  const pickOne = (g: ModifierGroup, option: string) => setPicked((prev) => [...prev.filter((c) => c.group !== g.name), { group: g.name, option }])
  const setMany = (g: ModifierGroup, option: string, on: boolean) =>
    setPicked((prev) => (on ? [...prev, { group: g.name, option }] : prev.filter((c) => !(c.group === g.name && c.option === option))))

  const missing = product.modifiers.some((g) => g.required && !picked.some((c) => c.group === g.name))
  const unit = unitPrice(product, picked)

  const add = () => {
    onAdd({ key: itemKey(product.id, picked, note), product_id: product.id, qty, choices: picked, note: note.trim(), name: product.name, unit_price: unit, image: product.image_url })
    onClose()
  }

  return (
    <Panel
      onClose={onClose}
      title={product.name}
      description={rupiah(product.price)}
      aside={<Stepper value={qty} onChange={setQty} />}
      media={
        <MediaCarousel
          imageUrl={product.image_url}
          images={product.images}
          videoUrl={product.video_url}
          alt={product.name}
        />
      }
      footer={
        <Button size="lg" disabled={missing} onClick={add} className="w-full">
          {missing ? 'Pilih opsi wajib dulu' : `Tambah ke keranjang · ${rupiah(unit * qty)}`}
        </Button>
      }
    >
      {product.modifiers.map((g) => (
        <fieldset key={g.name} className="space-y-2">
          <legend className="mb-2 flex w-full items-center justify-between font-semibold">
            {g.name}
            <span className="text-xs font-normal text-muted-foreground">{g.required ? 'Wajib' : 'Opsional'}{g.multiple && ' · boleh lebih dari satu'}</span>
          </legend>
          {g.multiple ? (
            g.options.map((o) => (
              <OptionRow key={o.name} name={o.name} price={o.price} control={<Checkbox checked={isPicked(g, o.name)} onCheckedChange={(on) => setMany(g, o.name, on)} />} />
            ))
          ) : (
            <RadioGroup value={picked.find((c) => c.group === g.name)?.option ?? ''} onValueChange={(v) => pickOne(g, String(v))} className="gap-2">
              {g.options.map((o) => (
                <OptionRow key={o.name} name={o.name} price={o.price} control={<RadioGroupItem value={o.name} />} />
              ))}
            </RadioGroup>
          )}
        </fieldset>
      ))}

      <Label className="flex-col items-start gap-2 font-semibold">
        Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} placeholder="Contoh: jangan terlalu pedas" className="font-normal" />
      </Label>
    </Panel>
  )
}
