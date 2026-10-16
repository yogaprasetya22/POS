import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Switch } from '@shared/components/ui/switch'
import type { ModifierGroup } from '@shared/types/contracts'

const newGroup = (): ModifierGroup => ({ name: '', required: false, multiple: false, options: [{ name: '', price: 0 }] })

/** Editor visual untuk pilihan tambahan menu (pengganti JSON mentah). */
export function ModifierEditor({ value, onChange }: { value: ModifierGroup[]; onChange: (v: ModifierGroup[]) => void }) {
  const setGroup = (gi: number, patch: Partial<ModifierGroup>) => onChange(value.map((g, n) => (n === gi ? { ...g, ...patch } : g)))
  const setOption = (gi: number, oi: number, patch: Partial<ModifierGroup['options'][number]>) =>
    setGroup(gi, { options: value[gi].options.map((o, n) => (n === oi ? { ...o, ...patch } : o)) })

  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-sm text-muted-foreground">Belum ada. Contoh: "Level pedas" (wajib pilih satu) atau "Topping" (boleh banyak).</p>}

      {value.map((g, gi) => (
        <Card key={gi} size="sm" className="bg-muted/40">
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder="Nama grup, mis. Level pedas" aria-label="Nama grup pilihan" />
              <Button type="button" variant="ghost" size="icon" aria-label="Hapus grup" className="text-destructive" onClick={() => onChange(value.filter((_, n) => n !== gi))}>
                <Trash2 />
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Label className="font-normal">
                <Switch checked={g.required} onCheckedChange={(on) => setGroup(gi, { required: on })} /> Wajib dipilih
              </Label>
              <Label className="font-normal">
                <Switch checked={g.multiple} onCheckedChange={(on) => setGroup(gi, { multiple: on })} /> Boleh pilih banyak
              </Label>
            </div>

            <div className="space-y-2">
              {g.options.map((o, oi) => (
                <div key={oi} className="flex gap-2">
                  <Input value={o.name} onChange={(e) => setOption(gi, oi, { name: e.target.value })} placeholder="Nama opsi" aria-label="Nama opsi" />
                  <Input
                    value={o.price ? String(o.price) : ''}
                    onChange={(e) => setOption(gi, oi, { price: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                    inputMode="numeric"
                    placeholder="+ Rp"
                    aria-label="Tambahan harga"
                    className="w-28"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus opsi"
                    disabled={g.options.length === 1}
                    onClick={() => setGroup(gi, { options: g.options.filter((_, n) => n !== oi) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setGroup(gi, { options: [...g.options, { name: '', price: 0 }] })}>
                <Plus /> Opsi
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={() => onChange([...value, newGroup()])}>
        <Plus /> Grup pilihan
      </Button>
    </div>
  )
}
