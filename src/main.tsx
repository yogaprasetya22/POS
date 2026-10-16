import { StrictMode, Suspense, lazy, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import { MenuSkeleton, ShellSkeleton } from '@shared/components/page-skeleton'
import './index.css'

// Setiap halaman jadi file JS sendiri: HP pelanggan tidak mengunduh kode kasir/admin.
const MenuPage = lazy(() => import('@features/menu-catalog').then((m) => ({ default: m.MenuPage })))
const CashierPage = lazy(() => import('@features/cashier-pos').then((m) => ({ default: m.CashierPage })))
const KitchenPage = lazy(() => import('@features/kitchen-kds').then((m) => ({ default: m.KitchenPage })))
const BackofficePage = lazy(() => import('@features/backoffice').then((m) => ({ default: m.BackofficePage })))
const SuperPage = lazy(() => import('@features/super-admin').then((m) => ({ default: m.SuperPage })))
const LoginPage = lazy(() => import('./app/login-page').then((m) => ({ default: m.LoginPage })))
const StaffShell = lazy(() => import('./app/staff-shell').then((m) => ({ default: m.StaffShell })))
const RegisterPage = lazy(() => import('./app/register-page').then((m) => ({ default: m.RegisterPage })))
const LandingPage = lazy(() => import('@features/landing').then((m) => ({ default: m.LandingPage })))

/** Link/QR meja lama (/?meja=5 atau ?tipe=bungkus) tetap langsung diarahkan ke menu toko; kunjungan langsung membuka Landing Page. */
function RootRoute() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  if (params.has('meja') || params.has('tipe')) {
    return <Navigate to={`/s/warkop-nusantara${search}`} replace />
  }
  return <LandingPage />
}

const page = (el: ReactNode, fallback: ReactNode = null) => <Suspense fallback={fallback}>{el}</Suspense>

const router = createBrowserRouter([
  { path: '/', element: page(<RootRoute />, <ShellSkeleton />) },
  { path: '/s/:slug', element: page(<MenuPage />, <MenuSkeleton />) },
  { path: '/login', element: page(<LoginPage />) },
  { path: '/register', element: page(<RegisterPage />) },
  {
    element: page(<StaffShell />),
    children: [
      { path: '/cashier', element: <CashierPage /> },
      { path: '/kitchen', element: <KitchenPage /> },
      { path: '/admin', element: <BackofficePage /> },
      { path: '/super', element: <SuperPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
