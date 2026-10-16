import { z } from 'zod'

/** Semua uang: integer Rupiah, harga sudah nett. */
export const RupiahSchema = z.number().int().nonnegative()

export const OrderStatusSchema = z.enum(['UNPAID', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
export const OrderTypeSchema = z.enum(['DINE_IN', 'TAKEAWAY'])
export const PaymentMethodSchema = z.enum(['CASH', 'QRIS_STATIC', 'EDC_CARD'])
export const StaffRoleSchema = z.enum(['owner', 'cashier'])

export const ModifierGroupSchema = z.object({
  name: z.string().min(1),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
  options: z.array(z.object({ name: z.string().min(1), price: RupiahSchema })).min(1),
})

export const CategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  sort: z.number().int(),
})

export const ProductSchema = z.object({
  id: z.uuid(),
  category_id: z.uuid().nullable(),
  name: z.string().min(1),
  sku: z.string().nullable(),
  price: RupiahSchema,
  is_available: z.boolean(),
  modifiers: z.array(ModifierGroupSchema),
  image_url: z.string().nullable(),
  images: z.array(z.string()).default([]),
  video_url: z.string().nullable().default(null),
  sort: z.number().int(),
})

const WaNumberSchema = z.string().regex(/^62\d{8,13}$/, 'Nomor WA harus format 62xxxxxxxxxx')

export const StoreSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string().trim().min(1, 'Nama toko wajib diisi'),
  wa_number: WaNumberSchema,
  is_active: z.boolean(),
})

/** Pengaturan yang boleh diubah owner tokonya sendiri. */
export const StoreSettingsSchema = StoreSchema.pick({ name: true, wa_number: true })

/** Input super admin saat membuat/mengubah toko. owner_email kosong = tidak menunjuk owner. */
export const StoreInputSchema = StoreSettingsSchema.extend({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, dan tanda hubung')
    .min(3, 'Slug minimal 3 karakter')
    .max(40, 'Slug maksimal 40 karakter'),
  is_active: z.boolean(),
  owner_email: z.union([z.email('Email owner tidak valid'), z.literal('')]),
})

export const StoreRowSchema = StoreSchema.extend({
  owner_emails: z.string().nullable(),
  orders_today: z.number(),
  sales_today: z.number(),
})

export const ChoiceSchema = z.object({ group: z.string(), option: z.string() })

export const StaffProfileSchema = z.object({
  user_id: z.uuid(),
  email: z.string().nullable(),
  role: StaffRoleSchema.nullable(),
})

export const RegisterSchema = z
  .object({
    email: z.email('Email tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Konfirmasi password tidak sama' })

export const CartLineSchema = z.object({
  product_id: z.uuid(),
  qty: z.number().int().min(1).max(99),
  choices: z.array(ChoiceSchema),
  note: z.string().max(200),
})

export const CheckoutSchema = z
  .object({
    customer_name: z.string().trim().min(1, 'Nama wajib diisi').max(40, 'Nama maksimal 40 huruf'),
    order_type: OrderTypeSchema,
    table_no: z.string().trim().max(10, 'Nomor meja terlalu panjang'),
    lines: z.array(CartLineSchema).min(1, 'Keranjang kosong').max(50),
  })
  .refine((v) => v.order_type === 'TAKEAWAY' || v.table_no !== '', {
    path: ['table_no'],
    message: 'Nomor meja wajib untuk makan di tempat',
  })

export const PromotionTypeSchema = z.enum(['BUY_X_GET_Y', 'PERCENTAGE', 'FIXED_AMOUNT'])
export const PromotionScopeSchema = z.enum(['PRODUCT', 'CATEGORY', 'CART_TOTAL'])

export const PromotionSchema = z.object({
  id: z.uuid(),
  store_id: z.uuid(),
  name: z.string().trim().min(1, 'Nama promo wajib diisi'),
  type: PromotionTypeSchema,
  scope: PromotionScopeSchema,
  target_id: z.uuid().nullable(),
  buy_qty: z.number().int().min(1).default(2),
  get_qty: z.number().int().min(1).default(1),
  discount_percent: z.number().int().min(0).max(100).default(0),
  discount_amount: RupiahSchema.default(0),
  min_spend: RupiahSchema.default(0),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
})

export const PromotionInputSchema = PromotionSchema.omit({ id: true, store_id: true, created_at: true })

export const CreatedOrderSchema = z.object({
  id: z.uuid(),
  queue_code: z.string(),
  total: RupiahSchema,
  discount_amount: RupiahSchema.optional(),
  promo_name: z.string().nullable().optional(),
})

export const OrderItemSchema = CartLineSchema.extend({
  name: z.string(),
  unit_price: RupiahSchema,
  subtotal: RupiahSchema,
  choices: z.array(ChoiceSchema.extend({ price: RupiahSchema })),
})

export const OrderSchema = z.object({
  id: z.uuid(),
  queue_code: z.string(),
  business_day: z.string(),
  customer_name: z.string(),
  order_type: OrderTypeSchema,
  table_no: z.string().nullable(),
  items: z.array(OrderItemSchema),
  total: RupiahSchema,
  discount_amount: RupiahSchema.default(0),
  promo_name: z.string().nullable().default(null),
  status: OrderStatusSchema,
  payment_method: PaymentMethodSchema.nullable(),
  cash_received: RupiahSchema.nullable(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
})

export type OrderStatus = z.infer<typeof OrderStatusSchema>
export type OrderType = z.infer<typeof OrderTypeSchema>
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>
export type StaffRole = z.infer<typeof StaffRoleSchema>
export type ModifierGroup = z.infer<typeof ModifierGroupSchema>
export type Category = z.infer<typeof CategorySchema>
export type Product = z.infer<typeof ProductSchema>
export type Store = z.infer<typeof StoreSchema>
export type StoreRow = z.infer<typeof StoreRowSchema>
export type Choice = z.infer<typeof ChoiceSchema>
export type CartLine = z.infer<typeof CartLineSchema>
export type Order = z.infer<typeof OrderSchema>
export type StaffProfile = z.infer<typeof StaffProfileSchema>
export type PromotionType = z.infer<typeof PromotionTypeSchema>
export type PromotionScope = z.infer<typeof PromotionScopeSchema>
export type Promotion = z.infer<typeof PromotionSchema>
export type PromotionInput = z.infer<typeof PromotionInputSchema>

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Tunai',
  QRIS_STATIC: 'QRIS',
  EDC_CARD: 'Kartu (EDC)',
}
