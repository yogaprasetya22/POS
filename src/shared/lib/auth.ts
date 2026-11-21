import { createContext, useContext, useEffect, useState } from 'react'
import { StaffRoleSchema, type StaffRole } from '@shared/types/contracts'
import { refreshAccountInfo } from './device-accounts'
import { supabase } from './supabase'

export type Staff = { userId: string; email: string; /** nama tampilan; kosong = pakai email */ name: string; role: StaffRole | null; storeId: string | null; storeName: string | null; isSuper: boolean }
type StaffState = { loading: boolean } & ({ userId: null } | Staff)

// relasi many-to-one dari PostgREST: objek (atau array berisi satu objek pada tipe yang diturunkan klien)
const storeNameOf = (rel: unknown): string | null => {
  const row = (Array.isArray(rel) ? rel[0] : rel) as { name?: string } | null | undefined
  return row?.name ?? null
}

// ponytail: In-memory + sessionStorage + localStorage agar role & toko staf instan (0ms) saat buka tab/rekam video.
const STAFF_CACHE_KEY = 'pos_staff_session'

function getCachedStaff(): Staff | null {
  try {
    const raw = sessionStorage.getItem(STAFF_CACHE_KEY) || localStorage.getItem(STAFF_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Staff) : null
  } catch {
    return null
  }
}

function setCachedStaff(staff: Staff | null) {
  try {
    if (!staff) {
      sessionStorage.removeItem(STAFF_CACHE_KEY)
      localStorage.removeItem(STAFF_CACHE_KEY)
    } else {
      const str = JSON.stringify(staff)
      sessionStorage.setItem(STAFF_CACHE_KEY, str)
      localStorage.setItem(STAFF_CACHE_KEY, str)
    }
  } catch {
    // Abaikan jika quota error
  }
}

function clearPosSessionCaches() {
  try {
    localStorage.removeItem(STAFF_CACHE_KEY)
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith('pos_')) {
        sessionStorage.removeItem(key)
      }
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('pos_')) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Abaikan jika error
  }
}

export function useStaffRole(): StaffState {
  // ponytail: Inisialisasi sinkron dari sessionStorage agar render pertama instan (0ms) tanpa jeda skeleton.
  const [state, setState] = useState<StaffState>(() => {
    const cached = getCachedStaff()
    if (cached) return { loading: false, ...cached }
    return { loading: true, userId: null }
  })

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        clearPosSessionCaches()
        return setState({ loading: false, userId: null })
      }
      const { data } = await supabase.from('profiles').select('role, store_id, is_super_admin, display_name, stores(name)').eq('user_id', session.user.id).maybeSingle()
      const staff: Staff = {
        userId: session.user.id,
        email: session.user.email ?? '',
        name: (data?.display_name ?? '').trim(),
        role: data?.role ? StaffRoleSchema.parse(data.role) : null,
        storeId: data?.store_id ?? null,
        storeName: storeNameOf(data?.stores),
        isSuper: data?.is_super_admin === true,
      }
      setCachedStaff(staff)
      if (staff.role) refreshAccountInfo(staff.userId, { name: staff.name, role: staff.role, email: staff.email })
      setState({
        loading: false,
        ...staff,
      })
    }
    load()
    // setTimeout: memanggil supabase langsung di dalam callback auth bisa deadlock
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearPosSessionCaches()
        setState({ loading: false, userId: null })
      } else {
        setTimeout(load, 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return state
}

/** Disediakan oleh Guard di main.tsx supaya halaman staf tidak mengambil profil berulang kali. */
export const StaffContext = createContext<Staff | null>(null)

export function useStaff() {
  const staff = useContext(StaffContext)
  if (!staff) throw new Error('useStaff dipakai di luar Guard')
  return staff
}

/** Nama yang ditampilkan untuk staf: nama bila diisi, kalau tidak email. */
export const displayName = (s: { name?: string; email: string }) => s.name?.trim() || s.email
