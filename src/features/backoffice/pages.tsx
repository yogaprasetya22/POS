import { Navigate, useSearchParams } from 'react-router'
import { PurchasingPage } from './components/purchasing/purchasing-page'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
import { can } from '@shared/types/contracts'
import { useAdmin } from './backoffice-page'
import { LanguageTab } from './components/language-tab'
import { MembersTab } from './components/members-tab'
import { MenuTab } from './components/menu-tab'
import { MorePageView } from './components/more-page'
import { SetupChecklist } from './components/setup-checklist'
import { StarterMenuPicker } from './components/starter-menu-picker'
import { OpsTab } from './components/ops-tab'
import { Dashboard } from './components/dashboard'
import { PromoTab } from './components/promo-tab'
import { ReportPageView } from './components/report-page'
import { StaffList } from './components/staff-list'
import { InventoryPage } from './components/inventory/inventory-page'
import { StoreTab } from './components/store-tab'
import { TablesTab } from './components/tables-tab'
import { FinancePageView } from './components/finance-page'

// Tautan lama /admin?tab=... tetap bekerja dan diarahkan ke route barunya.
const LEGACY_TAB: Record<string, string> = {
  menu: '/admin/menu',
  promo: '/admin/promo',
  penjualan: '/admin/laporan',
  keuangan: '/admin/keuangan',
  stok: '/admin/stok',
  meja: '/admin/meja',
  member: '/admin/member',
  operasional: '/admin/shift',
  staf: '/admin/tim',
  toko: '/admin/toko',
}

export function OverviewPage() {
  const { data, run, reload } = useAdmin()
  const [params] = useSearchParams()
  const legacy = LEGACY_TAB[params.get('tab') ?? '']
  if (legacy) return <Navigate to={legacy} replace />
  return (
    <>
      <SetupChecklist store={data.store} products={data.products} onSeeded={reload} />
      <Dashboard products={data.products} run={run} />
    </>
  )
}

export function MenuAdminPage() {
  const { data, run, reload } = useAdmin()
  const [params, setParams] = useSearchParams()
  return (
    <>
    {data.products.length === 0 && (
      <section className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-6">
        <h2 className="mb-1 text-xl font-extrabold">Belum ada menu</h2>
        <p className="mb-3 text-base text-foreground/80">Mulai cepat pakai menu contoh, atau klik "Tambah menu" untuk mengetik sendiri.</p>
        <StarterMenuPicker onDone={reload} />
      </section>
    )}
    <MenuTab
      products={data.products}
      categories={data.categories}
      run={run}
      reload={reload}
      isAddingNew={params.get('baru') === '1'}
      onAddFinished={() => setParams({}, { replace: true })}
    />
    </>
  )
}

export function PromoPage() {
  const { data, run, reload } = useAdmin()
  return <PromoTab storeId={data.store.id} products={data.products} categories={data.categories} reloadCatalog={reload} run={run} />
}

export function MemberPage() {
  const { storeId } = useStaff()
  const { config } = useStoreConfig(storeId)
  return <MembersTab config={config} />
}

export function StockPage() {
  const { data, reload } = useAdmin()
  return <InventoryPage store={data.store} products={data.products} onCatalogChanged={reload} />
}

export function PurchasePage() {
  return <PurchasingPage />
}

export function ReportPage() {
  const { data } = useAdmin()
  const { storeId } = useStaff()
  const { config } = useStoreConfig(storeId)
  return <ReportPageView storeName={data.store.name} config={config} />
}

export function FinancePage() {
  return <FinancePageView />
}

export function ShiftPage() {
  return <OpsTab />
}

export function TablesPage() {
  const { data } = useAdmin()
  return <TablesTab store={data.store} />
}

/** Halaman khusus owner; role lain dikembalikan ke Ikhtisar. */
function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { role } = useStaff()
  return can.ownerOnly(role) ? <>{children}</> : <Navigate to="/admin" replace />
}

export function LanguagePage() {
  return (
    <OwnerOnly>
      <LanguageTab />
    </OwnerOnly>
  )
}

export function StaffPage() {
  return (
    <OwnerOnly>
      <StaffList />
    </OwnerOnly>
  )
}

export function StorePage() {
  const { data, run, fail } = useAdmin()
  return (
    <OwnerOnly>
      <StoreTab store={data.store} run={run} fail={fail} />
    </OwnerOnly>
  )
}

export function MorePage() {
  return <MorePageView />
}
