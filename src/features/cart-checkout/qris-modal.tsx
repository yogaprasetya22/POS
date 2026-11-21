import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, CheckCircle2, Clock, Copy, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { rupiah } from '@shared/lib/utils'
import { checkMidtransStatus } from '@shared/lib/midtrans'

type Props = {
  orderId: string
  queueCode: string
  total: number
  qrString: string
  qrUrl?: string
  storeId?: string
  closeLabel?: string
  onManualConfirm?: () => void
  onSuccess: () => void
  onClose: () => void
}

export function QrisModal({
  orderId,
  queueCode,
  total,
  qrString,
  qrUrl,
  storeId,
  closeLabel = 'Bayar di kasir saja',
  onManualConfirm,
  onSuccess,
  onClose,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>(qrUrl || '')
  const [checking, setChecking] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(900) // 15 menit
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Generate QR Code data URL dari EMVCo qr_string
  useEffect(() => {
    if (qrString) {
      QRCode.toDataURL(qrString, {
        width: 300,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {
          if (qrUrl) setQrDataUrl(qrUrl)
        })
    } else if (qrUrl) {
      setQrDataUrl(qrUrl)
    }
  }, [qrString, qrUrl])

  // Countdown timer 15 menit
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Auto-polling status transaksi Midtrans setiap 3 detik
  useEffect(() => {
    let active = true

    const check = async () => {
      if (!active || isPaid) return
      try {
        const res = await checkMidtransStatus(orderId, storeId)
        if (!active) return
        if (res.success && res.paid) {
          setIsPaid(true)
          if (pollRef.current) clearInterval(pollRef.current)
          setTimeout(() => {
            onSuccess()
          }, 1500)
        }
      } catch {
        // abaikan error network berkala
      }
    }

    pollRef.current = setInterval(check, 3000)

    return () => {
      active = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [orderId, storeId, isPaid, onSuccess])

  const handleManualCheck = async () => {
    setChecking(true)
    try {
      const res = await checkMidtransStatus(orderId, storeId)
      if (res.success && res.paid) {
        setIsPaid(true)
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } finally {
      setChecking(false)
    }
  }

  const handleDownloadQr = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `QRIS-${queueCode}-${total}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCopyQrUrl = async () => {
    const textToCopy = qrUrl || qrString || ''
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2500)
    } catch {
      const input = document.createElement('textarea')
      input.value = textToCopy
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2500)
    }
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header QRIS Nasional */}
        <div className="border-b border-border/80 bg-muted/40 px-5 py-4 text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="size-5" />
          </button>

          <div className="flex items-center justify-center gap-2">
            <span className="font-extrabold tracking-wider text-primary text-base font-mono">QRIS</span>
            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
              GPN
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground font-medium">
            Standar Pembayaran Nasional Indonesia
          </p>
        </div>

        {/* Konten QR & Nominal */}
        <div className="p-5 text-center">
          {isPaid ? (
            <div className="py-10 space-y-3">
              <CheckCircle2 className="mx-auto size-16 text-emerald-500 animate-bounce" />
              <h3 className="text-xl font-extrabold text-foreground">Pembayaran Berhasil!</h3>
              <p className="text-xs text-muted-foreground">
                Pesanan <span className="font-mono font-bold text-foreground">{queueCode}</span> lunas dan langsung masuk ke layar dapur.
              </p>
            </div>
          ) : (
            <>
              {/* Nominal Otomatis */}
              <div className="mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  <Sparkles className="size-3.5" /> Nominal Otomatis Terisi
                </span>
                <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-foreground">
                  {rupiah(total)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Nomor antrean: <strong className="font-mono text-foreground">{queueCode}</strong>
                </p>
              </div>

              {/* Bingkai Kode QR */}
              <div className="relative mx-auto flex size-64 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-white p-3 shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QRIS Pesanan ${queueCode}`}
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <span className="text-xs">Membuat QRIS Dinamis…</span>
                  </div>
                )}
              </div>

              {/* Countdown & Dukungan Bank */}
              <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Clock className="size-3.5 text-amber-500" />
                  Sisa waktu: <strong className="text-foreground">{timeFormatted}</strong>
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> Terverifikasi
                </span>
              </div>

              {/* Logo Aplikasi yang Didukung */}
              <p className="mt-2.5 text-[10px] text-muted-foreground leading-relaxed">
                Scan via <strong>GoPay, OVO, Dana, ShopeePay, BCA, Livin Mandiri, BRImo, BNI</strong>, atau mobile banking apapun.
              </p>

              {/* Tombol Aksi */}
              <div className="mt-5 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadQr}
                    className="h-10 text-xs font-semibold"
                  >
                    <Download className="mr-1.5 size-3.5" /> Simpan QR
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={checking}
                    onClick={handleManualCheck}
                    className="h-10 text-xs font-semibold"
                  >
                    {checking ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="mr-1.5 size-3.5" /> Cek Status
                      </>
                    )}
                  </Button>
                </div>

                {/* Tombol Salin URL QR Simulator */}
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyQrUrl}
                    className="h-8.5 text-[11px] font-semibold border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="mr-1 size-3 text-emerald-600" /> Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 size-3" /> Salin URL QR
                      </>
                    )}
                  </Button>

                  <a
                    href="https://simulator.sandbox.midtrans.com/qris/index"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8.5 items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-background/80 px-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-500/10 transition"
                  >
                    Simulator <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              {onManualConfirm && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onManualConfirm}
                  className="mt-2.5 h-9 w-full text-xs font-medium text-emerald-800 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mr-1.5 size-3.5 text-emerald-600" /> Konfirmasi Lunas Manual
                </Button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {closeLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

