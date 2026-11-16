import { RotateCcw } from 'lucide-react'
import { RowsSkeleton } from '@shared/components/skeletons'
import { useState } from 'react'
import { z } from 'zod'
import { EmptyState, LoadMore, SearchBox } from '@shared/components/pagination'
import { ToneBadge } from '@shared/components/tone-badge'
import { Button } from '@shared/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@shared/components/ui/drawer'
import { supabase } from '@shared/lib/supabase'
import { usePaged } from '@shared/lib/use-paged'
import { rupiah, timeJakarta } from '@shared/lib/utils'
import { OrderSchema, PAYMENT_LABEL, can, type Order, type StaffRole } from '@shared/types/contracts'
import { ReversePanel } from './bill-tools'

const LABEL: Record<string, { tone: 'green' | 'blue' | 'amber' | 'red'; text: string }> = {
  IN_KITCHEN: { tone: 'blue', text: 'Sudah dibayar' },
  READY: { tone: 'green', text: 'Siap' },
  COMPLETED: { tone: 'green', text: 'Selesai' },
  VOID: { tone: 'red', text: 'Void' },
  REFUNDED: { tone: 'red', text: 'Refund' },
}

/** Riwayat transaksi hari ini: lihat ulang struk, void/refund (PIN supervisor untuk kasir). */
export function HistoryDrawer({ open, onOpenChange, role, onReprint }: { open: boolean; onOpenChange: (o: boolean) => void; role: StaffRole | null; onReprint: (o: Order) => void }) {
  const [target, setTarget] = useState<Order | null>(null)

  // Halaman ke-n dari transaksi hari ini; cari kode antrean atau nama.
  const orders = usePaged<Order>(
    async ({ from, to }, term) => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      let q = supabase.from('orders').select('*', { count: 'exact' }).eq('business_day', today).in('status', Object.keys(LABEL)).order('paid_at', { ascending: false }).range(from, to)
      if (term) {
        const safe = term.replace(/[%,()]/g, '')
        q = q.or(`queue_code.ilike.%${safe}%,customer_name.ilike.%${safe}%`)
      }
      const r = await q
      return { ...r, data: z.array(OrderSchema).safeParse(r.data ?? []).data ?? [] }
    },
    { pageSize: 15, append: true, deps: [open] },
  )

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
        <DrawerContent size="sm">
          <DrawerHeader className="border-b text-left">
            <DrawerTitle>Riwayat hari ini</DrawerTitle>
            <DrawerDescription>Transaksi yang sudah dibayar. Void/refund tercatat di log audit.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pt-3">
            <SearchBox value={orders.search} onChange={orders.setSearch} placeholder="Cari kode atau nama" />
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto px-4">
            {orders.loading && orders.rows.length === 0 && <li><RowsSkeleton rows={4} className="-mx-4" /></li>}
            {orders.rows.map((o) => {
              const s = LABEL[o.status]
              const reversible = can.pay(role) && (o.status === 'IN_KITCHEN' || o.status === 'READY' || o.status === 'COMPLETED')
              return (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <button type="button" onClick={() => onReprint(o)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{o.queue_code}</span>
                      <ToneBadge tone={s.tone}>{s.text}</ToneBadge>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {o.customer_name} · {o.paid_at && timeJakarta(o.paid_at)} · {o.payment_method && PAYMENT_LABEL[o.payment_method]}
                    </p>
                    {o.void_reason && <p className="truncate text-xs text-destructive">Alasan: {o.void_reason}</p>}
                  </button>
                  <span className={`tabular-nums ${o.status === 'VOID' || o.status === 'REFUNDED' ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{rupiah(o.total)}</span>
                  {reversible && (
                    <Button variant="outline" size="icon" aria-label={`Void atau refund ${o.queue_code}`} className="size-11" onClick={() => setTarget(o)}>
                      <RotateCcw />
                    </Button>
                  )}
                </li>
              )
            })}
            {orders.rows.length === 0 && !orders.loading && (
              <li className="py-6">
                <EmptyState title={orders.search ? 'Tidak ditemukan' : 'Belum ada transaksi'} hint={orders.search ? 'Coba kode atau nama lain.' : 'Transaksi yang sudah dibayar hari ini muncul di sini.'} />
              </li>
            )}
          </ul>
          <div className="px-4">
            <LoadMore shown={orders.rows.length} total={orders.total} pageSize={orders.pageSize} onMore={orders.more} loading={orders.loading} noun="transaksi" />
          </div>
          <DrawerFooter className="border-t pt-3">
            <DrawerClose render={<Button variant="outline" className="h-11">Tutup</Button>} />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      {target && (
        <ReversePanel
          order={target}
          role={role}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null)
            orders.reload()
          }}
        />
      )}
    </>
  )
}
