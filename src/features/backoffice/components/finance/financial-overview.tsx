import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  Coins,
  RefreshCw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import type { FinancialSummary } from '@shared/types/contracts'
import { WithdrawalDrawer } from './withdrawal-drawer'

export function FinancialOverview({ className = '' }: { className?: string }) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchSummary = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    try {
      const { data, error: rpcError } = await rpc('get_store_financial_summary')
      if (rpcError) {
        throw new Error(rpcError.message || 'Gagal memuat ringkasan keuangan.')
      }
      setSummary(data as FinancialSummary)
      setLastUpdated(new Date())
      setError(null)
      if (isManualRefresh) {
        toast.success('Ringkasan keuangan dan saldo diperbarui.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat saldo.'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const handleSyncMidtrans = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/midtrans?action=sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal sinkronisasi dengan Midtrans')
      }
      toast.success(
        `Sinkronisasi Midtrans (${data.mode}) selesai: ${data.checked_count} transaksi dicek, ${data.settled_count} lunas, ${data.expired_count} kadaluwarsa.`
      )
      void fetchSummary(true)
    } catch (err: unknown) {
      toast.error('Gagal sinkronisasi Midtrans', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    void fetchSummary(false)
    // Polling setiap 30 detik untuk update real-time
    const interval = setInterval(() => {
      void fetchSummary(false)
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchSummary])

  if (loading && !summary) {
    return (
      <div className={`rounded-3xl border-2 border-border/70 bg-card p-6 shadow-sm ${className}`}>
        <div className="flex items-center justify-between pb-4">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className={`rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-6 ${className}`}>
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchSummary(true)} className="gap-2">
            <RefreshCw className="size-4" /> Coba Lagi
          </Button>
        </div>
      </div>
    )
  }

  const s: FinancialSummary = summary || {
    today_date: '',
    today_orders_count: 0,
    today_gross_sales: 0,
    today_discounts: 0,
    today_net_sales: 0,
    today_cogs: 0,
    today_gross_profit: 0,
    gross_margin_percent: 0,
    today_waste: 0,
    today_expenses: 0,
    today_net_profit: 0,
    net_margin_percent: 0,
    cash_drawer_balance: 0,
    has_active_shift: false,
    midtrans_total_received: 0,
    midtrans_gross_amount: 0,
    midtrans_total_fee: 0,
    midtrans_total_tax: 0,
    midtrans_net_received: 0,
    midtrans_total_withdrawn: 0,
    midtrans_available_balance: 0,
    midtrans_qris_mdr: 0.7,
    midtrans_tax_rate: 11.0,
    midtrans_payout_fee: 5000,
    midtrans_auto_payout: true,
    bank_name: '',
    account_number: '',
    account_holder: '',
  }

  const isGrossPositive = s.today_gross_profit >= 0
  const isNetPositive = s.today_net_profit >= 0

  return (
    <section className={`space-y-4 ${className}`}>
      {/* Header Keuangan Real-Time */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Coins className="size-4" />
            </span>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Keuangan & Saldo Real-Time</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 animate-ping rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Laba kotor, laba bersih, dan arus kas laci kasir serta dana digital Midtrans hari ini.
            {lastUpdated && (
              <span className="ml-1 text-xs">
                (Update {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchSummary(true)}
            disabled={refreshing}
            className="h-9 gap-1.5 rounded-xl border-2 text-sm font-semibold"
            title="Muat ulang data saldo real-time"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Perbarui</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncMidtrans}
            disabled={syncing}
            className="h-9 gap-1.5 rounded-xl border-2 border-primary/30 text-sm font-semibold hover:bg-primary/5"
            title="Sinkronkan status transaksi langsung dengan server Midtrans"
          >
            <RotateCcw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sinkronkan Midtrans</span>
          </Button>

          <Button
            onClick={() => setIsWithdrawOpen(true)}
            className="h-9 gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <ArrowDownToLine className="size-4" />
            <span>Tarik Saldo</span>
          </Button>
        </div>
      </div>

      {/* Grid 4 Kartu Ringkasan Keuangan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Laba Kotor (Gross Profit) */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] to-card p-4 transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Laba Kotor Hari Ini</span>
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
                  isGrossPositive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {isGrossPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {s.gross_margin_percent}%
              </span>
            </div>
            <p className={`text-2xl font-black tracking-tight ${isGrossPositive ? 'text-foreground' : 'text-destructive'}`}>
              {rupiah(s.today_gross_profit)}
            </p>
          </div>

          <div className="mt-3 border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
            <div className="flex justify-between py-0.5">
              <span>Penjualan Bersih:</span>
              <span className="font-semibold text-foreground">{rupiah(s.today_net_sales)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Modal Bahan (HPP):</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_cogs)}</span>
            </div>
          </div>
        </div>

        {/* 2. Laba Bersih (Net Profit) */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-sky-500/20 bg-gradient-to-b from-sky-500/[0.04] to-card p-4 transition-all hover:border-sky-500/40 hover:shadow-md">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Laba Bersih Hari Ini</span>
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
                  isNetPositive
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {isNetPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {s.net_margin_percent}%
              </span>
            </div>
            <p className={`text-2xl font-black tracking-tight ${isNetPositive ? 'text-foreground' : 'text-destructive'}`}>
              {rupiah(s.today_net_profit)}
            </p>
          </div>

          <div className="mt-3 border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
            <div className="flex justify-between py-0.5">
              <span>Bahan Terbuang:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_waste)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Kas Keluar Toko:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_expenses)}</span>
            </div>
          </div>
        </div>

        {/* 3. Saldo Kas di Laci Kasir (Cash Drawer) */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-amber-500/20 bg-gradient-to-b from-amber-500/[0.04] to-card p-4 transition-all hover:border-amber-500/40 hover:shadow-md">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Uang Kas di Laci</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                  s.has_active_shift
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s.has_active_shift ? 'Shift Aktif' : 'Shift Tutup'}
              </span>
            </div>
            <p className="text-2xl font-black tracking-tight text-foreground">
              {rupiah(s.cash_drawer_balance)}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
            <span className="text-muted-foreground">Fisik kasir saat ini</span>
            <Link
              to="/admin/shift"
              className="font-bold text-amber-600 hover:underline dark:text-amber-400"
            >
              Cek Laci Kasir &rarr;
            </Link>
          </div>
        </div>

        {/* 4. Saldo Midtrans Siap Ditarik */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/[0.05] to-card p-4 transition-all hover:border-primary/60 hover:shadow-md">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saldo Bersih Midtrans</span>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  Sandbox
                </span>
                {s.midtrans_auto_payout && (
                  <span className="inline-flex items-center rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                    Auto-WD
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  Tersedia
                </span>
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight text-primary">
              {rupiah(s.midtrans_available_balance)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Nett setelah dipotong MDR ({s.midtrans_qris_mdr}%) & PPN 11%
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
            <span className="text-muted-foreground">
              Nett: <strong className="font-semibold text-foreground">{rupiah(s.midtrans_total_received)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsWithdrawOpen(true)}
              className="font-bold text-primary hover:underline"
            >
              Tarik Saldo &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Penarikan Dana (Withdrawal Drawer) */}
      <WithdrawalDrawer
        open={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        summary={summary}
        onSuccess={() => {
          void fetchSummary(false)
        }}
      />
    </section>
  )
}
