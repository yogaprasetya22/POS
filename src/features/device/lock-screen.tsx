import { ArrowLeft, Delete, Lock, MonitorSmartphone } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Button } from '@shared/components/ui/button'
import { deviceLogin, fetchDeviceStaff, getDevice, type DeviceStaff, type LoginFail } from '@shared/lib/device-binding'
import { ROLE_LABEL } from '@shared/types/contracts'

const failText = (f: LoginFail, secs: number) => {
  switch (f.reason) {
    case 'WRONG': return `PIN salah. Sisa ${f.left ?? '?'} percobaan sebelum dikunci 30 detik.`
    case 'LOCKED': return `Terlalu banyak salah. Coba lagi dalam ${secs} detik.`
    case 'DEVICE_LOCKED': return `Perangkat dikunci sementara karena banyak PIN salah. Coba lagi dalam ${secs} detik.`
    case 'NO_PIN': return 'Akun ini belum punya PIN. Minta manager mengatur PIN di menu Tim.'
    case 'TOO_MANY': return 'Terlalu banyak percobaan. Tunggu sebentar.'
    case 'UNBOUND': return 'Perangkat ini sudah diputus. Minta manager mengaktifkan ulang.'
    default: return f.message ?? 'Gagal masuk. Periksa internet lalu coba lagi.'
  }
}

/** Layar awal perangkat kasir terikat: pilih nama -> PIN -> langsung ke kasir. */
export function LockScreen() {
  const navigate = useNavigate()
  const [data, setData] = useState<{ staff: DeviceStaff[]; storeName: string; deviceName: string } | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [who, setWho] = useState<DeviceStaff | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState<LoginFail | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [unbound, setUnbound] = useState(!getDevice())

  useEffect(() => {
    void fetchDeviceStaff().then((r) => {
      if (r === 'UNBOUND') setUnbound(true)
      else if ('error' in r) setLoadErr(r.error)
      else setData(r)
    })
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const secs = fail?.until ? Math.max(0, Math.ceil((new Date(fail.until).getTime() - now) / 1000)) : 0
  const waiting = (fail?.reason === 'LOCKED' || fail?.reason === 'DEVICE_LOCKED') && secs > 0

  // Unduh kode halaman kasir/dapur selagi PIN diketik, supaya setelah PIN benar halaman langsung tampil.
  useEffect(() => {
    if (!who) return
    void (who.role === 'kitchen' ? import('@features/kitchen-kds') : import('@features/cashier-pos')).catch(() => {})
  }, [who])

  const submit = useCallback(async (value: string) => {
    if (!who || value.length < 4 || busy) return
    setBusy(true)
    const r = await deviceLogin(who.user_id, value)
    setBusy(false)
    if (!r) return navigate(who.role === 'kitchen' ? '/kitchen' : '/cashier', { replace: true })
    if (r.reason === 'UNBOUND') return setUnbound(true)
    setFail(r)
    setPin('')
  }, [who, busy, navigate])

  const press = (k: string) => {
    if (busy || waiting) return
    if (k === 'del') return setPin((p) => p.slice(0, -1))
    setFail((f) => (f?.reason === 'WRONG' ? null : f))
    setPin((p) => (p.length >= 6 ? p : p + k))
  }

  // keyboard fisik
  useEffect(() => {
    if (!who) return
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') void submit(pin)
      else if (e.key === 'Escape') { setWho(null); setPin(''); setFail(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (unbound) return <Navigate to="/perangkat" replace />

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Lock className="size-7" /></span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{data?.storeName ?? 'Memuat…'}</h1>
          <p className="text-sm text-muted-foreground">{data ? `Perangkat: ${data.deviceName}` : ' '}</p>
        </div>

        {loadErr && <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{loadErr}</p>}

        {!who ? (
          <section className="space-y-3 rounded-3xl border-2 bg-card p-5 shadow-sm">
            <p className="text-center font-bold">Siapa yang bertugas?</p>
            {data && data.staff.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Belum ada staf yang punya PIN. Manager bisa mengaturnya di Admin → Tim.</p>
            )}
            <ul className="grid grid-cols-2 gap-2.5">
              {(data?.staff ?? []).map((s) => (
                <li key={s.user_id}>
                  <button type="button" onClick={() => { setWho(s); setFail(null) }} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-colors hover:border-primary hover:bg-primary/5">
                    <span className="grid size-12 place-items-center rounded-full bg-accent text-lg font-bold text-accent-foreground">{(s.name[0] ?? '?').toUpperCase()}</span>
                    <span className="w-full truncate text-center font-semibold">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_LABEL[s.role as keyof typeof ROLE_LABEL] ?? s.role}</span>
                  </button>
                </li>
              ))}
              {!data && !loadErr && [1, 2, 3, 4].map((i) => <li key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
            </ul>
          </section>
        ) : (
          <section className="space-y-5 rounded-3xl border-2 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setWho(null); setPin(''); setFail(null) }} className="grid size-10 place-items-center rounded-full hover:bg-muted" aria-label="Pilih orang lain">
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <p className="font-bold">{who.name}</p>
                <p className="text-sm text-muted-foreground">Masukkan PIN (4–6 angka)</p>
              </div>
            </div>

            <div className="flex justify-center gap-3" aria-label={`${pin.length} angka dimasukkan`}>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={`size-4 rounded-full border-2 ${i < pin.length ? 'border-primary bg-primary' : i < 4 ? 'border-foreground/40' : 'border-dashed border-foreground/20'}`} />
              ))}
            </div>

            {fail && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">{failText(fail, secs)}</p>}

            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                <button key={k} type="button" disabled={busy || waiting} onClick={() => press(k)} className="h-16 rounded-2xl bg-muted text-2xl font-bold transition-colors hover:bg-muted/70 active:scale-95 disabled:opacity-40">{k}</button>
              ))}
              <button type="button" disabled={busy || pin.length === 0} onClick={() => press('del')} className="grid h-16 place-items-center rounded-2xl text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Hapus"><Delete className="size-6" /></button>
              <button type="button" disabled={busy || waiting} onClick={() => press('0')} className="h-16 rounded-2xl bg-muted text-2xl font-bold hover:bg-muted/70 active:scale-95 disabled:opacity-40">0</button>
              <Button className="h-16 rounded-2xl text-base font-bold" disabled={busy || waiting || pin.length < 4} onClick={() => void submit(pin)}>
                {busy ? 'Memeriksa PIN…' : 'Masuk'}
              </Button>
            </div>
          </section>
        )}

        <p className="text-center text-sm">
          <Link to="/perangkat" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline">
            <MonitorSmartphone className="size-4" /> Pengaturan perangkat (manager)
          </Link>
          <span className="mx-2 text-muted-foreground">·</span>
          <Link to="/login?email=1" className="text-muted-foreground hover:text-foreground hover:underline">Masuk pakai email</Link>
        </p>
      </div>
    </main>
  )
}
