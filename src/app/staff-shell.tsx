import { Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { StaffLayout } from '@shared/components/layout/staff-layout'
import { CashierSkeleton, PageSkeleton } from '@shared/components/page-skeleton'
import { Button } from '@shared/components/ui/button'
import { StaffContext, useStaffRole } from '@shared/lib/auth'
import { supabase } from '@shared/lib/supabase'
import type { StaffRole } from '@shared/types/contracts'
import { AuthShell } from './auth-shell'

type Access = StaffRole | 'super'

const STAFF_ROUTES: { path: string; title: string; allow: Access[] }[] = [
  { path: '/cashier', title: 'Kasir', allow: ['owner', 'cashier'] },
  { path: '/kitchen', title: 'Dapur', allow: ['owner', 'cashier'] },
  { path: '/admin', title: 'Admin', allow: ['owner'] },
  { path: '/super', title: 'Kelola Toko', allow: ['super'] },
]

/** Satu cangkang untuk semua halaman staf: profil dimuat sekali, sidebar tidak ikut dimuat ulang saat pindah halaman. */
export function StaffShell() {
  const staff = useStaffRole()
  const { pathname } = useLocation()
  const route = STAFF_ROUTES.find((r) => pathname.startsWith(r.path))
  const isCashier = pathname.startsWith('/cashier')

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
        <StaffLayout title={route?.title ?? (isCashier ? 'Kasir' : 'Admin')}>
          {isCashier ? <CashierSkeleton /> : <PageSkeleton />}
        </StaffLayout>
      </StaffContext.Provider>
    )
  }

  if (!staff.userId) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />

  const ok = route ? route.allow.some((a) => (a === 'super' ? staff.isSuper : a === staff.role)) : false
  if (!ok) {
    // super admin tanpa toko tidak punya halaman kasir/admin; arahkan ke daftar toko
    if (staff.isSuper && !staff.role) return <Navigate to="/super" replace />
    return (
      <AuthShell>
        <h2 className="text-xl font-bold">{staff.role ? 'Akses ditolak' : 'Menunggu aktivasi'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {staff.role
            ? 'Halaman ini hanya untuk owner.'
            : 'Akun kamu belum terhubung ke toko. Minta owner tokomu menambahkan emailmu di Admin → Staf.'}
        </p>
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>Keluar</Button>
      </AuthShell>
    )
  }

  return (
    <StaffContext.Provider value={{ userId: staff.userId, email: staff.email, role: staff.role, storeId: staff.storeId, storeName: staff.storeName, isSuper: staff.isSuper }}>
      <StaffLayout title={route?.title ?? 'Kasir'}>
        <Suspense fallback={isCashier ? <CashierSkeleton /> : <PageSkeleton />}>
          <Outlet />
        </Suspense>
      </StaffLayout>
    </StaffContext.Provider>
  )
}

