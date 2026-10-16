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

export function useStaffRole(): StaffState {
  const [state, setState] = useState<StaffState>({ loading: true, userId: null })

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return setState({ loading: false, userId: null })
      const { data } = await supabase.from('profiles').select('role, store_id, is_super_admin, stores(name)').eq('user_id', session.user.id).maybeSingle()
      setState({
        loading: false,
        userId: session.user.id,
        email: session.user.email ?? '',
        role: data?.role ? StaffRoleSchema.parse(data.role) : null,
        storeId: data?.store_id ?? null,
        storeName: storeNameOf(data?.stores),
        isSuper: data?.is_super_admin === true,
      })
    }
    load()
    // setTimeout: memanggil supabase langsung di dalam callback auth bisa deadlock
    const { data } = supabase.auth.onAuthStateChange(() => void setTimeout(load, 0))
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
