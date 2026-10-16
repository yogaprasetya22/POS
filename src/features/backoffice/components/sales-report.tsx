import {
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShoppingBag,
  TrendingUp,
  User,
  Utensils,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { ErrorAlert } from '@shared/components/error-alert'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card } from '@shared/components/ui/card'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@shared/components/ui/drawer'
import { Input } from '@shared/components/ui/input'
import { Separator } from '@shared/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table'
import { supabase } from '@shared/lib/supabase'
import { rupiah, timeJakarta, todayJakarta } from '@shared/lib/utils'
import {
  OrderSchema,
  PAYMENT_LABEL,
  PaymentMethodSchema,
  type Order,
} from '@shared/types/contracts'

type DateFilterMode = 'today' | 'yesterday' | 'week' | 'custom'

const getYesterdayJakarta = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

const getWeekAgoJakarta = () => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

/**
 * Laporan Penjualan & Riwayat Transaksi
 * // ponytail: filter tanggal berbasis 3 preset standar + tanggal kustom tanpa dependensi picker berat.
 * Dilengkapi drawer rincian struk lengkap untuk setiap transaksi.
 */
export function SalesReport() {
  const [filterMode, setFilterMode] = useState<DateFilterMode>('today')
  const [customDay, setCustomDay] = useState(todayJakarta())
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    let query = supabase.from('orders').select('*').not('paid_at', 'is', null)

    if (filterMode === 'today') {
      query = query.eq('business_day', todayJakarta())
    } else if (filterMode === 'yesterday') {
      query = query.eq('business_day', getYesterdayJakarta())
    } else if (filterMode === 'week') {
      query = query.gte('business_day', getWeekAgoJakarta()).lte('business_day', todayJakarta())
    } else {
      query = query.eq('business_day', customDay)
    }

    query
      .order('paid_at', { ascending: false })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) {
          setError(error.message)
          setOrders([])
        } else {
          setError('')
          const parsed = z.array(OrderSchema).safeParse(data)
          setOrders(parsed.success ? parsed.data : [])
        }
      })
  }, [filterMode, customDay])

  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.total, 0), [orders])
  const totalCount = orders.length
  const avgOrderValue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(
      (o) =>
        o.queue_code.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.table_no ?? '').toLowerCase().includes(q)
    )
  }, [orders, searchQuery])

  const paymentStats = useMemo(() => {
    return PaymentMethodSchema.options.map((m) => {
      const list = orders.filter((o) => o.payment_method === m)
      const sum = list.reduce((s, o) => s + o.total, 0)
      const count = list.length
      const percent = totalRevenue > 0 ? Math.round((sum / totalRevenue) * 100) : 0
      return { method: m, label: PAYMENT_LABEL[m], sum, count, percent }
    })
  }, [orders, totalRevenue])

  return (
    <div className="space-y-5">
      {/* Top Header & Date Presets */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Laporan & Penjualan</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Rekap pendapatan dan rincian transaksi terbayar.
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1 text-xs">
          <Button
            type="button"
            size="sm"
            variant={filterMode === 'today' ? 'default' : 'ghost'}
            onClick={() => setFilterMode('today')}
            className="rounded-xl text-xs h-8 px-3"
          >
            Hari Ini
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterMode === 'yesterday' ? 'default' : 'ghost'}
            onClick={() => setFilterMode('yesterday')}
            className="rounded-xl text-xs h-8 px-3"
          >
            Kemarin
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterMode === 'week' ? 'default' : 'ghost'}
            onClick={() => setFilterMode('week')}
            className="rounded-xl text-xs h-8 px-3"
          >
            7 Hari Terakhir
          </Button>
          <div className="flex items-center gap-1 pl-1 border-l">
            <Calendar className="size-3.5 text-muted-foreground ml-1" />
            <Input
              type="date"
              aria-label="Pilih tanggal kustom"
              value={customDay}
              onChange={(e) => {
                setCustomDay(e.target.value)
                setFilterMode('custom')
              }}
              className="h-8 w-34 text-xs border-none bg-transparent p-1 focus-visible:ring-0"
            />
          </div>
        </div>
      </div>

      <ErrorAlert message={error} />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Pendapatan
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">{rupiah(totalRevenue)}</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dari {totalCount} pesanan selesai
          </p>
        </Card>

        <Card className="rounded-2xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Transaksi
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">{totalCount} Pesanan</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filterMode === 'week' ? 'Akumulasi 7 hari' : 'Periode terpilih'}
          </p>
        </Card>

        <Card className="rounded-2xl border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rata-rata per Struk (AOV)
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <Coins className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black">{rupiah(avgOrderValue)}</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rata-rata nominal per transaksi
          </p>
        </Card>
      </div>

      {/* Payment Methods Breakdown Cards */}
      <Card className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Sebaran Metode Pembayaran
          </span>
          <span className="text-xs text-muted-foreground">{totalCount} transaksi</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {paymentStats.map((p) => {
            const Icon =
              p.method === 'CASH' ? Wallet : p.method === 'QRIS_STATIC' ? QrCode : CreditCard
            return (
              <div key={p.method} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-background border shadow-xs">
                  <Icon className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{p.label}</span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1 font-bold">
                      {p.percent}%
                    </Badge>
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{rupiah(p.sum)}</div>
                  <div className="text-[11px] text-muted-foreground">{p.count} pesanan</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="rounded-2xl border overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b p-3 bg-card">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode antrean, nama pembeli, meja..."
              aria-label="Cari transaksi"
              className="pl-10 h-9 rounded-xl text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            Klik baris untuk rincian struk
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4">Waktu</TableHead>
              <TableHead>Antrean</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead className="hidden md:table-cell">Layanan</TableHead>
              <TableHead>Metode Bayar</TableHead>
              <TableHead className="text-right pr-4">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                  Memuat data transaksi...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                  {orders.length === 0
                    ? 'Tidak ada transaksi terbayar pada periode ini.'
                    : 'Tidak ada transaksi yang cocok dengan pencarian.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedOrder(o)}
                >
                  <TableCell className="pl-4 text-xs font-mono text-muted-foreground">
                    {o.paid_at ? timeJakarta(o.paid_at) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono font-bold bg-muted/50 text-xs">
                      #{o.queue_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {o.customer_name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {o.order_type === 'DINE_IN' ? (
                      <span className="inline-flex items-center gap-1">
                        <Utensils className="size-3" /> Meja {o.table_no ?? '—'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ShoppingBag className="size-3" /> Bawa Pulang
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.payment_method ? (
                      <Badge variant="secondary" className="font-normal text-xs">
                        {PAYMENT_LABEL[o.payment_method]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums pr-4">
                    {rupiah(o.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Order Detail Drawer */}
      <Drawer open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)} swipeDirection="right">
        <DrawerContent style={{ '--drawer-content-width': 'min(100vw, 30rem)' } as React.CSSProperties}>
          {selectedOrder && (
            <>
              <DrawerHeader className="border-b text-left pb-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-sm font-bold bg-primary/10 text-primary border-primary/20">
                    Antrean #{selectedOrder.queue_code}
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-xs text-emerald-600 bg-emerald-500/10">
                    <CheckCircle2 className="size-3" /> Selesai Terbayar
                  </Badge>
                </div>
                <DrawerTitle className="text-xl font-bold mt-2">
                  Struk Transaksi
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground">
                  ID: {selectedOrder.id}
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none text-sm">
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-xs border">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nama Pembeli:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                      <User className="size-3" /> {selectedOrder.customer_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Layanan:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                      {selectedOrder.order_type === 'DINE_IN'
                        ? `Makan di Tempat (Meja ${selectedOrder.table_no ?? '—'})`
                        : 'Bawa Pulang'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Waktu Bayar:</span>
                    <span className="font-mono text-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="size-3" />
                      {selectedOrder.paid_at ? timeJakarta(selectedOrder.paid_at) : '—'} (
                      {selectedOrder.business_day})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Metode Bayar:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                      {selectedOrder.payment_method ? PAYMENT_LABEL[selectedOrder.payment_method] : '—'}
                    </span>
                  </div>
                </div>

                {/* Items Breakdown */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Rincian Pesanan
                  </div>
                  <div className="divide-y rounded-xl border">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-foreground">
                            <span className="font-bold text-primary mr-1.5">{item.qty}x</span>
                            {item.name}
                          </div>
                          <div className="font-bold tabular-nums shrink-0">
                            {rupiah(item.subtotal)}
                          </div>
                        </div>

                        {/* Modifiers */}
                        {item.choices.length > 0 && (
                          <div className="text-xs text-muted-foreground pl-5 space-y-0.5">
                            {item.choices.map((c, cIdx) => (
                              <div key={cIdx} className="flex justify-between">
                                <span>+ {c.group}: {c.option}</span>
                                {c.price > 0 && <span>+{rupiah(c.price)}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Note */}
                        {item.note && (
                          <div className="text-xs italic text-amber-700 dark:text-amber-300 pl-5 bg-amber-500/10 rounded-md p-1 mt-1">
                            Catatan: {item.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary calculation */}
                <div className="rounded-xl bg-card border p-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium">{rupiah(selectedOrder.total)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-extrabold text-foreground">
                    <span>Total Pembayaran</span>
                    <span className="tabular-nums text-primary">{rupiah(selectedOrder.total)}</span>
                  </div>

                  {selectedOrder.payment_method === 'CASH' && selectedOrder.cash_received && (
                    <div className="pt-2 border-t space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tunai Diterima</span>
                        <span className="tabular-nums">{rupiah(selectedOrder.cash_received)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-emerald-600">
                        <span>Kembalian</span>
                        <span className="tabular-nums">
                          {rupiah(Math.max(0, selectedOrder.cash_received - selectedOrder.total))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DrawerFooter className="border-t flex-row gap-2 pt-3">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex-1 gap-2"
                >
                  <Printer className="size-4" /> Cetak Struk
                </Button>
                <DrawerClose render={<Button variant="ghost">Tutup</Button>} />
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
