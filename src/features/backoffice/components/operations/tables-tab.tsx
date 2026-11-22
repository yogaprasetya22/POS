import { Check, Copy, Plus, Printer, QrCode, Trash2 } from 'lucide-react'
import { SkeletonContainer } from '@shared/components/ui/skeleton-container'
import { CardGridSkeleton } from '@shared/components/skeletons'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { ConfirmButton } from '@shared/components/confirm-button'
import { ErrorAlert } from '@shared/components/error-alert'
import { Chip, PageHeader } from '@shared/components/page'
import { EmptyState } from '@shared/components/pagination'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Switch } from '@shared/components/ui/switch'
import { supabase } from '@shared/lib/supabase'
import type { Store } from '@shared/types/contracts'

const TableRowSchema = z.object({ id: z.uuid(), label: z.string(), sort: z.number(), is_active: z.boolean() })
type TableRow = z.infer<typeof TableRowSchema>

/** Meja & QR: pelanggan hanya bisa memesan di meja yang terdaftar (anti pesanan palsu). */
export function TablesTab({ store }: { store: Store }) {
  const [tables, setTables] = useState<TableRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [qr, setQr] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState('')
  const [sheet, setSheet] = useState<{ label: string; src: string }[] | null>(null)

  const linkOf = useCallback((l: string) => `${window.location.origin}/s/${store.slug}?meja=${encodeURIComponent(l)}`, [store.slug])

  const load = useCallback(async () => {
    const { data } = await supabase.from('store_tables').select('*').order('sort').order('label')
    const parsed = z.array(TableRowSchema).safeParse(data ?? [])
    if (parsed.success) setTables(parsed.data)
    setLoaded(true)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  // Pratinjau QR tiap meja (library QR dimuat lazy, hanya di halaman ini)
  useEffect(() => {
    let alive = true
    void (async () => {
      const { default: QRCode } = await import('qrcode')
      const entries = await Promise.all(tables.map(async (t) => [t.label, await QRCode.toDataURL(linkOf(t.label), { margin: 1, width: 240 })] as const))
      if (alive) setQr(Object.fromEntries(entries))
    })()
    return () => {
      alive = false
    }
  }, [tables, linkOf])

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: err } = await p
    setError(err?.message ?? '')
    if (!err) void load()
    return !err
  }

  const addOne = async () => {
    const l = label.trim().toUpperCase()
    if (!l) return
    if (tables.some((t) => t.label.toLowerCase() === l.toLowerCase())) return setError(`Meja ${l} sudah ada.`)
    if (await run(supabase.from('store_tables').insert({ store_id: store.id, label: l, sort: tables.length + 1 }))) setLabel('')
  }

  const addMany = async (n: number) => {
    const have = new Set(tables.map((t) => t.label.toLowerCase()))
    const rows = Array.from({ length: n }, (_, i) => `T${i + 1}`)
      .filter((l) => !have.has(l.toLowerCase()))
      .map((l, i) => ({ store_id: store.id, label: l, sort: tables.length + i + 1 }))
    if (rows.length === 0) return setError(`Meja T1–T${n} sudah ada semua.`)
    await run(supabase.from('store_tables').insert(rows))
  }

  const copy = async (l: string) => {
    await navigator.clipboard.writeText(linkOf(l))
    setCopied(l)
    setTimeout(() => setCopied(''), 1500)
  }

  const print = (list: TableRow[]) => {
    setSheet(list.filter((t) => qr[t.label]).map((t) => ({ label: t.label, src: qr[t.label] })))
    setTimeout(() => {
      window.print()
      setSheet(null)
    }, 300)
  }

  const active = tables.filter((t) => t.is_active)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meja & QR"
        description="Tempel QR di meja; pelanggan scan lalu memesan tanpa mengetik nomor meja. Kalau ada meja terdaftar, pesanan hanya diterima dari meja itu."
        actions={
          <Button variant="outline" className="h-11" disabled={active.length === 0} onClick={() => print(active)}>
            <Printer /> Cetak semua QR
          </Button>
        }
      />
      <ErrorAlert message={error} />

      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void addOne()
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10))} placeholder="Contoh: T9 atau VIP1" aria-label="Nomor meja" className="h-11 w-60 font-mono placeholder:font-sans" />
        <Button type="submit" className="h-11" disabled={!label.trim()}>
          <Plus /> Tambah meja
        </Button>
        {tables.length > 0 && <span className="ml-auto text-sm text-muted-foreground">{tables.length} meja · {active.length} aktif</span>}
      </form>

      {!loaded ? (
        <CardGridSkeleton count={8} tall />
      ) : tables.length === 0 ? (
        <EmptyState title="Belum ada meja terdaftar" hint="Pelanggan masih bisa mengetik nomor meja sembarang. Buat meja supaya pesanan hanya masuk dari meja yang ada.">
          <div className="flex flex-wrap justify-center gap-2">
            {[5, 10, 20].map((n) => (
              <Button key={n} variant="outline" className="h-11" onClick={() => addMany(n)}>
                <QrCode /> Buat {n} meja (T1–T{n})
              </Button>
            ))}
          </div>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-3">
          {tables.map((t) => (
            <li key={t.id} className={`flex flex-col items-center gap-3 rounded-xl border bg-card p-4 ${t.is_active ? '' : 'opacity-60'}`}>
              <div className="grid size-32 place-items-center rounded-lg border bg-white p-1.5">
                {qr[t.label] ? <img src={qr[t.label]} alt={`QR meja ${t.label}`} className="size-full" /> : <SkeletonContainer isLoading className="size-full"><span className="block size-full">QR</span></SkeletonContainer>}
              </div>
              <div className="text-center">
                <p className="font-mono text-xl font-semibold leading-none">{t.label}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Switch checked={t.is_active} aria-label={`Meja ${t.label} aktif`} onCheckedChange={(v) => run(supabase.from('store_tables').update({ is_active: v }).eq('id', t.id))} />
                  <Chip tone={t.is_active ? 'good' : 'neutral'}>{t.is_active ? 'Aktif' : 'Nonaktif'}</Chip>
                </div>
              </div>
              <div className="flex w-full items-center justify-center gap-1 border-t pt-3">
                <Button variant="ghost" size="icon" className="size-11" aria-label={`Salin link meja ${t.label}`} title="Salin link" onClick={() => copy(t.label)}>
                  {copied === t.label ? <Check className="text-emerald-600" /> : <Copy />}
                </Button>
                <Button variant="ghost" size="icon" className="size-11" aria-label={`Cetak QR meja ${t.label}`} title="Cetak QR" disabled={!qr[t.label]} onClick={() => print([t])}>
                  <Printer />
                </Button>
                <ConfirmButton
                  variant="ghost"
                  size="icon"
                  className="size-11 text-destructive hover:text-destructive"
                  aria-label={`Hapus meja ${t.label}`}
                  title={`Hapus meja ${t.label}?`}
                  description="QR meja ini berhenti bisa dipakai untuk memesan."
                  confirmLabel="Hapus meja"
                  onConfirm={() => run(supabase.from('store_tables').delete().eq('id', t.id))}
                >
                  <Trash2 />
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <div id="qr-sheet" className="fixed inset-0 z-[100] grid grid-cols-3 content-start gap-6 bg-white p-8 text-black">
          {sheet.map((q) => (
            <div key={q.label} className="break-inside-avoid text-center">
              <img src={q.src} alt={`QR meja ${q.label}`} className="mx-auto size-48" />
              <p className="mt-1 text-2xl font-bold">Meja {q.label}</p>
              <p className="text-sm">Scan untuk memesan</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
