import { useCallback, useEffect, useState } from 'react'
import type { StaffRole } from '@shared/types/contracts'
import { supabase } from './supabase'

export type Permission = 'purchase' | 'waste' | 'stock_count' | 'advance' | 'manage_shifts'
type Role = Exclude<StaffRole, 'owner'>

/** Tugas yang hak aksesnya bisa diatur pemilik. Nilai awal sama dengan default_roles() di database. */
export const PERMISSIONS: { key: Permission; label: string; hint: string; defaults: Role[] }[] = [
  { key: 'purchase', label: 'Belanja & barang masuk', hint: 'Mencatat barang masuk, daftar belanja, dan bayar pemasok', defaults: ['manager'] },
  { key: 'waste', label: 'Catat bahan terbuang', hint: 'Bahan basi, tumpah, atau rusak', defaults: ['manager', 'kitchen'] },
  { key: 'stock_count', label: 'Hitung stok', hint: 'Menghitung ulang stok di rak', defaults: ['manager'] },
  { key: 'advance', label: 'Tandai pesanan siap / sudah diambil', hint: 'Termasuk centang per menu', defaults: ['manager', 'cashier', 'waiter', 'kitchen'] },
  { key: 'manage_shifts', label: 'Atur daftar shift', hint: 'Menambah atau mengubah nama shift', defaults: ['manager'] },
]
export const ROLES: { key: Role; label: string }[] = [
  { key: 'manager', label: 'Manager' },
  { key: 'cashier', label: 'Kasir' },
  { key: 'waiter', label: 'Pelayan' },
  { key: 'kitchen', label: 'Dapur' },
]

/** Hak akses toko. `canDo` dipakai untuk menyembunyikan tombol; database tetap memeriksa ulang. */
export function usePermissions(role: StaffRole | null) {
  const [saved, setSaved] = useState<Record<string, Role[]>>({})
  const reload = useCallback(async () => {
    const { data } = await supabase.from('store_permissions').select('permission,roles')
    setSaved(Object.fromEntries(((data ?? []) as { permission: string; roles: Role[] }[]).map((r) => [r.permission, r.roles])))
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  const rolesOf = (p: Permission): Role[] => saved[p] ?? PERMISSIONS.find((x) => x.key === p)!.defaults
  const canDo = (p: Permission) => role === 'owner' || (!!role && rolesOf(p).includes(role as Role))
  return { rolesOf, canDo, reload }
}
