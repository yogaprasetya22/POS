import { z } from 'zod'

/** Semua uang: integer Rupiah, harga sudah nett. */
export const RupiahSchema = z.number().int().nonnegative()

export const OrderStatusSchema = z.enum(['UNPAID', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'VOID', 'REFUNDED'])
export const OrderTypeSchema = z.enum(['DINE_IN', 'TAKEAWAY'])
export const PaymentMethodSchema = z.enum(['CASH', 'QRIS_STATIC', 'EDC_CARD', 'MIDTRANS'])
export const StaffRoleSchema = z.enum(['owner', 'manager', 'cashier', 'waiter', 'kitchen'])

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
  /** Sisa porsi dari stok bahan; null = menu tanpa resep (tidak dilacak). */
  portions: z.number().int().nullable().default(null),
  modifiers: z.array(ModifierGroupSchema),
  image_url: z.string().nullable(),
  images: z.array(z.string()).default([]),
  video_url: z.string().nullable().default(null),
  description: z.string().default(''),
  /** Menu andalan: diberi tanda di halaman pembeli. */
  is_featured: z.boolean().default(false),
  sort: z.number().int(),
})

const WaNumberSchema = z.string().regex(/^62\d{8,13}$/, 'Nomor WA harus format 62xxxxxxxxxx')

export const StoreSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string().trim().min(1, 'Nama toko wajib diisi'),
  wa_number: WaNumberSchema,
  is_active: z.boolean(),
  // tampilan halaman pembeli; default dipakai bila kolomnya belum ada
  theme: z.string().default('biru'),
  buyer_template: z.string().default('klasik'),
  logo_url: z.string().default(''),
  tagline: z.string().default(''),
})

/** Pengaturan uang & struk toko (basis poin: 1100 = 11%). Dibaca staf; diubah owner lewat save_store_settings. */
export const StoreConfigSchema = z.object({
  slug: z.string(),
  locale: z.enum(['id', 'jaksel', 'en']).default('id'),
  tax_bp: z.number().int().min(0).max(3000),
  tax_inclusive: z.boolean(),
  service_bp: z.number().int().min(0).max(3000),
  rounding_to: z.union([z.literal(1), z.literal(100), z.literal(500), z.literal(1000)]),
  points_earn_per: z.number().int().min(0),
  points_value: z.number().int().min(0),
  receipt_footer: z.string().max(200),
  address: z.string().max(200),
  plan: z.enum(['trial', 'basic', 'pro']),
  // Default dipakai bila migrasi 20261016000018 belum dijalankan
  logo: z.string().default(''),
  theme: z.string().default('biru'),
  buyer_template: z.string().default('klasik'),
  logo_url: z.string().default(''),
  tagline: z.string().default(''),
  plan_expires_at: z.string().nullable(),
  // Default dipakai bila migrasi 20261016000014 belum dijalankan
  use_kitchen_screen: z.boolean().default(true),
  cook_minutes: z.number().int().min(1).max(180).default(15),
  // Midtrans Payment Gateway
  midtrans_enabled: z.boolean().default(false),
  midtrans_is_production: z.boolean().default(false),
  midtrans_client_key: z.string().nullable().default(null),
})
export type StoreConfig = z.infer<typeof StoreConfigSchema>

/** Hasil quote_order / compute di database: satu-satunya sumber total. */
export const QuoteSchema = z.object({
  subtotal: RupiahSchema,
  promo_discount: RupiahSchema,
  promo_name: z.string().nullable(),
  voucher_id: z.string().nullable(),
  voucher_discount: RupiahSchema,
  points_redeemed: z.number().int().nonnegative(),
  points_discount: RupiahSchema,
  points_earned: z.number().int().nonnegative(),
  service: RupiahSchema,
  tax: RupiahSchema,
  rounding: z.number().int(),
  total: RupiahSchema,
})
export type Quote = z.infer<typeof QuoteSchema>

export const MemberSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  name: z.string(),
  points: z.number().int(),
  visits: z.number().int(),
  total_spent: z.number(),
})
export type Member = z.infer<typeof MemberSchema>

export const ShiftSummarySchema = z.object({
  id: z.uuid(),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  opening_cash: z.number(),
  cash_sales: z.number(),
  cash_in: z.number(),
  cash_out: z.number(),
  cash_reversals: z.number(),
  expected_cash: z.number().nullable(),
  counted_cash: z.number().nullable(),
  difference: z.number().nullable(),
  by_method: z.record(z.string(), z.object({ count: z.number(), total: z.number() })),
})
export type ShiftSummary = z.infer<typeof ShiftSummarySchema>

export const ROLE_LABEL: Record<z.infer<typeof StaffRoleSchema>, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Kasir',
  waiter: 'Pelayan',
  kitchen: 'Dapur',
}

/** Izin per role di UI. Database tetap penentu akhir (RLS + fungsi SQL); ini hanya untuk menampilkan/menyembunyikan. */
export const can = {
  pay: (r: StaffRole | null) => r === 'owner' || r === 'manager' || r === 'cashier',
  manage: (r: StaffRole | null) => r === 'owner' || r === 'manager',
  ownerOnly: (r: StaffRole | null) => r === 'owner',
  kitchen: (r: StaffRole | null) => r === 'owner' || r === 'manager' || r === 'cashier' || r === 'kitchen',
  floor: (r: StaffRole | null) => r === 'owner' || r === 'manager' || r === 'cashier' || r === 'waiter',
}

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
  plan: z.enum(['trial', 'basic', 'pro']).default('trial'),
  plan_expires_at: z.string().nullable().default(null),
})

export const ChoiceSchema = z.object({ group: z.string(), option: z.string() })

export const StaffProfileSchema = z.object({
  user_id: z.uuid(),
  email: z.string().nullable(),
  display_name: z.string().nullable().optional(),
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
    promo_code: z.string().trim().toUpperCase().optional(),
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
  code: z.string().trim().toUpperCase().nullable().optional(),
  type: PromotionTypeSchema,
  scope: PromotionScopeSchema,
  target_id: z.uuid().nullable(),
  buy_qty: z.number().int().min(1).default(2),
  get_qty: z.number().int().min(1).default(1),
  discount_percent: z.number().int().min(0).max(100).default(0),
  discount_amount: RupiahSchema.default(0),
  min_spend: RupiahSchema.default(0),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
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
  promo_code: z.string().nullable().optional(),
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
  subtotal: RupiahSchema.default(0),
  discount_amount: RupiahSchema.default(0),
  promo_name: z.string().nullable().default(null),
  promo_code: z.string().nullable().default(null),
  voucher_discount: RupiahSchema.default(0),
  points_redeemed: z.number().int().default(0),
  points_discount: RupiahSchema.default(0),
  points_earned: z.number().int().default(0),
  member_id: z.string().nullable().default(null),
  service_amount: RupiahSchema.default(0),
  tax_amount: RupiahSchema.default(0),
  rounding_amount: z.number().int().default(0),
  void_reason: z.string().nullable().default(null),
  created_by: z.string().nullable().default(null),
  status: OrderStatusSchema,
  payment_method: PaymentMethodSchema.nullable(),
  cash_received: RupiahSchema.nullable(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
  /** Nomor urut baris `items` yang sudah jadi (centang per menu). */
  items_done: z.array(z.number().int()).default([]),
})

export type OrderStatus = z.infer<typeof OrderStatusSchema>
export type OrderType = z.infer<typeof OrderTypeSchema>
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>
export type StaffRole = z.infer<typeof StaffRoleSchema>
export type ModifierGroup = z.infer<typeof ModifierGroupSchema>
export type Category = z.infer<typeof CategorySchema>
export type Product = z.infer<typeof ProductSchema>

/** Bisa dijual: tidak dimatikan manual dan bahan resepnya masih cukup untuk minimal 1 porsi. */
export const isSellable = (p: Pick<Product, 'is_available' | 'portions'>) => p.is_available && (p.portions === null || p.portions > 0)
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
  EDC_CARD: 'Kartu debit/kredit',
  MIDTRANS: 'QRIS',
}

// ---------- shift: serah terima, rincian selisih, statistik ----------
export const ShiftStatusSchema = z.object({
  cash_float: z.number().optional(),
  open: z.object({ id: z.string(), who: z.string().nullable(), opened_at: z.string(), mine: z.boolean() }).nullable(),
  last_closed: z.object({ counted_cash: z.number().nullable(), deposit: z.number().nullable().optional(), closed_at: z.string().nullable(), who: z.string().nullable(), difference: z.number().nullable() }).nullable(),
})
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>

const DetailOrderSchema = z.object({
  id: z.string(),
  queue_code: z.string(),
  customer_name: z.string(),
  order_type: z.string().optional(),
  table_no: z.string().nullable().optional(),
  total: z.number(),
  payment_method: z.string().nullable(),
  status: z.string(),
  paid_at: z.string().nullable().optional(),
  source: z.enum(['CUSTOMER', 'STAFF']).optional(),
  created_by: z.string().nullable().optional(),
  paid_by: z.string().nullable().optional(),
  void_reason: z.string().nullable().optional(),
  voided_by: z.string().nullable().optional(),
  voided_at: z.string().nullable().optional(),
  counted: z.boolean().optional(),
})
export const ShiftDetailSchema = z.object({
  shift: z.object({
    id: z.string(),
    opened_by: z.string().nullable(),
    opened_at: z.string(),
    closed_by: z.string().nullable(),
    closed_at: z.string().nullable(),
    opening_cash: z.number(),
    opening_expected: z.number().nullable(),
    opening_note: z.string(),
    counted_cash: z.number().nullable(),
    expected_cash: z.number().nullable(),
    difference: z.number().nullable(),
    note: z.string(),
    forced: z.boolean(),
    handover_from: z.string().nullable(),
    reviewed_by: z.string().nullable(),
    reviewed_at: z.string().nullable(),
    review_note: z.string(),
  }),
  totals: z.object({ opening: z.number(), cash_sales: z.number(), cash_in: z.number(), cash_out: z.number(), cash_reversals: z.number(), expected: z.number() }),
  orders: z.array(DetailOrderSchema),
  reversals: z.array(DetailOrderSchema),
  movements: z.array(z.object({ id: z.string(), kind: z.enum(['IN', 'OUT']), amount: z.number(), reason: z.string(), by: z.string().nullable(), at: z.string() })),
  by_method: z.record(z.string(), z.object({ count: z.number(), total: z.number() })),
})
export type ShiftDetail = z.infer<typeof ShiftDetailSchema>

export const ShiftStatsSchema = z.object({
  open_now: z.number(),
  closed: z.number(),
  diff_total: z.number(),
  short_total: z.number(),
  over_total: z.number(),
  with_diff: z.number(),
  unreviewed: z.number(),
  handover_mismatch: z.number(),
  forced: z.number(),
  by_cashier: z.array(z.object({ cashier: z.string(), shifts: z.number(), diff_sum: z.number(), short_sum: z.number(), with_diff: z.number() })),
})
export type ShiftStats = z.infer<typeof ShiftStatsSchema>
