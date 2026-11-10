import { StrictMode, Suspense, lazy, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig } from 'motion/react'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import { MenuSkeleton, ShellSkeleton } from '@shared/components/page-skeleton'
import { getMotionPref } from '@shared/lib/motion-pref'
import './index.css'

// Setiap halaman jadi file JS sendiri: HP pelanggan tidak mengunduh kode kasir/admin.
const MenuPage = lazy(() => import('@features/menu-catalog').then((m) => ({ default: m.MenuPage })))
const CashierPage = lazy(() => import('@features/cashier-pos').then((m) => ({ default: m.CashierPage })))
const KitchenPage = lazy(() => import('@features/kitchen-kds').then((m) => ({ default: m.KitchenPage })))
// Satu bundel backoffice, satu route per halaman
const bo = <K extends string>(name: K) => lazy(() => import('@features/backoffice').then((m) => ({ default: (m as unknown as Record<K, React.ComponentType>)[name] })))
const AdminRoot = bo('AdminRoot')
const OverviewPage = bo('OverviewPage')
const MenuAdminPage = bo('MenuAdminPage')
const PromoPage = bo('PromoPage')
const MemberPage = bo('MemberPage')
const StockPage = bo('StockPage')
const ReportPage = bo('ReportPage')
const ShiftPage = bo('ShiftPage')
const TablesPage = bo('TablesPage')
const StaffPage = bo('StaffPage')
const StorePage = bo('StorePage')
const LanguagePage = bo('LanguagePage')
const SuperPage = lazy(() => import('@features/super-admin').then((m) => ({ default: m.SuperPage })))
const LoginPage = lazy(() => import('./app/login-page').then((m) => ({ default: m.LoginPage })))
const StaffShell = lazy(() => import('./app/staff-shell').then((m) => ({ default: m.StaffShell })))
const RegisterPage = lazy(() => import('./app/register-page').then((m) => ({ default: m.RegisterPage })))
const PrivacyPage = lazy(() => import('@features/legal').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('@features/legal').then((m) => ({ default: m.TermsPage })))
const LandingPage = lazy(() => import('@features/landing').then((m) => ({ default: m.LandingPage })))

/** Link/QR meja lama (/?meja=5 atau ?tipe=bungkus) diarahkan ke toko VITE_DEFAULT_STORE_SLUG bila diisi; selain itu Landing Page. */
const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_STORE_SLUG
function RootRoute() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  if (DEFAULT_SLUG && (params.has('meja') || params.has('tipe'))) {
    return <Navigate to={`/s/${DEFAULT_SLUG}${search}`} replace />
  }
  return <LandingPage />
}

const page = (el: ReactNode, fallback: ReactNode = null) => <Suspense fallback={fallback}>{el}</Suspense>

const router = createBrowserRouter([
  { path: '/', element: page(<RootRoute />, <ShellSkeleton />) },
  { path: '/s/:slug', element: page(<MenuPage />, <MenuSkeleton />) },
  { path: '/privasi', element: page(<PrivacyPage />) },
  { path: '/syarat', element: page(<TermsPage />) },
  { path: '/login', element: page(<LoginPage />) },
  { path: '/register', element: page(<RegisterPage />) },
  {
    element: page(<StaffShell />),
    children: [
      { path: '/cashier', element: <CashierPage /> },
      { path: '/kitchen', element: <KitchenPage /> },
      {
        path: '/admin',
        element: page(<AdminRoot />),
        children: [
          { index: true, element: page(<OverviewPage />) },
          { path: 'menu', element: page(<MenuAdminPage />) },
          { path: 'promo', element: page(<PromoPage />) },
          { path: 'member', element: page(<MemberPage />) },
          { path: 'stok', element: page(<StockPage />) },
          { path: 'laporan', element: page(<ReportPage />) },
          { path: 'shift', element: page(<ShiftPage />) },
          { path: 'meja', element: page(<TablesPage />) },
          { path: 'tim', element: page(<StaffPage />) },
          { path: 'toko', element: page(<StorePage />) },
          { path: 'bahasa', element: page(<LanguagePage />) },
        ],
      },
      { path: '/super', element: <SuperPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Fitur animasi dimuat lazy setelah render pertama (bundel awal kecil); reducedMotion ikut setelan perangkat */}
    <LazyMotion features={() => import('@shared/lib/motion-features').then((m) => m.default)} strict>
      <MotionConfig reducedMotion={getMotionPref() === 'full' ? 'never' : 'user'} transition={{ type: 'spring', stiffness: 500, damping: 35 }}>
        <RouterProvider router={router} />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)

// Cangkang aplikasi tersedia offline (hanya di produksi; di dev service worker mengganggu HMR)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
