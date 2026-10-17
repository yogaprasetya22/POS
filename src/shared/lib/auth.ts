import { createContext, useContext, useEffect, useState } from 'react'
import { StaffRoleSchema, type StaffRole } from '@shared/types/contracts'
import { supabase } from './supabase'

export type Staff = { userId: string; email: string; role: StaffRole | null; storeId: string | null; storeName: string | null; isSuper: boolean }
type StaffState = { loading: boolean } & ({ userId: null } | Staff)

// relasi many-to-one dari PostgREST: objek (atau array berisi satu objek pada tipe yang diturunkan klien)
const storeNameOf = (rel: unknown): string | null => {
  const row = (Array.isArray(rel) ? rel[0] : rel) as { name?: string } | null | undefined
  return row?.name ?? null
}

const STAFF_CACHE_KEY = 'pos_staff_session'

function getCachedStaff(): Staff | null {
  try {
    const raw = sessionStorage.getItem(STAFF_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Staff) : null
  } catch {
    return null
  }
}

function setCachedStaff(staff: Staff | null) {
  try {
    if (!staff) {
      sessionStorage.removeItem(STAFF_CACHE_KEY)
    } else {
      sessionStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(staff))
    }
  } catch {
    // Abaikan jika quota error
  }
}

function clearPosSessionCaches() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith('pos_')) {
        sessionStorage.removeItem(key)
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
      const { data } = await supabase.from('profiles').select('role, store_id, is_super_admin, stores(name)').eq('user_id', session.user.id).maybeSingle()
      const staff: Staff = {
        userId: session.user.id,
        email: session.user.email ?? '',
        role: data?.role ? StaffRoleSchema.parse(data.role) : null,
        storeId: data?.store_id ?? null,
        storeName: storeNameOf(data?.stores),
        isSuper: data?.is_super_admin === true,
      }
      setCachedStaff(staff)
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
