import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addItem, setItemQty, type CartItem } from '../cart'

type CartState = {
  storeId: string | null
  items: CartItem[]
  /** Keranjang milik satu toko; pindah toko = keranjang dikosongkan. */
  bind: (storeId: string) => void
  add: (item: CartItem) => void
  setQty: (key: string, qty: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      storeId: null,
      items: [],
      bind: (storeId) => set((s) => (s.storeId === storeId ? s : { storeId, items: [] })),
      add: (item) => set((s) => ({ items: addItem(s.items, item) })),
      setQty: (key, qty) => set((s) => ({ items: setItemQty(s.items, key, qty) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'wa-order-cart' },
  ),
)
