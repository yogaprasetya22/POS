import { Suspense } from 'react'
import { I18nBoot } from './i18n-boot'
import { Navigate, Outlet, useLocation } from 'react-router'
import { PageTransition } from '@shared/components/page-transition'
import { AdminLayout } from '@shared/components/layout/admin-layout'
import { OpsLayout } from '@shared/components/layout/ops-layout'
import { CashierSkeleton, KitchenSkeleton, PageSkeleton } from '@shared/components/page-skeleton'
import { Button } from '@shared/components/ui/button'
import { StaffContext, useStaffRole, type Staff } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import type { StaffRole } from '@shared/types/contracts'
import { AuthShell } from './auth-shell'
import { CreateStoreForm } from './create-store'

type Access = StaffRole | 'super'

// Urutan = prioritas halaman awal tiap role (route pertama yang diizinkan). Database tetap penentu akhir lewat RLS.
const STAFF_ROUTES: { path: string; title: string; allow: Access[] }[] = [
  { path: '/cashier', title: 'Kasir', allow: ['owner', 'manager', 'cashier', 'waiter'] },
  { path: '/kitchen', title: 'Dapur', allow: ['owner', 'manager', 'cashier', 'kitchen'] },
  { path: '/admin', title: 'Admin', allow: ['owner', 'manager'] },
  { path: '/super', title: 'Kelola Toko', allow: ['super'] },
]

const allowed = (r: { allow: Access[] }, s: Pick<Staff, 'role' | 'isSuper'>) => r.allow.some((a) => (a === 'super' ? s.isSuper : a === s.role))

/** Satu cangkang untuk semua halaman staf: profil dimuat sekali, sidebar tidak ikut dimuat ulang saat pindah halaman. */
export function StaffShell() {
  const staff = useStaffRole()
  const { pathname } = useLocation()
  const route = STAFF_ROUTES.find((r) => pathname.startsWith(r.path))
  const isCashier = pathname.startsWith('/cashier')
  const isKitchen = pathname.startsWith('/kitchen')

  // kasir & dapur: mode layar penuh; back office & super admin: sidebar berkelompok
  const Layout = isCashier || isKitchen ? OpsLayout : AdminLayout
  const fallbackSkeleton = isCashier ? <CashierSkeleton /> : isKitchen ? <KitchenSkeleton /> : <PageSkeleton />

  if (staff.loading) {
    return (
      <StaffContext.Provider
        value={{
          userId: '',
          email: '',
          role: 'owner',
          storeId: null,
          storeName: null,
          isSuper: false,
        }}
      >
        <Layout>{fallbackSkeleton}</Layout>
      </StaffContext.Provider>
    )
  }

  if (!staff.userId) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />

  const ok = route ? allowed(route, staff) : false
  if (!ok) {
    // arahkan ke halaman pertama yang boleh dibuka role ini (mis. staf dapur -> /kitchen, super admin -> /super)
    const home = STAFF_ROUTES.find((r) => allowed(r, staff))
    if (home && home.path !== pathname) return <Navigate to={home.path} replace />
    return (
      <AuthShell>
        <h2 className="text-xl font-bold">{staff.role ? 'Akses ditolak' : 'Selamat datang'}</h2>
        {staff.role ? (
          <p className="mt-2 text-sm text-muted-foreground">Role kamu tidak punya akses ke halaman ini.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Akunmu belum terhubung ke toko. Buat toko sendiri (uji coba gratis 14 hari), atau minta owner menambahkan emailmu di Admin → Tim.
            </p>
            <CreateStoreForm />
          </>
        )}
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>Keluar</Button>
      </AuthShell>
    )
  }

  return (
    <StaffContext.Provider value={{ userId: staff.userId, email: staff.email, role: staff.role, storeId: staff.storeId, storeName: staff.storeName, isSuper: staff.isSuper }}>
      <I18nBoot />
      <Layout>
        <Suspense fallback={fallbackSkeleton}>
          <PageTransition key={pathname}>
            <Outlet />
          </PageTransition>
        </Suspense>
      </Layout>
    </StaffContext.Provider>
  )
}

