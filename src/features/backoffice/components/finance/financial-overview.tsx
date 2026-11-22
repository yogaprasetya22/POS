import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Banknote, Coins, CreditCard, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import type { FinancialSummary } from '@shared/types/contracts'

export function FinancialOverview({ className = '' }: { className?: string }) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchSummary = useCallback(async (isManualRefresh = false) => {
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
    }
  }, [])

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

  const isNetPositive = s.today_net_profit >= 0
  const qrisCut = (s.midtrans_total_fee || 0) + (s.midtrans_total_tax || 0)
  const costs = s.today_cogs + s.today_waste + s.today_expenses

  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <Coins className="size-5 text-primary" /> Uang & untung hari ini
          </h2>
          <p className="text-sm text-muted-foreground">
            Diperbarui otomatis{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <Link to="/admin/keuangan" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Lihat detail keuangan <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Untung hari ini */}
        <div className="rounded-3xl border-2 bg-card p-5 shadow-xs">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            {isNetPositive ? <TrendingUp className="size-4 text-emerald-600" /> : <TrendingDown className="size-4 text-amber-600" />}
            {isNetPositive ? 'Untung hari ini' : 'Rugi hari ini'}
          </p>
          <p className={`mt-1 text-3xl font-black tabular-nums ${isNetPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {rupiah(s.today_net_profit)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Penjualan <strong className="text-foreground">{rupiah(s.today_net_sales)}</strong> dikurangi modal bahan & pengeluaran{' '}
            <strong className="text-foreground">{rupiah(costs)}</strong>
          </p>
        </div>

        {/* Uang tunai di laci */}
        <div className="rounded-3xl border-2 bg-card p-5 shadow-xs">
          <p className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5"><Banknote className="size-4 text-amber-600" /> Uang tunai di laci</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.has_active_shift ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
              {s.has_active_shift ? 'Kasir buka' : 'Kasir tutup'}
            </span>
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums">{rupiah(s.cash_drawer_balance)}</p>
          <Link to="/admin/shift" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Cek shift kasir <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Saldo QRIS */}
        <div className="rounded-3xl border-2 bg-card p-5 shadow-xs">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <CreditCard className="size-4 text-primary" /> Saldo QRIS
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums text-primary">{rupiah(s.midtrans_available_balance)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {qrisCut > 0 ? <>Sudah dipotong biaya Midtrans {rupiah(qrisCut)}</> : 'Belum ada pembayaran QRIS'}
          </p>
        </div>
      </div>
    </section>
  )
}
