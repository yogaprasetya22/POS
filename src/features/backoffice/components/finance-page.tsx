import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Coins,
  History,
  Landmark,
  LineChart,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
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
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import type { FinancialSummary, Withdrawal } from '@shared/types/contracts'
import { POPULAR_BANKS, WithdrawalModal } from './withdrawal-modal'

export function FinancePageView() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)

  // Edit Bank Form State
  const [bankName, setBankName] = useState('BCA')
  const [customBank, setCustomBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [savingBank, setSavingBank] = useState(false)

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
    midtrans_total_withdrawn: 0,
    midtrans_available_balance: 0,
    bank_name: '',
    account_number: '',
    account_holder: '',
  }

  const isGrossPositive = s.today_gross_profit >= 0
  const isNetPositive = s.today_net_profit >= 0

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-3xl bg-muted/60" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl flex items-center gap-2.5">
            <Coins className="size-8 text-primary" /> Keuangan & Penarikan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Pantau laba kotor, laba bersih, saldo fisik kasir, dan penarikan saldo digital Midtrans.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="h-11 rounded-2xl border-2 px-4 text-base font-bold gap-2"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            Perbarui
          </Button>

          <Button
            onClick={() => setIsWithdrawOpen(true)}
            className="h-11 rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90 gap-2"
          >
            <ArrowDownToLine className="size-5" />
            Tarik Saldo Midtrans
          </Button>
        </div>
      </div>

      {/* 4 Kartu Utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Laba Kotor */}
        <Card className="rounded-3xl border-2 border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.04] to-card shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Laba Kotor Hari Ini</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                  isGrossPositive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'
                }`}
              >
                {isGrossPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {s.gross_margin_percent}%
              </span>
            </div>
            <CardTitle className={`text-2xl font-black ${isGrossPositive ? 'text-foreground' : 'text-destructive'}`}>
              {rupiah(s.today_gross_profit)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Penjualan Bersih:</span>
              <span className="font-semibold text-foreground">{rupiah(s.today_net_sales)}</span>
            </div>
            <div className="flex justify-between">
              <span>HPP Modal Resep:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_cogs)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Laba Bersih */}
        <Card className="rounded-3xl border-2 border-sky-500/25 bg-gradient-to-b from-sky-500/[0.04] to-card shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Laba Bersih Hari Ini</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                  isNetPositive ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-destructive/10 text-destructive'
                }`}
              >
                {isNetPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {s.net_margin_percent}%
              </span>
            </div>
            <CardTitle className={`text-2xl font-black ${isNetPositive ? 'text-foreground' : 'text-destructive'}`}>
              {rupiah(s.today_net_profit)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Bahan Terbuang:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_waste)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kas Keluar Toko:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_expenses)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Laci Kasir */}
        <Card className="rounded-3xl border-2 border-amber-500/25 bg-gradient-to-b from-amber-500/[0.04] to-card shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kas Fisik Laci</span>
              <Badge variant={s.has_active_shift ? 'default' : 'secondary'} className="text-[11px] font-bold">
                {s.has_active_shift ? 'Shift Aktif' : 'Shift Tutup'}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black text-foreground">
              {rupiah(s.cash_drawer_balance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs flex items-center justify-between text-muted-foreground">
            <span>Uang tunai saat ini</span>
            <Link to="/admin/shift" className="font-bold text-amber-600 hover:underline dark:text-amber-400">
              Cek Laci Kasir &rarr;
            </Link>
          </CardContent>
        </Card>

        {/* Saldo Midtrans Siap Tarik */}
        <Card className="rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-primary/[0.05] to-card shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saldo Midtrans (QRIS)</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                Tersedia
              </span>
            </div>
            <CardTitle className="text-2xl font-black text-primary">
              {rupiah(s.midtrans_available_balance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs flex items-center justify-between text-muted-foreground">
            <span>
              Masuk: <strong className="text-foreground">{rupiah(s.midtrans_total_received)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsWithdrawOpen(true)}
              className="font-bold text-primary hover:underline"
            >
              Tarik Saldo &rarr;
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Rincian Rumus & Pengaturan Rekening */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kolom 1 & 2: Bedah Rumus Finansial Standar Industri */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-3xl border-2 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <LineChart className="size-5 text-primary" /> Rincian Laba & Beban Usaha
              </CardTitle>
              <CardDescription>
                Standar akuntansi F&B: Laba kotor (gross profit) dan laba bersih (net profit) real-time hari ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Laba Kotor Box */}
                <div className="rounded-2xl border p-4 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-sm">1. Laba Kotor (Gross Profit)</span>
                    <span className="text-emerald-600 font-extrabold">{rupiah(s.today_gross_profit)}</span>
                  </div>
                  <div className="text-xs space-y-1.5 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Penjualan Kotor (Gross Sales):</span>
                      <span className="font-semibold text-foreground">{rupiah(s.today_gross_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Penjualan Bersih (Net Sales):</span>
                      <span className="font-semibold text-foreground">{rupiah(s.today_net_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Harga Pokok Penjualan (HPP):</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_cogs)}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between font-bold text-foreground">
                      <span>Margin Laba Kotor:</span>
                      <span className="text-emerald-600">{s.gross_margin_percent}%</span>
                    </div>
                  </div>
                </div>

                {/* Laba Bersih Box */}
                <div className="rounded-2xl border p-4 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-sm">2. Laba Bersih (Net Profit)</span>
                    <span className="text-sky-600 font-extrabold">{rupiah(s.today_net_profit)}</span>
                  </div>
                  <div className="text-xs space-y-1.5 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Laba Kotor (Gross Profit):</span>
                      <span className="font-semibold text-foreground">{rupiah(s.today_gross_profit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bahan Baku Terbuang (Waste):</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_waste)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Beban Pengeluaran Kas Toko:</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">− {rupiah(s.today_expenses)}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between font-bold text-foreground">
                      <span>Margin Laba Bersih:</span>
                      <span className="text-sky-600">{s.net_margin_percent}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rincian Arus Kas Midtrans */}
              <div className="rounded-2xl border p-4 bg-primary/[0.03] space-y-3">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-sm flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-primary" /> Rekonsiliasi Saldo Midtrans QRIS
                  </span>
                  <Badge variant="outline" className="font-semibold">
                    Midtrans Iris / Settlement
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-muted-foreground">Total Penjualan QRIS</p>
                    <p className="text-base font-bold text-foreground mt-0.5">{rupiah(s.midtrans_total_received)}</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-muted-foreground">Total Sudah Ditarik</p>
                    <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                      − {rupiah(s.midtrans_total_withdrawn)}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-card p-3 bg-primary/5 border-primary/20">
                    <p className="text-primary font-bold">Saldo Siap Dicairkan</p>
                    <p className="text-base font-black text-primary mt-0.5">{rupiah(s.midtrans_available_balance)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Riwayat Penarikan Dana */}
          <Card className="rounded-3xl border-2 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <History className="size-5 text-primary" /> Riwayat Penarikan Dana
                </CardTitle>
                <CardDescription>
                  Daftar transaksi pencairan dana saldo Midtrans ke rekening tujuan.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchData(true)}
                disabled={refreshing}
                className="gap-1.5 text-xs rounded-xl"
              >
                <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
                Muat Ulang
              </Button>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Landmark className="mx-auto size-9 opacity-40 mb-2" />
                  Belum ada transaksi penarikan saldo.
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-2xl border">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{w.reference_no}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              w.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : w.status === 'PROCESSING'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-destructive/10 text-destructive'
                            }`}
                          >
                            {w.status === 'COMPLETED' ? (
                              <CheckCircle2 className="size-3" />
                            ) : w.status === 'PROCESSING' ? (
                              <Clock className="size-3" />
                            ) : (
                              <XCircle className="size-3" />
                            )}
                            {w.status === 'COMPLETED' ? 'Berhasil' : w.status === 'PROCESSING' ? 'Sedang Diproses' : 'Dibatalkan'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {w.bank_name} • {w.account_number} a.n. {w.account_holder}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(w.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-base font-bold text-foreground tabular-nums">
                          {rupiah(w.amount)}
                        </p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Biaya: Rp0 (Bebas Biaya)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom 3: Pengaturan Rekening Pencairan */}
        <div>
          <Card className="rounded-3xl border-2 shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Landmark className="size-5 text-primary" /> Rekening Bank Toko
              </CardTitle>
              <CardDescription>
                Rekening tujuan resmi untuk pencairan dana penjualan digital.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveBank} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank-select" className="text-xs font-bold">
                    Pilihan Bank
                  </Label>
                  <Select value={bankName} onValueChange={(v) => v && setBankName(v)}>
                    <SelectTrigger id="bank-select" className="h-11 rounded-xl text-sm">
                      <SelectValue placeholder="Pilih Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {POPULAR_BANKS.map((b) => (
                        <SelectItem key={b.code} value={b.code} className="text-sm font-medium">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {bankName === 'OTHER' && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-bank" className="text-xs font-bold">
                      Nama Bank Lainnya
                    </Label>
                    <Input
                      id="custom-bank"
                      value={customBank}
                      onChange={(e) => setCustomBank(e.target.value)}
                      placeholder="Contoh: Bank Mega, BTN, Jenius"
                      className="h-11 rounded-xl text-sm"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="acc-number" className="text-xs font-bold">
                    Nomor Rekening
                  </Label>
                  <Input
                    id="acc-number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 1234567890"
                    className="h-11 rounded-xl font-mono text-sm tracking-wide"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acc-holder" className="text-xs font-bold">
                    Nama Pemilik Rekening (Sesuai Buku Tabungan)
                  </Label>
                  <Input
                    id="acc-holder"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                    placeholder="Contoh: WARUNG KOPI NUSANTARA"
                    className="h-11 rounded-xl text-sm uppercase font-semibold"
                    required
                  />
                </div>

                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
                  <span>
                    Pastikan nama dan nomor rekening sesuai dengan identitas pemilik/badan usaha toko demi keamanan transaksi.
                  </span>
                </div>

                <Button
                  type="submit"
                  disabled={savingBank}
                  className="w-full h-11 rounded-xl text-sm font-bold gap-2"
                >
                  {savingBank ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Simpan Rekening Bank
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Penarikan Dana (Withdrawal Modal) */}
      <WithdrawalModal
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
