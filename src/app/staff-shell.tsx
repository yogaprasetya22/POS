import { getDevice } from '@shared/lib/device-binding'
import { Suspense } from 'react'
import { I18nBoot } from './i18n-boot'
import { Navigate, Outlet, useLocation } from 'react-router'
import { PageTransition } from '@shared/components/page-transition'
import { AppLayout } from '@shared/components/layout/app-layout'
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
  { path: '/antrean', title: 'Antrean', allow: ['owner', 'manager', 'cashier', 'waiter'] },
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

  // satu layout untuk semua: navigasi 4 tombol berlabel (bilah bawah di HP, kolom kiri di layar lebar)
  const Layout = AppLayout
  const fallbackSkeleton = isCashier ? <CashierSkeleton /> : isKitchen ? <KitchenSkeleton /> : <PageSkeleton />

  if (staff.loading) {
    return (
      <StaffContext.Provider
        value={{
          userId: '',
          email: '',
          name: '',
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

  if (!staff.userId && getDevice()) return <Navigate to="/kunci" replace />
  if (!staff.userId) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />

  const ok = route ? allowed(route, staff) : false
  if (!ok) {
    // arahkan ke halaman pertama yang boleh dibuka role ini (mis. staf dapur -> /kitchen, super admin -> /super)
    const home = STAFF_ROUTES.find((r) => allowed(r, staff))
    if (home && home.path !== pathname) return <Navigate to={home.path} replace />
    return (
      <AuthShell>
        <h2 className="text-2xl font-bold tracking-tight">{staff.role ? 'Halaman ini bukan untuk akunmu' : 'Selamat datang'}</h2>
        {staff.role ? (
          <p className="mt-2 text-sm text-muted-foreground">Minta pemilik toko membuka halaman ini, atau tekan tombol menu di bawah untuk kembali.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Akunmu belum terhubung ke toko. Buat toko sendiri (uji coba gratis 14 hari), atau minta pemilik toko menambahkan emailmu di Lainnya → Karyawan.
            </p>
            <CreateStoreForm />
          </>
        )}
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>Keluar</Button>
      </AuthShell>
    )
  }

  return (
    <StaffContext.Provider value={{ userId: staff.userId, email: staff.email, name: staff.name ?? '', role: staff.role, storeId: staff.storeId, storeName: staff.storeName, isSuper: staff.isSuper }}>
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

