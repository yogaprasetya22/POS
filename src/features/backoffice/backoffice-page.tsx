import {
  BarChart3,
  LayoutDashboard,
  Tag,
  Store as StoreIcon,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCatalog } from '@features/menu-catalog'
import { ErrorAlert } from '@shared/components/error-alert'
import { PageSkeleton } from '@shared/components/page-skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { useStaff } from '@shared/lib/auth'
import { MenuTab } from './components/menu-tab'
import { OverviewTab } from './components/overview-tab'
import { PromoTab } from './components/promo-tab'
import { SalesReport } from './components/sales-report'
import { StaffList } from './components/staff-list'
import { StoreTab } from './components/store-tab'

const TAB_ITEMS = [
  { value: 'ikhtisar', label: 'Ikhtisar', icon: LayoutDashboard },
  { value: 'menu', label: 'Katalog Menu', icon: UtensilsCrossed },
  { value: 'promo', label: 'Promo & Diskon', icon: Tag },
  { value: 'penjualan', label: 'Laporan & Penjualan', icon: BarChart3 },
  { value: 'staf', label: 'Tim & Staf', icon: Users },
  { value: 'toko', label: 'Pengaturan Toko', icon: StoreIcon },
] as const

type TabKey = (typeof TAB_ITEMS)[number]['value']

/**
 * Halaman Manajemen Backoffice Toko (/admin)
 * Disusun dengan 5 tab mandiri terpadu, sinkronisasi URL search params,
 * dan tampilan dashboard modern berbasis prinsip Ponytail.
 */
export function BackofficePage() {
  const { storeId } = useStaff()
  const { data, error, reload } = useCatalog('id', storeId)
  const [msg, setMsg] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [isAddingProduct, setIsAddingProduct] = useState(false)

  const currentTab = (searchParams.get('tab') as TabKey) || 'ikhtisar'

  if (error) return <p className="p-6 text-destructive">{error}</p>
  if (!data) return <PageSkeleton />

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    setMsg(error?.message ?? '')
    if (!error) reload()
  }

  const handleTabChange = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'ikhtisar') {
          next.delete('tab')
        } else {
          next.set('tab', value)
        }
        return next
      },
      { replace: true }
    )
  }

  const handleOpenNewProduct = () => {
    setIsAddingProduct(true)
    handleTabChange('menu')
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ErrorAlert message={msg} />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        {/* Modern Pill Navigation Tabs Bar */}
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <TabsList
            variant="pills"
            className="group-data-horizontal/tabs:h-auto h-auto inline-flex items-center justify-start gap-1 rounded-full bg-card p-1 border shadow-xs"
          >
            {TAB_ITEMS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-9 rounded-full px-4 text-xs font-semibold gap-2 transition-all data-active:bg-primary data-active:text-primary-foreground data-active:shadow-xs"
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab 1: Ikhtisar (Dashboard Overview) */}
        <TabsContent value="ikhtisar" className="focus-visible:outline-none focus-visible:ring-0">
          <OverviewTab
            products={data.products}
            categories={data.categories}
            store={data.store}
            run={run}
            reload={reload}
            onNavigateTab={handleTabChange}
            onOpenNewProduct={handleOpenNewProduct}
          />
        </TabsContent>

        {/* Tab 2: Katalog Menu */}
        <TabsContent value="menu" className="focus-visible:outline-none focus-visible:ring-0">
          <MenuTab
            products={data.products}
            categories={data.categories}
            run={run}
            reload={reload}
            isAddingNew={isAddingProduct}
            onAddFinished={() => setIsAddingProduct(false)}
          />
        </TabsContent>

        {/* Tab Promo & Diskon */}
        <TabsContent value="promo" className="focus-visible:outline-none focus-visible:ring-0">
          <PromoTab
            storeId={data.store.id}
            products={data.products}
            categories={data.categories}
            reloadCatalog={reload}
            run={run}
          />
        </TabsContent>

        {/* Tab 3: Laporan & Penjualan */}
        <TabsContent value="penjualan" className="focus-visible:outline-none focus-visible:ring-0">
          <SalesReport />
        </TabsContent>

        {/* Tab 4: Tim & Staf */}
        <TabsContent value="staf" className="focus-visible:outline-none focus-visible:ring-0">
          <StaffList />
        </TabsContent>

        {/* Tab 5: Pengaturan Toko */}
        <TabsContent value="toko" className="focus-visible:outline-none focus-visible:ring-0">
          <StoreTab store={data.store} run={run} fail={setMsg} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
