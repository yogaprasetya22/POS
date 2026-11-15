import { ArrowDown, ArrowUp, Check, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SectionCard } from '@shared/components/page'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Switch } from '@shared/components/ui/switch'
import { rpc } from '@shared/lib/api'
import { PERMISSIONS, ROLES, usePermissions, type Permission } from '@shared/lib/permissions'
import { useShiftNames } from '@shared/lib/shift-names'

type Draft = { id: string | null; name: string; is_active: boolean }

/** Daftar shift toko: nama bebas (Pagi/Sore, Shift 1/2/3), urutan, dan aktif/tidak. Kasir memilihnya saat buka shift. */
export function ShiftNamesSettings() {
  const { names, loaded, reload } = useShiftNames()
  const [rows, setRows] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => setRows(names.map((n) => ({ id: n.id, name: n.name, is_active: n.is_active }))), [names])

  const dirty = JSON.stringify(rows) !== JSON.stringify(names.map((n) => ({ id: n.id, name: n.name, is_active: n.is_active })))
  const patch = (i: number, p: Partial<Draft>) => setRows((r) => r.map((x, n) => (n === i ? { ...x, ...p } : x)))
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const n = [...r]
      ;[n[i], n[i + d]] = [n[i + d], n[i]]
      return n
    })
  const preset = (list: string[]) => setRows(list.map((name) => ({ id: null, name, is_active: true })))

  const save = async () => {
    if (rows.some((r) => !r.name.trim())) return toast.error('Ada nama shift yang kosong', { description: 'Isi namanya dulu, mis. Pagi.' })
    setBusy(true)
    const { error } = await rpc('save_shift_names', { p_items: rows })
    setBusy(false)
    if (error) return toast.error('Daftar shift gagal disimpan', { description: `${error.message} Coba lagi.` })
    toast.success('Daftar shift tersimpan')
    void reload()
  }

  return (
    <SectionCard title="Daftar shift" hint="Kasir memilih salah satu saat membuka shift. Laporan dipisah per shift.">
      <div className="space-y-3">
        {loaded && rows.length === 0 && (
          <div className="space-y-2 rounded-xl border-2 border-dashed p-4">
            <p className="text-base font-semibold">Belum ada daftar shift</p>
            <p className="text-base text-muted-foreground">Tanpa daftar, kasir membuka shift tanpa memilih nama. Mulai cepat:</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-12 border-2 text-base" onClick={() => preset(['Pagi', 'Sore'])}>Pagi & Sore</Button>
              <Button variant="outline" className="h-12 border-2 text-base" onClick={() => preset(['Pagi', 'Sore', 'Malam'])}>Pagi, Sore, Malam</Button>
              <Button variant="outline" className="h-12 border-2 text-base" onClick={() => preset(['Shift 1', 'Shift 2', 'Shift 3'])}>Shift 1, 2, 3</Button>
            </div>
          </div>
        )}
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
              <Input value={r.name} maxLength={30} aria-label={`Nama shift ${i + 1}`} placeholder="Nama shift, mis. Pagi" onChange={(e) => patch(i, { name: e.target.value })} className="h-12 min-w-40 flex-1 text-base" />
              <Button variant="outline" size="icon" className="size-12 border-2" aria-label={`Naikkan ${r.name}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
              <Button variant="outline" size="icon" className="size-12 border-2" aria-label={`Turunkan ${r.name}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
              <label className="flex h-12 items-center gap-2 text-base">
                <Switch checked={r.is_active} onCheckedChange={(v) => patch(i, { is_active: v })} aria-label={`${r.name} dipakai`} /> {r.is_active ? 'Dipakai' : 'Tidak dipakai'}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-12 border-2 px-4 text-base" onClick={() => setRows((r) => [...r, { id: null, name: '', is_active: true }])}><Plus /> Tambah shift</Button>
          <Button className="h-12 px-5 text-base font-bold" disabled={!dirty || busy} onClick={() => void save()}>{busy ? 'Menyimpan…' : 'Simpan daftar shift'}</Button>
        </div>
      </div>
    </SectionCard>
  )
}

/** Hak akses per peran: ketuk kotak untuk mengizinkan/melarang. Tersimpan langsung. Pemilik selalu boleh semua. */
export function PermissionSettings() {
  const { rolesOf, reload } = usePermissions('owner')
  const [busy, setBusy] = useState('')

  const toggle = async (p: Permission, role: (typeof ROLES)[number]['key']) => {
    const cur = rolesOf(p)
    const next = cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]
    setBusy(`${p}:${role}`)
    const { error } = await rpc('save_permission', { p_permission: p, p_roles: next })
    setBusy('')
    if (error) return toast.error('Hak akses gagal disimpan', { description: `${error.message} Coba lagi.` })
    await reload()
    toast.success('Hak akses tersimpan')
  }

  return (
    <SectionCard title="Hak akses" hint="Siapa boleh mengerjakan apa. Pemilik selalu boleh semua. Tersimpan langsung.">
      <ul className="divide-y">
        {PERMISSIONS.map((p) => (
          <li key={p.key} className="space-y-2 py-4 first:pt-0 last:pb-0">
            <div>
              <p className="text-lg font-bold">{p.label}</p>
              <p className="text-base text-muted-foreground">{p.hint}</p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Peran yang boleh: ${p.label}`}>
              {ROLES.map((r) => {
                const on = rolesOf(p.key).includes(r.key)
                return (
                  <button
                    key={r.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={busy !== ''}
                    onClick={() => void toggle(p.key, r.key)}
                    className={`inline-flex h-12 items-center gap-2 rounded-xl border-2 px-4 text-base font-semibold ${on ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                  >
                    <span className={`grid size-6 place-items-center rounded-md border-2 ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-foreground/40'}`}>{on && <Check className="size-4" aria-hidden />}</span>
                    {r.label}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
