import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AlertCircle, Check, CheckCircle2, Clock, Copy, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { rupiah } from '@shared/lib/utils'
import { checkMidtransStatus, loadMidtransSnap } from '@shared/lib/midtrans'

export function InlineQris({
  orderId,
  queueCode,
  total,
  qrString,
  qrUrl,
  snapToken,
  clientKey,
  isProduction,
  isFallback,
  notice,
  storeId,
  initialSeconds = 300,
  onSuccess,
  onBack,
}: {
  orderId: string
  queueCode: string
  total: number
  qrString?: string
  qrUrl?: string
  snapToken?: string
  clientKey?: string
  isProduction?: boolean
  isFallback?: boolean
  notice?: string
  storeId?: string
  initialSeconds?: number
  onSuccess: () => void
  onBack: () => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>(qrUrl || '')
  const [checking, setChecking] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds) // default 5 menit (300 detik)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Inisialisasi Snap Embed untuk mode Production QRIS resmi Midtrans
  useEffect(() => {
    if (!snapToken || !clientKey) return
    let active = true

    loadMidtransSnap(clientKey, isProduction ?? true).then((loaded) => {
      if (!active || !loaded) return
      setSnapLoaded(true)
      try {
        if (window.snap?.embed) {
          window.snap.embed(snapToken, {
            embedId: 'snap-qris-embed-container',
            onSuccess: () => {
              setIsPaid(true)
              setTimeout(() => onSuccess(), 1200)
            },
            onPending: () => {
              // menunggu pembayaran
            },
            onError: (err: unknown) => {
              console.error('Snap error:', err)
            },
            onClose: () => {
              onBack()
            },
          })
        }
      } catch (err) {
        console.error('Error embedding snap:', err)
      }
    })

    return () => {
      active = false
    }
  }, [snapToken, clientKey, isProduction, onSuccess, onBack])

  // Generate QR Code data URL dari EMVCo qr_string
  useEffect(() => {
    if (qrString) {
      QRCode.toDataURL(qrString, {
        width: 280,
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
          }, 1200)
        }
      } catch {
        // abaikan error koneksi sesaat
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
        }, 1200)
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

  const handleCopyQrString = async () => {
    if (!qrString) return
    try {
      await navigator.clipboard.writeText(qrString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
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

  if (secondsLeft <= 0) {
    return (
      <div className="py-10 text-center space-y-4">
        <Clock className="mx-auto size-16 text-destructive/80" />
        <h3 className="text-xl font-extrabold text-foreground">Batas Waktu Pembayaran Habis</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Batas waktu pembayaran 5 menit untuk pesanan <span className="font-mono font-bold text-foreground">{queueCode}</span> telah berakhir.
        </p>
        <Button onClick={onBack} variant="outline" className="mt-2 text-xs font-semibold">
          Kembali ke Menu
        </Button>
      </div>
    )
  }

  if (isPaid) {
    return (
      <div className="py-12 text-center space-y-4">
        <CheckCircle2 className="mx-auto size-16 text-emerald-500 animate-bounce" />
        <h3 className="text-xl font-extrabold text-foreground">Pembayaran Berhasil!</h3>
        <p className="text-sm text-muted-foreground">
          Pesanan <span className="font-mono font-bold text-foreground">{queueCode}</span> lunas via QRIS Dinamis dan langsung diproses dapur.
        </p>
      </div>
    )
  }

  // Jika menggunakan Midtrans Snap Token (Production QRIS GoPay Resmi)
  if (snapToken) {
    return (
      <div className="flex flex-col items-center text-center space-y-3 pb-4">
        <div className="relative w-full overflow-hidden rounded-2xl border bg-white shadow-xs min-h-[520px]">
          {!snapLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 p-4 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Memuat QRIS GoPay Resmi…</p>
            </div>
          )}
          <div id="snap-qris-embed-container" className="w-full min-h-[520px]" />
        </div>

        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline pt-1"
        >
          ← Kembali ke menu / ubah pesanan
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center text-center space-y-4">
      {/* Header QRIS GPN Nasional */}
      <div className="flex items-center gap-2">
        <span className="font-extrabold tracking-wider text-primary text-base font-mono">QRIS</span>
        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
          GPN
        </span>
      </div>

      {/* Info Nominal Pas */}
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          <Sparkles className="size-3.5" /> Nominal Otomatis Terisi
        </span>
        <p className="text-3xl font-black tabular-nums tracking-tight text-foreground pt-1">
          {rupiah(total)}
        </p>
        <p className="text-xs text-muted-foreground">
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
            <span className="text-xs">Memuat kode QRIS…</span>
          </div>
        )}
      </div>

      {/* Timer & Verifikasi */}
      <div className="flex w-full max-w-xs items-center justify-between text-xs text-muted-foreground px-2">
        <span className="flex items-center gap-1 font-mono font-medium">
          <Clock className="size-3.5 text-amber-500" />
          Sisa waktu: <strong className="text-foreground">{timeFormatted}</strong>
        </span>
        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <ShieldCheck className="size-3.5" /> Verifikasi Otomatis
        </span>
      </div>

      {/* Panel Simulasi / Uji Coba QRIS (Sandbox Simulator) */}
      {(!isProduction || isFallback || qrUrl) && (
        <div className="w-full max-w-xs rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left space-y-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />
              Simulasi QRIS (Midtrans Sandbox)
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-200/70 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
              Sandbox
            </span>
          </div>

          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
            {notice || 'Salin URL QR di bawah, lalu paste di form Simulator Midtrans untuk simulasi scan bayar (PIN uji coba: 123456):'}
          </p>

          <div className="flex flex-col gap-1.5 pt-0.5">
            <Button
              type="button"
              size="sm"
              onClick={handleCopyQrUrl}
              className={`h-9 w-full text-xs font-bold gap-1.5 transition-all ${
                copiedUrl
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
              }`}
            >
              {copiedUrl ? <Check className="size-3.5 text-white" /> : <Copy className="size-3.5 text-white" />}
              {copiedUrl ? 'URL QR Berhasil Disalin!' : 'Salin URL QR Simulator'}
            </Button>

            <div className="grid grid-cols-2 gap-1.5">
              <a
                href="https://simulator.sandbox.midtrans.com/qris/index"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-background/80 px-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-500/10 transition"
              >
                Buka Simulator <ExternalLink className="size-3" />
              </a>

              {qrString && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyQrString}
                  className="h-8 text-[11px] font-medium border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10"
                >
                  {copied ? <Check className="size-3 mr-1 text-emerald-600" /> : <Copy className="size-3 mr-1" />}
                  {copied ? 'Tersalin' : 'Salin Kode QR'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keterangan e-wallet & bank */}
      <p className="max-w-xs text-[11px] text-muted-foreground leading-relaxed">
        Scan lewat <strong>GoPay, BCA, Livin Mandiri, BRImo, ShopeePay, Dana, OVO</strong>, atau aplikasi mobile banking apa saja.
      </p>

      {/* Aksi Inline */}
      <div className="flex w-full max-w-xs flex-col gap-2 pt-1">
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

        {/* Tombol Salin URL QR Simulator di toolbar utama */}
        {(!isProduction || isFallback || qrUrl) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyQrUrl}
            className="h-9 w-full text-xs font-semibold border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10"
          >
            {copiedUrl ? (
              <>
                <Check className="mr-1.5 size-3.5 text-emerald-600" /> URL QR Berhasil Disalin!
              </>
            ) : (
              <>
                <Copy className="mr-1.5 size-3.5" /> Salin URL QR (Simulator)
              </>
            )}
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline pt-1"
      >
        ← Kembali ke menu / ubah pesanan
      </button>
    </div>
  )
}

