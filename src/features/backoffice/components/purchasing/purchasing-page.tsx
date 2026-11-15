import { ClipboardList, HandCoins, History, PackageCheck, Pencil, Plus, Truck, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmButton } from '@shared/components/confirm-button'
import { RowsSkeleton } from '@shared/components/skeletons'
import { Button } from '@shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import { buyUnit, fmtQty, useInventory } from '../inventory/data'
import { STATUS, day, received, usePurchasing, type Purchase, type PurchaseItem, type Supplier } from './data'
import { OrderPanel, PayPanel, ReceivePanel, SupplierPanel } from './panels'

type Tab = 'jalan' | 'utang' | 'riwayat' | 'pemasok'

const Empty = ({ title, hint }: { title: string; hint: string }) => (
  <div className="rounded-2xl border-2 border-dashed px-6 py-10 text-center">
    <p className="text-xl font-bold">{title}</p>
    <p className="mt-1 text-lg text-muted-foreground">{hint}</p>
  </div>
)

/** Halaman Pembelian: daftar belanja → dipesan → diterima (boleh sebagian) → dibayar / utang. */
export function PurchasingPage() {
  const inv = useInventory()
  const data = usePurchasing()
  const [tab, setTab] = useState<Tab>('jalan')
  const [editing, setEditing] = useState<{ po: Purchase | null } | null>(null)
  const [receiving, setReceiving] = useState<Purchase | null>(null)
  const [paying, setPaying] = useState<Purchase | null>(null)
  const [supplier, setSupplier] = useState<{ item: Supplier | null } | null>(null)

  const itemsOf = (id: string) => data.items.filter((i) => i.purchase_id === id)
  const byIng = new Map(inv.items.map((i) => [i.id, i]))
  const running = data.purchases.filter((p) => p.status === 'DRAFT' || p.status === 'ORDERED')
  const debts = data.purchases.filter((p) => p.unpaid > 0)
  const history = data.purchases.filter((p) => p.status === 'RECEIVED' || p.status === 'CANCELLED')
  const debtTotal = debts.reduce((n, p) => n + p.unpaid, 0)
  const refresh = () => {
    void data.reload()
    void inv.reload()
  }

  const cancel = async (p: Purchase) => {
    const { error } = await rpc('cancel_purchase', { p_id: p.id })
    if (error) return toast.error('Belum bisa dibatalkan', { description: error.message })
    toast.success('Daftar belanja dibatalkan')
    refresh()
  }

  const lines = (rows: PurchaseItem[]) =>
    rows.map((i) => {
      const ing = byIng.get(i.ingredient_id)
      return `${fmtQty(i.qty)} ${ing ? buyUnit(ing) : ''} ${ing?.name ?? 'bahan'}`.replace(/\s+/g, ' ')
    }).join(', ')

  const Card = ({ p, children }: { p: Purchase; children?: React.ReactNode }) => {
    const rows = itemsOf(p.id)
    const got = rows.filter((i) => received(i) >= i.qty).length
    return (
      <li className="space-y-3 rounded-2xl border-2 bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
              {p.supplier || 'Tanpa pemasok'}
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${STATUS[p.status].pill}`}>{STATUS[p.status].label}</span>
              {p.unpaid > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-900 dark:bg-red-500/20 dark:text-red-200">Utang {rupiah(p.unpaid)}</span>}
            </p>
            <p className="text-base text-muted-foreground">{lines(rows) || 'Tanpa rincian'}</p>
            <p className="text-sm text-muted-foreground">
              Dibuat {day(p.created_at)}
              {p.status === 'ORDERED' && rows.length > 0 && ` · ${got} dari ${rows.length} bahan sudah datang`}
              {p.received_at && ` · diterima ${day(p.received_at)}`}
            </p>
          </div>
          <p className="shrink-0 text-xl font-extrabold tabular-nums">{rupiah(p.total)}</p>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </li>
    )
  }

  const TABS: { value: Tab; label: string; hint: string; icon: typeof History; count?: number }[] = [
    { value: 'jalan', label: 'Daftar belanja', hint: 'Belum datang semua', icon: ClipboardList, count: running.length },
    { value: 'utang', label: 'Belum dibayar', hint: 'Utang ke pemasok', icon: HandCoins, count: debts.length },
    { value: 'riwayat', label: 'Riwayat', hint: 'Yang sudah selesai', icon: History },
    { value: 'pemasok', label: 'Pemasok', hint: 'Tempat membeli', icon: Truck },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Pembelian</h1>
          <p className="mt-1 text-lg text-muted-foreground">Rencanakan belanja, terima barang, dan catat utang ke pemasok.</p>
        </div>
        <Button className="h-12 px-5 text-base font-bold" disabled={!inv.loaded || inv.items.length === 0} onClick={() => setEditing({ po: null })}>
          <Plus /> Buat daftar belanja
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-5">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b scrollbar-none">
          {TABS.map(({ value, label, hint, icon: Icon, count }) => (
            <TabsTrigger key={value} value={value} className="h-auto flex-none flex-col items-start gap-0 px-4 py-2.5">
              <span className="flex items-center gap-2 text-base font-bold">
                <Icon className="size-4" aria-hidden /> {label}
                {!!count && <span className="rounded-full bg-red-600 px-2 text-sm font-extrabold text-white">{count}</span>}
              </span>
              <span className="text-sm font-normal text-muted-foreground">{hint}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {!data.loaded ? (
          <RowsSkeleton rows={4} />
        ) : (
          <>
            <TabsContent value="jalan">
              {running.length === 0 ? (
                <Empty title="Tidak ada belanja yang sedang berjalan" hint="Tekan “Buat daftar belanja”. Bahan yang hampir habis otomatis diusulkan." />
              ) : (
                <ul className="space-y-3">
                  {running.map((p) => {
                    const started = itemsOf(p.id).some((i) => received(i) > 0)
                    return (
                      <Card key={p.id} p={p}>
                        <Button className="h-12 px-5 text-base font-bold" onClick={() => setReceiving(p)}><PackageCheck /> Terima barang</Button>
                        {!started && <Button variant="outline" className="h-12 border-2 px-4 text-base" onClick={() => setEditing({ po: p })}><Pencil /> Ubah</Button>}
                        {!started && (
                          <ConfirmButton variant="ghost" className="h-12 px-4 text-base text-destructive" title="Batalkan daftar belanja ini?" description="Stok tidak berubah. Daftar ini pindah ke Riwayat sebagai dibatalkan." confirmLabel="Ya, batalkan" cancelLabel="Jangan dibatalkan" onConfirm={() => void cancel(p)}>
                            Batalkan
                          </ConfirmButton>
                        )}
                      </Card>
                    )
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="utang" className="space-y-3">
              {debts.length === 0 ? (
                <Empty title="Tidak ada utang ke pemasok" hint="Belanja yang dipilih “Bayar nanti” saat menerima barang akan muncul di sini." />
              ) : (
                <>
                  <p className="rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-3 text-lg font-bold text-red-900 dark:bg-red-500/10 dark:text-red-100">Total utang: {rupiah(debtTotal)} ke {new Set(debts.map((d) => d.supplier)).size} pemasok</p>
                  <ul className="space-y-3">
                    {debts.map((p) => (
                      <Card key={p.id} p={p}>
                        <Button className="h-12 px-5 text-base font-bold" onClick={() => setPaying(p)}><Wallet /> Bayar utang</Button>
                      </Card>
                    ))}
                  </ul>
                </>
              )}
            </TabsContent>

            <TabsContent value="riwayat">
              {history.length === 0 ? (
                <Empty title="Belum ada riwayat pembelian" hint="Barang masuk dan belanja yang sudah diterima akan tercatat di sini." />
              ) : (
                <ul className="space-y-3">{history.map((p) => <Card key={p.id} p={p} />)}</ul>
              )}
            </TabsContent>

            <TabsContent value="pemasok" className="space-y-3">
              <Button variant="outline" className="h-12 border-2 px-4 text-base" onClick={() => setSupplier({ item: null })}><Plus /> Pemasok baru</Button>
              {data.suppliers.length === 0 ? (
                <Empty title="Belum ada pemasok" hint="Tambahkan tempat kamu biasa belanja, mis. Pasar atau Toko Makmur." />
              ) : (
                <ul className="divide-y rounded-2xl border-2 bg-card">
                  {data.suppliers.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold">{s.name}{!s.is_active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-sm">Tidak dipakai</span>}</p>
                        <p className="text-base text-muted-foreground">{[s.phone, s.note].filter(Boolean).join(' · ') || 'Tanpa nomor HP'}</p>
                      </div>
                      <Button variant="outline" className="h-12 border-2 px-4 text-base" aria-label={`Ubah ${s.name}`} onClick={() => setSupplier({ item: s })}><Pencil /> Ubah</Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {editing && !supplier && (
        <OrderPanel po={editing.po} poItems={editing.po ? itemsOf(editing.po.id) : []} ingredients={inv.items} suppliers={data.suppliers} onClose={() => setEditing(null)} onNewSupplier={() => setSupplier({ item: null })} onDone={() => { setEditing(null); refresh() }} />
      )}
      {receiving && <ReceivePanel po={receiving} poItems={itemsOf(receiving.id)} ingredients={inv.items} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); refresh() }} />}
      {paying && <PayPanel po={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); refresh() }} />}
      {supplier && <SupplierPanel supplier={supplier.item} onClose={() => setSupplier(null)} onDone={() => { setSupplier(null); refresh() }} />}
    </div>
  )
}
