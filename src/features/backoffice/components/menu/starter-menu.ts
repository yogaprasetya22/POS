import { supabase } from '@shared/lib/supabase'

/** Menu contoh per jenis usaha: owner baru tinggal ubah harga/nama, tidak mengetik dari nol. */
export type StarterKind = 'warkop' | 'kafe' | 'resto' | 'bakso'

type Item = [name: string, price: number, description?: string]

export const STARTER_MENUS: Record<StarterKind, { label: string; hint: string; menu: Record<string, Item[]> }> = {
  warkop: {
    label: 'Warkop',
    hint: 'Kopi, mi instan, gorengan',
    menu: {
      Minuman: [['Kopi Hitam', 5000], ['Kopi Susu', 7000], ['Teh Manis', 4000], ['Es Teh Manis', 5000], ['Es Jeruk', 6000], ['Susu Jahe', 8000]],
      Makanan: [['Indomie Rebus', 10000], ['Indomie Goreng', 10000], ['Indomie Telur', 13000], ['Nasi Telur', 12000], ['Roti Bakar', 12000]],
      Camilan: [['Gorengan (per biji)', 2000], ['Pisang Goreng', 8000], ['Kacang Rebus', 7000]],
    },
  },
  kafe: {
    label: 'Kafe',
    hint: 'Kopi susu, non-kopi, camilan',
    menu: {
      Kopi: [['Americano', 20000], ['Cafe Latte', 25000], ['Cappuccino', 25000], ['Es Kopi Susu Gula Aren', 22000], ['Espresso', 18000]],
      'Non Kopi': [['Matcha Latte', 27000], ['Chocolate', 25000], ['Lemon Tea', 18000], ['Red Velvet', 27000]],
      Camilan: [['Kentang Goreng', 20000], ['Croissant', 22000], ['Pisang Bakar Keju', 22000], ['Dimsum (4 pcs)', 25000]],
    },
  },
  resto: {
    label: 'Restoran',
    hint: 'Nasi, lauk, minuman',
    menu: {
      Makanan: [['Nasi Goreng Spesial', 25000], ['Mie Goreng', 23000], ['Ayam Bakar + Nasi', 30000], ['Ayam Geprek + Nasi', 22000], ['Soto Ayam', 20000], ['Capcay', 25000]],
      Tambahan: [['Nasi Putih', 5000], ['Telur Dadar', 6000], ['Kerupuk', 3000]],
      Minuman: [['Es Teh Manis', 6000], ['Es Jeruk', 8000], ['Jus Alpukat', 15000], ['Air Mineral', 5000]],
    },
  },
  bakso: {
    label: 'Bakso & Mi Ayam',
    hint: 'Bakso, mi ayam, es',
    menu: {
      Makanan: [['Bakso Urat', 18000], ['Bakso Halus', 15000], ['Mi Ayam', 15000], ['Mi Ayam Bakso', 20000], ['Bakso Beranak', 25000]],
      Tambahan: [['Pangsit Goreng', 3000], ['Ceker', 5000], ['Tahu Bakso', 4000]],
      Minuman: [['Es Teh Manis', 5000], ['Es Jeruk', 6000], ['Teh Hangat', 4000]],
    },
  },
}

/** Isi kategori + menu contoh ke toko. Kategori yang namanya sudah ada dipakai ulang. */
export async function seedStarterMenu(storeId: string, kind: StarterKind): Promise<{ error: { message: string } | null }> {
  const { menu } = STARTER_MENUS[kind]
  const { data: existing, error: e1 } = await supabase.from('categories').select('id,name,sort').eq('store_id', storeId)
  if (e1) return { error: e1 }
  const byName = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c.id as string]))
  const missing = Object.keys(menu).filter((n) => !byName.has(n.toLowerCase()))
  if (missing.length) {
    const base = existing?.length ?? 0
    const { data: made, error: e2 } = await supabase
      .from('categories')
      .insert(missing.map((name, i) => ({ store_id: storeId, name, sort: base + i })))
      .select('id,name')
    if (e2) return { error: e2 }
    for (const c of made ?? []) byName.set(c.name.toLowerCase(), c.id)
  }
  let sort = 0
  const rows = Object.entries(menu).flatMap(([cat, items]) =>
    items.map(([name, price, description = '']) => ({ store_id: storeId, name, price, description, category_id: byName.get(cat.toLowerCase()) ?? null, sort: sort++ })),
  )
  const { error } = await supabase.from('products').insert(rows)
  return { error }
}
