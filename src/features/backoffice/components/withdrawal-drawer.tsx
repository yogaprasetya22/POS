import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  Building,
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@shared/components/ui/drawer'
import { Tabs, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'
import type { FinancialSummary, Withdrawal } from '@shared/types/contracts'

export const POPULAR_BANKS = [
  { code: 'BCA', name: 'Bank Central Asia (BCA)' },
  { code: 'MANDIRI', name: 'Bank Mandiri' },
  { code: 'BRI', name: 'Bank Rakyat Indonesia (BRI)' },
  { code: 'BNI', name: 'Bank Negara Indonesia (BNI)' },
  { code: 'BSI', name: 'Bank Syariah Indonesia (BSI)' },
  { code: 'CIMB', name: 'CIMB Niaga' },
  { code: 'PERMATA', name: 'Bank Permata' },
  { code: 'DANAMON', name: 'Bank Danamon' },
  { code: 'JAGO', name: 'Bank Jago' },
  { code: 'SEABANK', name: 'SeaBank Indonesia' },
  { code: 'OTHER', name: 'Bank Lainnya' },
]

export function WithdrawalDrawer({
  open,
  onClose,
  summary,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  summary: FinancialSummary | null
  onSuccess?: () => void
}) {
  const [tab, setTab] = useState<'withdraw' | 'history'>('withdraw')
  const [amountStr, setAmountStr] = useState('')
  const [bankName, setBankName] = useState(summary?.bank_name || 'BCA')
  const [customBank, setCustomBank] = useState('')
  const [accountNumber, setAccountNumber] = useState(summary?.account_number || '')
  const [accountHolder, setAccountHolder] = useState(summary?.account_holder || '')
  const [note, setNote] = useState('')
  const [saveBank, setSaveBank] = useState(true)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [successReceipt, setSuccessReceipt] = useState<{
    referenceNo: string
    amount: number
    bankName: string
    accountNumber: string
    accountHolder: string
    remainingBalance: number
  } | null>(null)

  const availableBalance = summary?.midtrans_available_balance ?? 0

  useEffect(() => {
    if (summary) {
      if (summary.bank_name) setBankName(summary.bank_name)
      if (summary.account_number) setAccountNumber(summary.account_number)
      if (summary.account_holder) setAccountHolder(summary.account_holder)
    }
  }, [summary])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const { data, error } = await rpc('get_withdrawals', { p_limit: 30 })
      if (!error && Array.isArray(data)) {
        setWithdrawals(data as Withdrawal[])
      }
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (open && tab === 'history') {
      void loadHistory()
    }
  }, [open, tab])

  const handleQuickAmount = (val: number) => {
    setAmountStr(String(val))
  }

  const handlePercentage = (pct: number) => {
    const val = Math.floor((availableBalance * pct) / 100)
    setAmountStr(String(Math.max(0, val)))
  }

  const targetBank = bankName === 'OTHER' ? customBank : bankName
  const parsedAmount = parseInt(amountStr.replace(/[^0-9]/g, '') || '0', 10)
  const isAmountValid = parsedAmount >= 10000 && parsedAmount <= availableBalance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAmountValid) {
      if (parsedAmount < 10000) {
        toast.error('Minimal penarikan adalah Rp10.000')
      } else {
        toast.error('Jumlah penarikan melebihi saldo Midtrans tersedia')
      }
      return
    }
    if (!targetBank.trim()) {
      toast.error('Nama bank tujuan wajib diisi')
      return
    }
    if (!accountNumber.trim()) {
      toast.error('Nomor rekening tujuan wajib diisi')
      return
    }
    if (!accountHolder.trim()) {
      toast.error('Nama pemilik rekening wajib diisi')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await rpc('request_withdrawal', {
        p_amount: parsedAmount,
        p_bank_name: targetBank.trim(),
        p_account_number: accountNumber.trim(),
        p_account_holder: accountHolder.trim(),
        p_note: note.trim(),
        p_save_bank: saveBank,
      })

      if (error) {
        toast.error('Penarikan dana gagal', { description: error.message })
        return
      }

      const res = data as {
        reference_no: string
        amount: number
        bank_name: string
        account_number: string
        account_holder: string
        remaining_balance: number
      }

      setSuccessReceipt({
        referenceNo: res.reference_no,
        amount: res.amount,
        bankName: res.bank_name,
        accountNumber: res.account_number,
        accountHolder: res.account_holder,
        remainingBalance: res.remaining_balance,
      })

      toast.success('Penarikan dana berhasil diproses!', {
        description: `Nomor referensi: ${res.reference_no}`,
      })

      onSuccess?.()
    } catch (err) {
      toast.error('Terjadi kendala saat memproses penarikan', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyRef = (ref: string) => {
    void navigator.clipboard.writeText(ref)
    toast.success('Nomor referensi berhasil disalin')
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} swipeDirection="right">
      <DrawerContent size="md" className="flex flex-col h-full rounded-l-3xl border-l">
        <DrawerHeader className="px-6 pt-6 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Landmark className="size-5" />
              </span>
              <div>
                <DrawerTitle className="text-xl font-extrabold tracking-tight">
                  Tarik Saldo Midtrans
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground">
                  Pencairan dana penjualan digital (QRIS) ke rekening bank toko
                </DrawerDescription>
              </div>
            </div>
            <DrawerClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="Tutup drawer"
                >
                  <X className="size-4" />
                </Button>
              }
            />
          </div>

          {/* Kartu Status Saldo Tersedia */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border bg-card p-3 shadow-xs">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Wallet className="size-3 text-emerald-600" /> Saldo Siap Ditarik
              </p>
              <p className="text-xl font-black tabular-nums text-foreground mt-0.5">
                {rupiah(availableBalance)}
              </p>
            </div>
            <div className="border-l pl-3">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="size-3 text-primary" /> Total Dicairkan
              </p>
              <p className="text-lg font-bold tabular-nums text-muted-foreground mt-0.5">
                {rupiah(summary?.midtrans_total_withdrawn ?? 0)}
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'withdraw' | 'history')} className="mt-3">
            <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="withdraw" className="text-xs font-bold rounded-lg gap-1.5">
                <ArrowDownToLine className="size-3.5" /> Formulir Tarik Dana
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-bold rounded-lg gap-1.5">
                <History className="size-3.5" /> Riwayat Penarikan
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DrawerHeader>

        <div className="p-6 flex-1 overflow-y-auto">
          {tab === 'withdraw' && !successReceipt && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Jumlah Penarikan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wd-amount" className="text-xs font-bold">
                    Jumlah Penarikan (Rp) <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Min. Rp10.000
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="wd-amount"
                    type="text"
                    inputMode="numeric"
                    value={amountStr ? Number(amountStr).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '')
                      setAmountStr(clean)
                    }}
                    placeholder="0"
                    className="h-12 pl-10 text-lg font-extrabold tabular-nums rounded-xl"
                    required
                  />
                </div>

                {/* Tombol Pintas Nominal */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePercentage(50)}
                    disabled={availableBalance < 20000}
                    className="h-7 px-2.5 text-[11px] font-semibold rounded-lg"
                  >
                    50%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePercentage(100)}
                    disabled={availableBalance < 10000}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg text-primary border-primary/30 hover:bg-primary/5"
                  >
                    Tarik Semua (100%)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickAmount(50000)}
                    disabled={availableBalance < 50000}
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                  >
                    50rb
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickAmount(100000)}
                    disabled={availableBalance < 10000}
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                  >
                    100rb
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickAmount(500000)}
                    disabled={availableBalance < 500000}
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                  >
                    500rb
                  </Button>
                </div>
              </div>

              {/* Pilihan Bank */}
              <div className="space-y-1.5">
                <Label htmlFor="wd-bank" className="text-xs font-bold">
                  Bank Tujuan <span className="text-destructive">*</span>
                </Label>
                <select
                  id="wd-bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>

                {bankName === 'OTHER' && (
                  <Input
                    type="text"
                    placeholder="Ketik nama bank (mis. Bank Sumut / Bank BJB)"
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    className="h-10 text-xs rounded-xl mt-1.5"
                    required
                  />
                )}
              </div>

              {/* Nomor Rekening */}
              <div className="space-y-1.5">
                <Label htmlFor="wd-acc-num" className="text-xs font-bold">
                  Nomor Rekening Bank <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wd-acc-num"
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 1234567890"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-11 font-mono text-base font-bold rounded-xl"
                  required
                />
              </div>

              {/* Nama Pemilik Rekening */}
              <div className="space-y-1.5">
                <Label htmlFor="wd-acc-name" className="text-xs font-bold">
                  Nama Pemilik Rekening (Sesuai Buku Tabungan) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wd-acc-name"
                  type="text"
                  placeholder="Contoh: YOGA PRASETYA"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                  className="h-11 font-bold rounded-xl"
                  required
                />
              </div>

              {/* Catatan / Keterangan */}
              <div className="space-y-1.5">
                <Label htmlFor="wd-note" className="text-xs font-semibold text-muted-foreground">
                  Catatan (Opsional)
                </Label>
                <Input
                  id="wd-note"
                  type="text"
                  placeholder="Contoh: Penarikan hasil omzet minggu ini"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              {/* Ringkasan Penarikan Standar Industri */}
              <div className="rounded-2xl border bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Nominal Penarikan</span>
                  <span className="font-bold tabular-nums text-foreground">{rupiah(parsedAmount || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Biaya Transfer Antar Bank</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Gratis (Rp0)</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between font-extrabold text-sm text-foreground">
                  <span>Dana Bersih Diterima</span>
                  <span className="text-base text-primary tabular-nums">{rupiah(parsedAmount || 0)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveBank}
                    onChange={(e) => setSaveBank(e.target.checked)}
                    className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Ingat rekening ini untuk penarikan berikutnya
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <Button type="button" variant="outline" onClick={onClose} className="h-11 px-4 text-sm font-semibold rounded-xl">
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !isAmountValid || !accountNumber || !accountHolder}
                  className="h-11 px-6 text-sm font-extrabold rounded-xl bg-primary text-primary-foreground gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Memproses…
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="size-4" />
                      Tarik {parsedAmount ? rupiah(parsedAmount) : 'Dana'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Layar Sukses Penarikan Dana */}
          {tab === 'withdraw' && successReceipt && (
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <span className="grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="size-9" />
              </span>

              <div>
                <h3 className="text-xl font-extrabold">Penarikan Dana Berhasil Diproses!</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dana telah dicatat dan dalam proses pencairan ke rekening tujuan.
                </p>
              </div>

              <div className="w-full max-w-md rounded-2xl border bg-muted/20 p-4 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nomor Referensi</span>
                  <button
                    type="button"
                    onClick={() => handleCopyRef(successReceipt.referenceNo)}
                    className="font-mono font-bold text-foreground flex items-center gap-1 hover:text-primary"
                  >
                    {successReceipt.referenceNo} <Copy className="size-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Jumlah Penarikan</span>
                  <span className="font-bold text-sm text-foreground tabular-nums">
                    {rupiah(successReceipt.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bank Tujuan</span>
                  <span className="font-semibold text-foreground">{successReceipt.bankName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nomor Rekening</span>
                  <span className="font-mono font-bold text-foreground">{successReceipt.accountNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nama Penerima</span>
                  <span className="font-bold text-foreground">{successReceipt.accountHolder}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Sisa Saldo Midtrans</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {rupiah(successReceipt.remainingBalance)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSuccessReceipt(null)
                    setAmountStr('')
                    setTab('history')
                  }}
                  className="h-10 text-xs font-semibold rounded-xl"
                >
                  Lihat Riwayat
                </Button>
                <Button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-5 text-xs font-bold rounded-xl bg-primary text-primary-foreground"
                >
                  Selesai
                </Button>
              </div>
            </div>
          )}

          {/* Tab Riwayat Penarikan */}
          {tab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">
                  Riwayat Pencairan Dana
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="h-7 px-2 text-[11px] text-muted-foreground"
                >
                  <RefreshCw className={`size-3 mr-1 ${historyLoading ? 'animate-spin' : ''}`} /> Muat Ulang
                </Button>
              </div>

              {historyLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                  Memuat riwayat penarikan…
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed p-8 text-center space-y-1 text-muted-foreground">
                  <Landmark className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                  <p className="text-sm font-bold text-foreground">Belum ada riwayat penarikan</p>
                  <p className="text-xs">
                    Penarikan saldo yang berhasil diproses akan tercatat otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-2xl border bg-card p-3.5 space-y-2 text-xs shadow-xs transition hover:border-primary/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-foreground flex items-center gap-1.5">
                          <Building className="size-3.5 text-primary" />
                          {w.reference_no}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            w.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : w.status === 'PROCESSING' || w.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {w.status === 'COMPLETED' ? 'Selesai' : w.status === 'PROCESSING' ? 'Diproses' : w.status}
                        </span>
                      </div>

                      <div className="flex items-end justify-between border-t pt-2">
                        <div>
                          <p className="font-bold text-foreground text-sm">
                            {w.bank_name} · <span className="font-mono">{w.account_number}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">a.n. {w.account_holder}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(w.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })} WIB
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            +{rupiah(w.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Bebas biaya</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tautan ke Portal Midtrans */}
              <div className="pt-2 border-t text-center">
                <a
                  href="https://dashboard.midtrans.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  Buka Portal Merchant Midtrans <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export const WithdrawalModal = WithdrawalDrawer

