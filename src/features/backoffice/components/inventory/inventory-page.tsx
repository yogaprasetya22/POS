import { ClipboardList, Download, FileSpreadsheet, History, PackagePlus, Upload, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import type { Product, Store } from '@shared/types/contracts'
import { IngredientPanel, PurchasePanel, WastePanel } from './actions'
import { useInventory, type Ingredient } from './data'
import { downloadTemplate } from './excel'
import { ImportPanel } from './import-panel'
import { RecipeEditor } from './recipe-editor'
import { StockHistory } from './stock-history'
import { StockList } from './stock-list'
import { StockOpname } from './stock-opname'

type Tab = 'stok' | 'resep' | 'opname' | 'riwayat'
const TABS: { value: Tab; label: string; hint: string; icon: typeof History }[] = [
  { value: 'stok', label: 'Inventory Stock', hint: 'Stok bahan', icon: FileSpreadsheet },
  { value: 'resep', label: 'Resep menu', hint: 'Bahan per porsi', icon: UtensilsCrossed },
  { value: 'opname', label: 'Stock Opname', hint: 'Hitung stok di rak', icon: ClipboardList },
  { value: 'riwayat', label: 'Riwayat', hint: 'Keluar-masuk stok', icon: History },
]

/** Halaman Inventory Stock: 4 tab dengan satu tujuan masing-masing. */
export function InventoryPage({ store, products, onCatalogChanged }: { store: Store; products: Product[]; onCatalogChanged: () => void }) {
  const inv = useInventory()
  const [tab, setTab] = useState<Tab>('stok')
  const [buying, setBuying] = useState<{ initial?: string } | null>(null)
  const [wasting, setWasting] = useState<Ingredient | null>(null)
  const [editing, setEditing] = useState<{ item: Ingredient | null; barcode?: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // stok & resep memengaruhi sisa porsi menu: muat ulang katalog juga
  const refresh = () => {
    void inv.reload()
    onCatalogChanged()
  }

  const download = async () => {
    setDownloading(true)
    try {
      await downloadTemplate(store.name, inv.items, inv.recipes, inv.barcodes, products)
      toast.success('Template Excel terunduh. Isi, simpan, lalu tekan “Import Excel”.')
    } catch {
      toast.error('Template gagal dibuat. Coba lagi.')
    }
    setDownloading(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Inventory Stock</h1>
          <p className="mt-1 text-lg text-muted-foreground">Stok bahan & resep. Stok berkurang otomatis saat pesanan dibayar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-12 border-2 px-4 text-base" disabled={downloading} onClick={() => void download()}>
            <Download /> {downloading ? 'Menyiapkan…' : 'Unduh template Excel'}
          </Button>
          <Button variant="outline" className="h-12 border-2 px-4 text-base" onClick={() => setImporting(true)}>
            <Upload /> Import Excel
          </Button>
          <Button className="h-12 px-5 text-base font-bold" disabled={inv.items.length === 0} onClick={() => setBuying({})}>
            <PackagePlus /> Barang masuk
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-5">
        <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b scrollbar-none">
          {TABS.map(({ value, label, hint, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="h-auto flex-none flex-col items-start gap-0 px-4 py-2.5">
              <span className="flex items-center gap-2 text-base font-bold"><Icon className="size-4" aria-hidden /> {label}</span>
              <span className="text-sm font-normal text-muted-foreground">{hint}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stok">
          <StockList
            items={inv.items}
            barcodes={inv.barcodes}
            loaded={inv.loaded}
            onBuy={(id) => setBuying({ initial: id })}
            onWaste={setWasting}
            onEdit={(i) => setEditing({ item: i })}
            onNew={() => setEditing({ item: null })}
          />
        </TabsContent>
        <TabsContent value="resep">
          <RecipeEditor products={products} items={inv.items} recipes={inv.recipes} storeId={store.id} onChanged={refresh} onNewIngredient={() => setEditing({ item: null })} />
        </TabsContent>
        <TabsContent value="opname">
          <StockOpname items={inv.items} barcodes={inv.barcodes} storeId={store.id} onDone={refresh} onNeedNewIngredient={(code) => setEditing({ item: null, barcode: code })} />
        </TabsContent>
        <TabsContent value="riwayat">
          <StockHistory items={inv.items} />
        </TabsContent>
      </Tabs>

      {buying && (
        <PurchasePanel
          items={inv.items}
          barcodes={inv.barcodes}
          storeId={store.id}
          initial={buying.initial}
          onClose={() => setBuying(null)}
          onDone={() => {
            setBuying(null)
            refresh()
          }}
          onNeedNewIngredient={(code) => {
            setBuying(null)
            setEditing({ item: null, barcode: code })
          }}
        />
      )}
      {wasting && (
        <WastePanel
          item={wasting}
          onClose={() => setWasting(null)}
          onDone={() => {
            setWasting(null)
            refresh()
          }}
        />
      )}
      {editing && (
        <IngredientPanel
          item={editing.item}
          storeId={store.id}
          barcodes={inv.barcodes}
          initialBarcode={editing.barcode}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      {importing && (
        <ImportPanel
          items={inv.items}
          products={products}
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
