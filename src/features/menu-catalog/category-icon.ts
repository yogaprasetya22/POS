import { Coffee, Cookie, CupSoda, IceCreamCone, LayoutGrid, Pizza, Soup, UtensilsCrossed, type LucideIcon } from 'lucide-react'

const RULES: [RegExp, LucideIcon][] = [
  [/kopi|coffee/i, Coffee],
  [/minum|drink|jus|teh/i, CupSoda],
  [/dessert|es krim|manis/i, IceCreamCone],
  [/camil|snack|kue/i, Cookie],
  [/sup|soup|kuah|mie|noodle/i, Soup],
  [/pizza|burger|fast/i, Pizza],
]

/** Ikon kategori ditebak dari nama; kategori dibuat bebas oleh owner. */
export const categoryIcon = (name: string | null): LucideIcon =>
  name === null ? LayoutGrid : (RULES.find(([re]) => re.test(name))?.[1] ?? UtensilsCrossed)
