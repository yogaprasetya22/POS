import { useEffect, useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import { SectionCard } from '@shared/components/page'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Switch } from '@shared/components/ui/switch'
import { rpc } from '@shared/lib/api'
import { supabase } from '@shared/lib/supabase'
import { testMidtransCredentials } from '@shared/lib/midtrans'

export function MidtransSettings({ storeId }: { storeId: string }) {
  const [enabled, setEnabled] = useState(false)
  const [isProduction, setIsProduction] = useState(false)
  const [serverKey, setServerKey] = useState('')
  const [clientKey, setClientKey] = useState('')
  const [showServerKey, setShowServerKey] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [savedMsg, setSavedMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase
      .from('stores')
      .select('midtrans_enabled, midtrans_is_production, midtrans_server_key, midtrans_client_key')
      .eq('id', storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        setLoading(false)
        if (error) {
          setErrorMsg(error.message)
          return
        }
        if (data) {
          setEnabled(Boolean(data.midtrans_enabled))
          setIsProduction(Boolean(data.midtrans_is_production))
          setServerKey(data.midtrans_server_key || '')
          setClientKey(data.midtrans_client_key || '')
        }
      })
    return () => {
      alive = false
    }
  }, [storeId])

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    setErrorMsg('')
    try {
      const res = await testMidtransCredentials(serverKey, isProduction)
      if (res.success) {
        setTestResult({
          ok: true,
          msg: res.message || 'Koneksi ke Midtrans berhasil! Kunci API valid.',
        })
      } else {
        setTestResult({
          ok: false,
          msg: res.error || 'Gagal terhubung ke Midtrans. Periksa Server Key dan mode environment.',
        })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setErrorMsg('')
    setSavedMsg('')
    try {
      const { error } = await rpc('save_store_midtrans_settings', {
        p_enabled: enabled,
        p_is_production: isProduction,
        p_server_key: serverKey.trim(),
        p_client_key: clientKey.trim(),
      })
      if (error) throw error
      setSavedMsg('Pengaturan Midtrans berhasil disimpan')
      setTimeout(() => setSavedMsg(''), 4000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/midtrans?action=webhook`

  return (
    <div className="space-y-6">
      <SectionCard
        title="Payment Gateway Midtrans"
        hint="Terima pembayaran digital instan: QRIS dinamis (GoPay, ShopeePay, BCA), Virtual Account, dan Kartu Debit/Kredit."
        className="[&>div]:divide-y [&>div]:p-0"
      >
        {/* Toggle Aktif */}
        <div className="grid gap-x-8 gap-y-2 px-4 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div>
            <label htmlFor="midtrans-enabled" className="text-sm font-medium">Aktifkan Midtrans</label>
            <p className="mt-0.5 text-xs text-muted-foreground">Aktifkan pembayaran online otomatis untuk pesanan kasir dan menu QR pelanggan.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="midtrans-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <span className="text-sm font-semibold">{enabled ? 'Aktif' : 'Nonaktif'}</span>
          </div>
        </div>

        {/* Mode Lingkungan */}
        <div className="grid gap-x-8 gap-y-2 px-4 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div>
            <label htmlFor="midtrans-mode" className="text-sm font-medium">Mode Environment</label>
            <p className="mt-0.5 text-xs text-muted-foreground">Pilih Sandbox untuk simulasi tanpa uang asli, atau Production untuk toko aktif.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="midtrans-mode"
              checked={isProduction}
              onCheckedChange={setIsProduction}
            />
            <span className={`text-sm font-semibold ${isProduction ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {isProduction ? 'Production (Live)' : 'Sandbox (Uji Coba)'}
            </span>
          </div>
        </div>

        {/* Server Key Dinamis */}
        <div className="grid gap-x-8 gap-y-2 px-4 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div>
            <label htmlFor="midtrans-server-key" className="text-sm font-medium">Midtrans Server Key</label>
            <p className="mt-0.5 text-xs text-muted-foreground">Kunci rahasia dari Midtrans Dashboard &gt; Settings &gt; Access Keys. Rahasia server.</p>
          </div>
          <div className="space-y-1.5 md:max-w-md">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="midtrans-server-key"
                type={showServerKey ? 'text' : 'password'}
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                placeholder="SB-Mid-server-..."
                className="h-11 pl-9 pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowServerKey(!showServerKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showServerKey ? 'Sembunyikan server key' : 'Tampilkan server key'}
              >
                {showServerKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kosongkan jika ingin memakai kunci default dari server (environment).
            </p>
          </div>
        </div>

        {/* Client Key Dinamis */}
        <div className="grid gap-x-8 gap-y-2 px-4 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div>
            <label htmlFor="midtrans-client-key" className="text-sm font-medium">Midtrans Client Key</label>
            <p className="mt-0.5 text-xs text-muted-foreground">Kunci publik untuk memuat antarmuka Midtrans Snap di browser pembeli &amp; kasir.</p>
          </div>
          <div className="space-y-1.5 md:max-w-md">
            <Input
              id="midtrans-client-key"
              type="text"
              value={clientKey}
              onChange={(e) => setClientKey(e.target.value)}
              placeholder="SB-Mid-client-..."
              className="h-11 font-mono text-xs"
            />
          </div>
        </div>

        {/* Tombol Uji & Simpan */}
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={testing || saving}
              onClick={handleTestConnection}
              className="h-10 text-xs font-semibold"
            >
              {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Tes Koneksi Midtrans
            </Button>

            <Button
              type="button"
              disabled={saving || testing}
              onClick={handleSave}
              className="h-10 text-xs font-semibold"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
              Simpan Pengaturan Midtrans
            </Button>
          </div>

          {/* Alert Hasil Tes */}
          {testResult && (
            <div
              className={`mt-4 rounded-xl border p-3.5 text-xs ${
                testResult.ok
                  ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.ok ? (
                  <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <KeyRound className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{testResult.msg}</span>
              </div>
            </div>
          )}

          {/* Feedback Simpan */}
          {savedMsg && (
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" /> {savedMsg}
            </p>
          )}

          {errorMsg && (
            <p className="mt-3 text-xs font-medium text-destructive">
              {errorMsg}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Info Webhook Midtrans */}
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 text-xs text-muted-foreground space-y-2">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Konfigurasi Webhook / Notifikasi HTTP Midtrans (Opsional)
        </h4>
        <p>
          Untuk verifikasi otomatis saat pembayaran selesai, masukkan URL notifikasi berikut di Midtrans Dashboard (<strong>Settings &gt; Configuration &gt; Payment Notification URL</strong>):
        </p>
        <code className="block rounded-lg border bg-muted/60 p-2.5 font-mono text-foreground break-all">
          {webhookUrl}
        </code>
      </div>
    </div>
  )
}
