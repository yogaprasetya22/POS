import { ChevronRight, ClipboardList, HandCoins, History, MessageCircle, PackageCheck, PackagePlus, Pencil, Plus, Send, Truck, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmButton } from '@shared/components/confirm-button'
import { RowsSkeleton } from '@shared/components/skeletons'
import { Button } from '@shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { rpc } from '@shared/lib/api'
import { useStaff } from '@shared/lib/auth'
import { PurchasePanel } from '../inventory/actions'
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
  const [quick, setQuick] = useState(false)
  const [busyId, setBusyId] = useState('')
  const { storeId } = useStaff()

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

  // Daftar yang belum dipesan: langkah berikutnya adalah memesan, bukan menerima barang
  const markOrdered = async (p: Purchase) => {
    if (!p.supplier_id) {
      toast.error('Pilih pemasok dulu', { description: 'Tekan “Ubah”, pilih pemasoknya, lalu tekan “Sudah dipesan ke pemasok”.' })
      return setEditing({ po: p })
    }
    setBusyId(p.id)
    const { error } = await rpc('save_purchase_order', {
      p_id: p.id,
      p_supplier_id: p.supplier_id,
      p_items: itemsOf(p.id).map((i) => ({ ingredient_id: i.ingredient_id, qty: i.qty, unit_price: i.unit_price })),
      p_note: p.note,
      p_ordered: true,
    })
    setBusyId('')
    if (error) return toast.error('Belum bisa ditandai', { description: `${error.message} Coba lagi.` })
    toast.success(`Ditandai sudah dipesan ke ${p.supplier}. Tekan “Terima barang” saat barangnya datang.`)
    refresh()
  }

  const waLink = (phone: string, text?: string) => {
    const n = phone.replace(/\D/g, '').replace(/^0/, '62')
    return n.length >= 9 ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null
  }
  const supplierOf = (p: Purchase) => data.suppliers.find((s) => s.id === p.supplier_id)

  const lines = (rows: PurchaseItem[]) =>
    rows.map((i) => {
      const ing = byIng.get(i.ingredient_id)
      return `${fmtQty(i.qty)} ${ing ? buyUnit(ing) : ''} ${ing?.name ?? 'bahan'}`.replace(/\s+/g, ' ')
    }).join(', ')

  const Card = ({ p, actions }: { p: Purchase; actions?: boolean }) => {
    const rows = itemsOf(p.id)
    const got = rows.filter((i) => received(i) >= i.qty).length
    const arrived = rows.reduce((n, i) => n + Math.round(received(i) * i.unit_price), 0)
    const started = rows.some((i) => received(i) > 0)
    const sup = supplierOf(p)
    const wa = sup?.phone ? waLink(sup.phone, p.status === 'DRAFT' ? `Halo ${sup.name}, saya mau pesan: ${lines(rows)}. Terima kasih.` : undefined) : null
    const btn = 'h-12 px-4 text-base'
    return (
      <li className="space-y-3 rounded-2xl border-2 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="text-lg font-bold leading-tight">{p.supplier || 'Tanpa pemasok'}</p>
            <p className="flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${STATUS[p.status].pill}`}>{STATUS[p.status].label}</span>
              {p.unpaid > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-900 dark:bg-red-500/20 dark:text-red-200">Utang {rupiah(p.unpaid)}</span>}
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-sm font-semibold text-muted-foreground">{p.status === 'RECEIVED' ? 'Total belanja' : 'Total pesanan'}</span>
            <span className="block text-xl font-extrabold tabular-nums">{rupiah(p.total)}</span>
          </p>
        </div>
        <p className="text-base">{lines(rows) || 'Tanpa rincian'}</p>
        <p className="text-base text-muted-foreground">
          Dibuat {day(p.created_at)}
          {p.status === 'ORDERED' && rows.length > 0 && <span className="font-semibold text-foreground"> · {got} dari {rows.length} bahan sudah datang{arrived > 0 ? ` (${rupiah(arrived)})` : ''}</span>}
          {p.received_at && ` · diterima ${day(p.received_at)}`}
        </p>
        {actions && (
          <div className="flex flex-wrap gap-2">
            {p.status === 'DRAFT' ? (
              <>
                <Button className={`${btn} font-bold`} disabled={busyId === p.id} onClick={() => void markOrdered(p)}><Send /> {busyId === p.id ? 'Menyimpan…' : 'Sudah saya pesan'}</Button>
                <Button variant="outline" className={`${btn} border-2`} onClick={() => setReceiving(p)}><PackageCheck /> Barang sudah datang</Button>
              </>
            ) : p.status === 'ORDERED' ? (
              <Button className={`${btn} font-bold`} onClick={() => setReceiving(p)}><PackageCheck /> Terima barang</Button>
            ) : null}
            {p.unpaid > 0 && <Button variant={p.status === 'RECEIVED' ? 'default' : 'outline'} className={`${btn} ${p.status === 'RECEIVED' ? 'font-bold' : 'border-2'}`} onClick={() => setPaying(p)}><Wallet /> Bayar utang</Button>}
            {wa && (p.status === 'DRAFT' || p.status === 'ORDERED') && (
              <a href={wa} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-full border-2 ${btn} font-medium hover:bg-muted`}><MessageCircle className="size-5" aria-hidden /> {p.status === 'DRAFT' ? 'Pesan lewat WhatsApp' : 'Chat pemasok'}</a>
            )}
            {!started && (p.status === 'DRAFT' || p.status === 'ORDERED') && (
              <>
                <Button variant="outline" className={`${btn} border-2`} onClick={() => setEditing({ po: p })}><Pencil /> Ubah</Button>
                <ConfirmButton variant="outline" className={`${btn} border-2 text-destructive`} title="Batalkan daftar belanja ini?" description="Stok tidak berubah. Daftar ini pindah ke Riwayat sebagai dibatalkan." confirmLabel="Ya, batalkan" cancelLabel="Jangan dibatalkan" onConfirm={() => void cancel(p)}>
                  Batalkan
                </ConfirmButton>
              </>
            )}
          </div>
        )}
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
          <p className="mt-1 hidden text-lg text-muted-foreground sm:block">Rencanakan belanja, terima barang, dan catat utang ke pemasok.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button variant="outline" className="h-12 border-2 px-4 text-base" disabled={!inv.loaded || inv.items.length === 0} onClick={() => setQuick(true)}>
            <PackagePlus /> Belanja langsung
          </Button>
          <Button className="h-12 px-5 text-base font-bold" disabled={!inv.loaded || inv.items.length === 0} onClick={() => setEditing({ po: null })}>
            <Plus /> Buat daftar belanja
          </Button>
        </div>
      </div>

      <ol aria-label="Cara memakai" className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl bg-muted/60 px-4 py-3 text-base sm:flex sm:flex-wrap sm:items-center sm:gap-x-2">
        {['Tulis daftar belanja', 'Pesan ke pemasok', 'Terima barang', 'Bayar'].map((t, i, all) => (
          <li key={t} className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
            <span className="font-semibold">{t}</span>
            {i < all.length - 1 && <ChevronRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />}
          </li>
        ))}
        <li className="col-span-2 w-full text-muted-foreground">Belanja ke pasar dan langsung bawa pulang? Pakai “Belanja langsung”: stok langsung bertambah.</li>
      </ol>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-5">
        <TabsList variant="line" className="grid h-auto w-full grid-cols-2 gap-1 border-b sm:flex sm:justify-start">
          {TABS.map(({ value, label, hint, icon: Icon, count }) => (
            <TabsTrigger key={value} value={value} className="h-auto min-h-14 flex-col items-start justify-center gap-0 px-3 py-2.5 sm:flex-none sm:px-4">
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
                    return (
                      <Card key={p.id} p={p} actions />
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
                      <Card key={p.id} p={p} actions />
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
                      {s.phone && waLink(s.phone) && (
                        <a href={waLink(s.phone)!} target="_blank" rel="noreferrer" aria-label={`Chat WhatsApp ${s.name}`} className="inline-flex h-12 items-center gap-2 rounded-full border-2 px-4 text-base font-medium hover:bg-muted"><MessageCircle className="size-5" aria-hidden /> WhatsApp</a>
                      )}
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
      {quick && storeId && (
        <PurchasePanel items={inv.items} barcodes={inv.barcodes} storeId={storeId} onClose={() => setQuick(false)} onDone={() => { setQuick(false); refresh() }} onNeedNewIngredient={() => { setQuick(false); toast('Bahan baru dibuat di Inventory Stock', { description: 'Buka Lainnya → Inventory Stock → Bahan baru.' }) }} />
      )}
      {paying && <PayPanel po={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); refresh() }} />}
      {supplier && <SupplierPanel supplier={supplier.item} onClose={() => setSupplier(null)} onDone={() => { setSupplier(null); refresh() }} />}
    </div>
  )
}
