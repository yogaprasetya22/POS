import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  History,
  Info,
  Landmark,
  Loader2,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import type { FinancialSummary, Withdrawal } from '@shared/types/contracts'
import { POPULAR_BANKS, WithdrawalDrawer } from './withdrawal-drawer'

export function FinancePageView() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview')

  // Edit Bank Form State
  const [bankName, setBankName] = useState('BCA')
  const [customBank, setCustomBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [savingBank, setSavingBank] = useState(false)

  // Edit Midtrans Settings State
  const [autoPayout, setAutoPayout] = useState(true)
  const [qrisMdr, setQrisMdr] = useState('0.7')
  const [taxRate, setTaxRate] = useState(11.0)
  const [payoutFee, setPayoutFee] = useState('5000')
  const [savingSettings, setSavingSettings] = useState(false)

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const [sumRes, wdRes] = await Promise.all([
        rpc('get_store_financial_summary'),
        rpc('get_withdrawals', { p_limit: 50 }),
      ])

      if (sumRes.data) {
        const s = sumRes.data as FinancialSummary
        setSummary(s)
        if (s.bank_name) {
          const match = POPULAR_BANKS.some((b) => b.code === s.bank_name)
          if (match) {
            setBankName(s.bank_name)
          } else {
            setBankName('OTHER')
            setCustomBank(s.bank_name)
          }
        }
        if (s.account_number) setAccountNumber(s.account_number)
        if (s.account_holder) setAccountHolder(s.account_holder)
        if (s.midtrans_auto_payout !== undefined) setAutoPayout(s.midtrans_auto_payout)
        if (s.midtrans_qris_mdr !== undefined) setQrisMdr(String(s.midtrans_qris_mdr))
        if (s.midtrans_tax_rate !== undefined) setTaxRate(s.midtrans_tax_rate)
        if (s.midtrans_payout_fee !== undefined) setPayoutFee(String(s.midtrans_payout_fee))
      }

      if (wdRes.data && Array.isArray(wdRes.data)) {
        setWithdrawals(wdRes.data as Withdrawal[])
      }

      if (isManual) {
        toast.success('Data keuangan berhasil diperbarui')
      }
    } catch (err: unknown) {
      toast.error('Gagal memuat ringkasan keuangan', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(false)
  }, [fetchData])

  const handleSyncMidtrans = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/midtrans?action=sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal sinkronisasi dengan Midtrans')
      }
      toast.success(
        `Sinkronisasi Midtrans (${data.mode}) selesai: ${data.checked_count} transaksi dicek, ${data.settled_count} lunas, ${data.expired_count} kadaluwarsa.${data.mismatch_count ? ` ${data.mismatch_count} nominal tidak cocok (tidak dicatat).` : ''}`
      )
      void fetchData(true)
    } catch (err: unknown) {
      toast.error('Gagal sinkronisasi Midtrans', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalBank = bankName === 'OTHER' ? customBank.trim().toUpperCase() : bankName
    if (!finalBank) {
      toast.error('Pilih atau ketik nama bank')
      return
    }
    if (!accountNumber.trim()) {
      toast.error('Nomor rekening wajib diisi')
      return
    }
    if (!accountHolder.trim()) {
      toast.error('Nama pemilik rekening wajib diisi')
      return
    }

    setSavingBank(true)
    try {
      const { error } = await rpc('save_store_bank_account', {
        p_bank_name: finalBank,
        p_account_number: accountNumber.trim(),
        p_account_holder: accountHolder.trim().toUpperCase(),
      })

      if (error) {
        toast.error('Gagal menyimpan rekening', { description: error.message })
        return
      }

      toast.success('Rekening bank toko berhasil disimpan!')
      void fetchData(false)
    } finally {
      setSavingBank(false)
    }
  }

  const handleSaveMidtransSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    const mdrNum = parseFloat(qrisMdr) || 0.7
    const taxNum = Number(taxRate) || 11.0
    const feeNum = parseInt(payoutFee, 10) || 5000

    setSavingSettings(true)
    try {
      const { error } = await rpc('save_midtrans_payout_tax_settings', {
        p_auto_payout: autoPayout,
        p_qris_mdr: mdrNum,
        p_tax_rate: taxNum,
        p_payout_fee: feeNum,
      })
      if (error) {
        toast.error('Gagal menyimpan pengaturan Midtrans', { description: error.message })
        return
      }
      toast.success('Pengaturan pajak & payout Midtrans berhasil disimpan')
      void fetchData(false)
    } finally {
      setSavingSettings(false)
    }
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
  const totalLiquidFunds = (s.cash_drawer_balance || 0) + (s.midtrans_available_balance || 0)
  const totalMidtransDeduction = (s.midtrans_total_fee || 0) + (s.midtrans_total_tax || 0)
  const hasBank = Boolean(s.bank_name && s.account_number)
  const canWithdraw = (s.midtrans_available_balance || 0) > 0

  // Simulasi potongan untuk transaksi contoh Rp100.000 (pakai nilai form yang sedang diedit)
  const SAMPLE = 100_000
  const sampleMdr = Math.round((SAMPLE * (parseFloat(qrisMdr) || 0)) / 100)
  const sampleTax = Math.round((sampleMdr * (Number(taxRate) || 0)) / 100)
  const sampleNet = SAMPLE - sampleMdr - sampleTax

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })

  const lossReasons: string[] = []
  if (!isNetPositive) {
    if (s.today_waste > 0) lossReasons.push(`bahan terbuang ${rupiah(s.today_waste)}`)
    if (s.today_expenses > 0) lossReasons.push(`pengeluaran toko ${rupiah(s.today_expenses)}`)
    if (s.today_gross_profit < 0) lossReasons.push('harga jual lebih rendah dari modal bahan')
  }

  if (loading && !summary) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-64 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-3xl bg-muted/60" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-3xl bg-muted/60" />
          <div className="h-72 animate-pulse rounded-3xl bg-muted/60" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight sm:text-3xl">
            <Coins className="size-7 text-primary" /> Keuangan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan uang toko per <span className="font-semibold text-foreground">{todayLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="h-10 gap-2 rounded-xl px-3 font-semibold"
            title="Muat ulang data"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Perbarui</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncMidtrans}
            disabled={syncing}
            className="h-10 gap-2 rounded-xl px-3 font-semibold"
            title="Cek ulang status pembayaran QRIS langsung ke Midtrans"
          >
            <RotateCcw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Menyinkronkan…' : 'Sinkron QRIS'}
          </Button>
        </div>
      </div>

      {/* ─── Peringatan rekening belum diatur ─── */}
      {!hasBank && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          <span className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <span>
              <strong>Rekening bank belum diatur.</strong> Saldo QRIS belum bisa dicairkan sebelum rekening tujuan disimpan.
            </span>
          </span>
          <Button size="sm" onClick={() => setActiveTab('settings')} className="gap-1.5 rounded-xl font-semibold">
            Atur Rekening <ArrowRight className="size-4" />
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'settings')} className="w-full space-y-6">
        <TabsList className="grid h-11 w-full max-w-sm grid-cols-2 rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="overview" className="gap-2 rounded-xl text-sm font-bold">
            <Coins className="size-4" /> Ringkasan
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 rounded-xl text-sm font-bold">
            <Settings className="size-4" /> Pengaturan
          </TabsTrigger>
        </TabsList>

        {/* ══════════════ TAB RINGKASAN ══════════════ */}
        <TabsContent value="overview" className="mt-2">
          <div className="flex flex-col gap-8">
          {/* 1. Uang yang dimiliki sekarang */}
          <section className="overflow-hidden rounded-3xl border-2 bg-card shadow-xs">
            <div className="flex flex-wrap items-end justify-between gap-4 bg-gradient-to-br from-primary/[0.07] to-transparent p-5 sm:p-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Total uang toko saat ini</p>
                <p className="mt-1 text-4xl font-black tracking-tight tabular-nums sm:text-5xl">{rupiah(totalLiquidFunds)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Gabungan uang tunai di laci + saldo QRIS yang bisa ditarik</p>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y border-t md:grid-cols-2 md:divide-x md:divide-y-0">
              <WalletTile
                icon={<Banknote className="size-5" />}
                tone="amber"
                title="Uang tunai di laci"
                amount={s.cash_drawer_balance}
                badge={
                  <Badge variant={s.has_active_shift ? 'default' : 'secondary'} className="text-[10px] font-bold">
                    {s.has_active_shift ? '● Shift aktif' : 'Shift tutup'}
                  </Badge>
                }
                action={
                  <Link to="/admin/shift" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline dark:text-amber-400">
                    Lihat rincian shift <ChevronRight className="size-4" />
                  </Link>
                }
              />
              <WalletTile
                icon={<CreditCard className="size-5" />}
                tone="primary"
                title="Saldo QRIS siap tarik"
                amount={s.midtrans_available_balance}
                badge={
                  s.midtrans_auto_payout ? (
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                      Cair otomatis harian
                    </span>
                  ) : null
                }
                action={
                  <Button
                    size="sm"
                    onClick={() => setIsWithdrawOpen(true)}
                    disabled={!canWithdraw || !hasBank}
                    className="gap-1.5 rounded-xl font-semibold"
                    title={!hasBank ? 'Atur rekening bank terlebih dahulu' : !canWithdraw ? 'Belum ada saldo untuk ditarik' : undefined}
                  >
                    <ArrowDownToLine className="size-4" /> Tarik ke Rekening
                  </Button>
                }
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* 2. Untung / rugi hari ini */}
            <section className="space-y-4 rounded-3xl border-2 bg-card p-5 shadow-xs sm:p-6 lg:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight">Untung hari ini</h2>
                  <p className="text-sm text-muted-foreground">Dari penjualan sampai sisa uang yang benar-benar jadi untung.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  <ShoppingBag className="size-3.5" /> {s.today_orders_count} pesanan
                </span>
              </div>

              <div
                className={`rounded-2xl p-4 ${
                  isNetPositive ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'
                }`}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {isNetPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  {isNetPositive ? 'Laba bersih' : 'Rugi bersih'}
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                  <p className="text-3xl font-black tabular-nums sm:text-4xl">{rupiah(s.today_net_profit)}</p>
                  <span className="text-sm font-semibold opacity-80">margin {s.net_margin_percent}%</span>
                </div>
              </div>

              <dl className="space-y-0.5 text-sm">
                <FlowRow label="Penjualan (setelah diskon)" hint={s.today_discounts > 0 ? `diskon ${rupiah(s.today_discounts)}` : undefined} value={s.today_net_sales} />
                <FlowRow label="Modal bahan baku (HPP)" value={-s.today_cogs} />
                <FlowRow label="Laba kotor" hint={`margin ${s.gross_margin_percent}%`} value={s.today_gross_profit} subtotal />
                <FlowRow label="Bahan terbuang / rusak" value={-s.today_waste} />
                <FlowRow label="Pengeluaran toko" value={-s.today_expenses} />
                <FlowRow label={isNetPositive ? 'Laba bersih' : 'Rugi bersih'} value={s.today_net_profit} total />
              </dl>

              {lossReasons.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Kenapa rugi?</strong> Penyebab utama: {lossReasons.join(', ')}.
                  </span>
                </div>
              )}
            </section>

            {/* 3. Potongan QRIS */}
            <section className="space-y-4 rounded-3xl border-2 bg-card p-5 shadow-xs sm:p-6 lg:col-span-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">
                  <Receipt className="size-5 text-primary" /> Pembayaran QRIS
                </h2>
                <p className="text-sm text-muted-foreground">Dari uang yang dibayar pelanggan sampai yang masuk ke saldo.</p>
              </div>

              <ol className="space-y-2">
                <QrisStep n={1} label="Dibayar pelanggan" value={rupiah(s.midtrans_gross_amount)} />
                <QrisStep
                  n={2}
                  label="Dipotong Midtrans"
                  hint={`MDR ${s.midtrans_qris_mdr}% (${rupiah(s.midtrans_total_fee)}) + PPN ${s.midtrans_tax_rate}% (${rupiah(s.midtrans_total_tax)})`}
                  value={`− ${rupiah(totalMidtransDeduction)}`}
                  negative
                />
                <QrisStep n={3} label="Masuk bersih" value={rupiah(s.midtrans_net_received || s.midtrans_total_received)} />
                <QrisStep n={4} label="Sudah dicairkan ke bank" value={`− ${rupiah(s.midtrans_total_withdrawn)}`} negative />
              </ol>

              <div className="flex items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary/[0.06] p-3.5">
                <span className="text-sm font-bold text-primary">Sisa saldo siap tarik</span>
                <span className="text-xl font-black text-primary tabular-nums">{rupiah(s.midtrans_available_balance)}</span>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Ubah tarif potongan <ChevronRight className="size-4" />
              </button>
            </section>
          </div>

          {/* 4. Riwayat penarikan */}
          <Card className="rounded-3xl border-2 shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <History className="size-5 text-primary" /> Riwayat Pencairan
              </CardTitle>
              <CardDescription>Penarikan saldo QRIS ke rekening bank toko.</CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-10 text-center">
                  <Landmark className="mx-auto mb-2 size-9 text-muted-foreground/50" />
                  <p className="text-sm font-semibold">Belum ada pencairan</p>
                  <p className="text-xs text-muted-foreground">Pencairan saldo QRIS akan tampil di sini.</p>
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-2xl border">
                  {withdrawals.map((w) => {
                    const st = WD_STATUS[w.status]
                    return (
                      <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/30">
                        <div className="flex items-center gap-3">
                          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${st.cls}`}>{st.icon}</span>
                          <div>
                            <p className="text-sm font-semibold">
                              {w.bank_name} • {w.account_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(w.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                              <span className="font-mono">{w.reference_no}</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black tabular-nums">{rupiah(w.net_amount || w.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className={`font-semibold ${st.text}`}>{st.label}</span>
                            {w.fee > 0 && <> · biaya {rupiah(w.fee)}</>}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        {/* ══════════════ TAB PENGATURAN ══════════════ */}
        <TabsContent value="settings" className="mt-2">
          <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Card className="rounded-3xl border-2 shadow-xs">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Landmark className="size-5 text-primary" /> Rekening Bank Toko
                </CardTitle>
                <CardDescription>Ke rekening ini saldo QRIS akan dicairkan.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveBank} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-select">Bank</Label>
                    <Select value={bankName} onValueChange={(v) => v && setBankName(v)}>
                      <SelectTrigger id="bank-select" className="h-11 rounded-xl">
                        <SelectValue placeholder="Pilih bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BANKS.map((b) => (
                          <SelectItem key={b.code} value={b.code}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {bankName === 'OTHER' && (
                    <div className="space-y-2">
                      <Label htmlFor="custom-bank">Nama bank</Label>
                      <Input
                        id="custom-bank"
                        value={customBank}
                        onChange={(e) => setCustomBank(e.target.value)}
                        placeholder="Contoh: Bank Mega, BTN, Jenius"
                        className="h-11 rounded-xl"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="acc-number">Nomor rekening</Label>
                    <Input
                      id="acc-number"
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="1234567890"
                      className="h-11 rounded-xl font-mono tracking-wide"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acc-holder">Nama pemilik rekening</Label>
                    <Input
                      id="acc-holder"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                      placeholder="WARUNG KOPI NUSANTARA"
                      className="h-11 rounded-xl font-semibold uppercase"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Tulis persis seperti di buku tabungan.</p>
                  </div>

                  <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      Harus sama dengan rekening yang terverifikasi di <strong>Dashboard Midtrans → Settings → Billing</strong>, agar pencairan tidak ditolak.
                    </span>
                  </div>

                  <Button type="submit" disabled={savingBank} className="h-11 w-full gap-2 rounded-xl font-bold">
                    {savingBank ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Simpan Rekening
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-2 shadow-xs">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Wallet className="size-5 text-primary" /> Pencairan & Potongan QRIS
                </CardTitle>
                <CardDescription>Atur cara pencairan dan tarif yang dipotong Midtrans.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveMidtransSettings} className="space-y-5">
                  <div className="space-y-2">
                    <Label>Cara pencairan</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <ChoiceCard
                        active={autoPayout}
                        onClick={() => setAutoPayout(true)}
                        icon={<CheckCircle2 className="size-5" />}
                        title="Otomatis"
                        desc="Midtrans transfer tiap hari"
                      />
                      <ChoiceCard
                        active={!autoPayout}
                        onClick={() => setAutoPayout(false)}
                        icon={<ArrowDownToLine className="size-5" />}
                        title="Manual"
                        desc="Tarik sendiri kapan saja"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <AffixInput id="mdr-rate" label="Biaya MDR" suffix="%" step="0.01" max="10" value={qrisMdr} onChange={setQrisMdr} hint="Standar BI 0,7%" />
                    <AffixInput id="tax-rate" label="PPN atas MDR" suffix="%" step="0.1" max="30" value={String(taxRate)} onChange={(v) => setTaxRate(Number(v))} hint="Saat ini 11%" />
                  </div>
                  <AffixInput id="payout-fee" label="Biaya transfer ke bank" prefix="Rp" step="500" value={payoutFee} onChange={setPayoutFee} hint="Dipotong setiap kali pencairan" />

                  {/* Simulasi */}
                  <div className="space-y-1.5 rounded-2xl border bg-muted/30 p-3.5 text-sm">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <Info className="size-3.5" /> Contoh: pelanggan bayar {rupiah(SAMPLE)}
                    </p>
                    <SimRow label={`MDR ${qrisMdr || 0}%`} value={-sampleMdr} />
                    <SimRow label={`PPN ${taxRate || 0}% dari MDR`} value={-sampleTax} />
                    <div className="flex justify-between border-t pt-1.5 font-bold">
                      <span>Masuk ke saldo</span>
                      <span className="text-primary tabular-nums">{rupiah(sampleNet)}</span>
                    </div>
                  </div>

                  <Button type="submit" disabled={savingSettings} className="h-11 w-full gap-2 rounded-xl font-bold">
                    {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Simpan Pengaturan
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
          </div>
        </TabsContent>
      </Tabs>

      <WithdrawalDrawer
        open={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        summary={summary}
        onSuccess={() => {
          void fetchData(false)
        }}
      />
    </div>
  )
}

/* ───────────────────────── Komponen kecil ───────────────────────── */

const WD_STATUS: Record<Withdrawal['status'], { label: string; icon: ReactNode; cls: string; text: string }> = {
  COMPLETED: { label: 'Berhasil', icon: <CheckCircle2 className="size-5" />, cls: 'bg-emerald-500/10 text-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
  PROCESSING: { label: 'Diproses', icon: <Clock className="size-5" />, cls: 'bg-amber-500/10 text-amber-600', text: 'text-amber-600 dark:text-amber-400' },
  PENDING: { label: 'Menunggu', icon: <Clock className="size-5" />, cls: 'bg-sky-500/10 text-sky-600', text: 'text-sky-600 dark:text-sky-400' },
  FAILED: { label: 'Gagal', icon: <XCircle className="size-5" />, cls: 'bg-destructive/10 text-destructive', text: 'text-destructive' },
  REJECTED: { label: 'Ditolak', icon: <XCircle className="size-5" />, cls: 'bg-destructive/10 text-destructive', text: 'text-destructive' },
}

function WalletTile({
  icon,
  tone,
  title,
  amount,
  badge,
  action,
}: {
  icon: ReactNode
  tone: 'amber' | 'primary'
  title: string
  amount: number
  badge?: ReactNode
  action: ReactNode
}) {
  const iconCls = tone === 'amber' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'
  return (
    <div className="flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className={`grid size-9 place-items-center rounded-xl ${iconCls}`}>{icon}</span>
          <span className="text-sm font-semibold">{title}</span>
        </span>
        {badge}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xl font-black tabular-nums sm:text-3xl">{rupiah(amount || 0)}</p>
        {action}
      </div>
    </div>
  )
}

function FlowRow({ label, hint, value, subtotal, total }: { label: string; hint?: string; value: number; subtotal?: boolean; total?: boolean }) {
  const neg = value < 0
  const emphasis = subtotal || total
  return (
    <div
      className={`flex items-center justify-between gap-3 px-1 py-2 ${emphasis ? 'border-t font-bold' : 'text-muted-foreground'} ${total ? 'text-base' : ''}`}
    >
      <dt className={emphasis ? 'text-foreground' : ''}>
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({hint})</span>}
      </dt>
      <dd className={`tabular-nums ${neg ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'} ${emphasis ? 'font-black' : 'font-semibold'}`}>
        {neg && !emphasis ? `− ${rupiah(-value)}` : rupiah(value)}
      </dd>
    </div>
  )
}

function QrisStep({ n, label, hint, value, negative }: { n: number; label: string; hint?: string; value: string; negative?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground" title={hint}>{hint}</p>}
      </div>
      <span className={`text-sm font-bold tabular-nums ${negative ? 'text-rose-600 dark:text-rose-400' : ''}`}>{value}</span>
    </li>
  )
}

function ChoiceCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all ${
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
      }`}
    >
      {icon}
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs opacity-80">{desc}</span>
    </button>
  )
}

function AffixInput({
  id,
  label,
  prefix,
  suffix,
  step,
  max,
  value,
  onChange,
  hint,
}: {
  id: string
  label: string
  prefix?: string
  suffix?: string
  step: string
  max?: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 rounded-xl font-semibold ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-9' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SimRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-rose-600 dark:text-rose-400">− {rupiah(-value)}</span>
    </div>
  )
}
