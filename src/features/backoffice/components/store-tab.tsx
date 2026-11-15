import { AnimatePresence, m } from 'motion/react'
import { Check, Copy, ExternalLink, KeyRound, MessageCircle, QrCode } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CurrencyInput } from '@shared/components/currency-input'
import { Chip, PageHeader, SectionCard } from '@shared/components/page'
import { Button, buttonVariants } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Switch } from '@shared/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs'
import { rpc } from '@shared/lib/api'
import { useStaff } from '@shared/lib/auth'
import { PermissionSettings, ShiftNamesSettings } from './access-settings'
import { LogoPicker, ThemePicker } from './branding'
import { KitchenSettings } from './kitchen-settings'
import { PrinterCalibration } from './printer-calibration'
import { getPaperChars, previewReceipt, setPaperChars } from '@shared/lib/print'
import { loadLogo } from '@shared/lib/receipt-logo'
import { useStoreConfig } from '@shared/lib/store-config'
import { supabase } from '@shared/lib/supabase'
import { liquid } from '@shared/lib/motion'
import { rupiah } from '@shared/lib/utils'
import { OrderSchema, StoreSettingsSchema, type Store, type StoreConfig } from '@shared/types/contracts'
import { ThermalPaper } from '@shared/components/thermal-preview'

type Props = {
  store: Store
  run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>
  fail: (message: string) => void
}

const ROUNDING = [
  { value: '1', label: 'Tanpa pembulatan' },
  { value: '100', label: 'Ke Rp100 terdekat' },
  { value: '500', label: 'Ke Rp500 terdekat' },
  { value: '1000', label: 'Ke Rp1.000 terdekat' },
]

type Form = {
  name: string
  wa: string
  tax: string
  inclusive: boolean
  service: string
  rounding: string
  earnPer: string
  pointValue: string
  address: string
  footer: string
}

const pct = (bp: number) => String(bp / 100).replace('.', ',')
const toBp = (v: string) => Math.round((Number(v.replace(',', '.')) || 0) * 100)
const digits = (v: string) => v.replace(/\D/g, '')

const fromData = (store: Store, c: StoreConfig | null): Form => ({
  name: store.name,
  wa: store.wa_number,
  tax: pct(c?.tax_bp ?? 0),
  inclusive: c?.tax_inclusive ?? false,
  service: pct(c?.service_bp ?? 0),
  rounding: String(c?.rounding_to ?? 1),
  earnPer: String(c?.points_earn_per ?? 0),
  pointValue: String(c?.points_value ?? 0),
  address: c?.address ?? '',
  footer: c?.receipt_footer ?? '',
})

/** Hitungan yang sama dengan calc_charges() di database, untuk pratinjau langsung. */
function preview(base: number, f: Form) {
  const sbp = toBp(f.service)
  const tbp = toBp(f.tax)
  const service = Math.round((base * sbp) / 10_000)
  const taxBase = base + service
  const tax = f.inclusive ? taxBase - Math.round(taxBase / (1 + tbp / 10_000)) : Math.round((taxBase * tbp) / 10_000)
  const before = f.inclusive ? taxBase : taxBase + tax
  const step = Number(f.rounding) || 1
  const total = step > 1 ? Math.round(before / step) * step : before
  return { service, tax, rounding: total - before, total }
}

/** Satu baris pengaturan: penjelasan di kiri, kontrol di kanan. Di layar sempit menumpuk. */
function Row({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-2 px-4 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0 md:max-w-md">{children}</div>
    </div>
  )
}

function Suffix({ children, unit }: { children: ReactNode; unit: string }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}

/** Pengaturan toko: profil, pajak & poin, struk, keamanan. Perubahan disimpan sekaligus lewat bar di bawah. */
export function StoreTab({ store, run, fail }: Props) {
  const { storeId } = useStaff()
  const { config, reload } = useStoreConfig(storeId)
  const initial = useMemo(() => fromData(store, config), [store, config])
  const [form, setForm] = useState<Form>(initial)
  const [tab, setTab] = useState('profil')
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [paper, setPaper] = useState<number>(getPaperChars())
  const [pin, setPin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => setForm(initial), [initial])
  // piksel logo dimuat dulu supaya pratinjau struk ikut menampilkan logo
  const [logoReady, setLogoReady] = useState(0)
  useEffect(() => {
    void loadLogo(config?.logo).then(() => setLogoReady((n) => n + 1))
  }, [config?.logo])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const dirty = (Object.keys(form) as (keyof Form)[]).filter((k) => form[k] !== initial[k])
  const profileDirty = dirty.some((k) => k === 'name' || k === 'wa')
  const moneyDirty = dirty.some((k) => k !== 'name' && k !== 'wa')

  const flash = (m: string) => {
    setSavedMsg(m)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  const save = async () => {
    const taxBp = toBp(form.tax)
    const svcBp = toBp(form.service)
    if (taxBp > 3000 || svcBp > 3000) return fail('Pajak dan service maksimal 30%.')
    setBusy(true)
    try {
      if (profileDirty) {
        const parsed = StoreSettingsSchema.safeParse({ name: form.name, wa_number: form.wa })
        if (!parsed.success) return fail(parsed.error.issues[0].message)
        await run(supabase.from('stores').update(parsed.data).eq('id', store.id))
      }
      if (moneyDirty) {
        const { error } = await rpc('save_store_settings', {
          p_tax_bp: taxBp,
          p_tax_inclusive: form.inclusive,
          p_service_bp: svcBp,
          p_rounding_to: Number(form.rounding),
          p_points_earn_per: Number(form.earnPer) || 0,
          p_points_value: Number(form.pointValue) || 0,
          p_receipt_footer: form.footer,
          p_address: form.address,
        })
        if (error) return fail(error.message)
        reload()
      }
      fail('')
      flash('Perubahan tersimpan')
    } finally {
      setBusy(false)
    }
  }

  const savePin = async () => {
    const { error } = await rpc('set_supervisor_pin', { p_pin: pin })
    if (error) return fail(error.message)
    fail('')
    setPin('')
    flash('PIN supervisor diperbarui')
  }

  const link = `${window.location.origin}/s/${store.slug}`
  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const receiptLines = useMemo(() => {
    const q = preview(58_000, form)
    const order = OrderSchema.parse({
      id: '00000000-0000-4000-8000-000000000001', queue_code: 'A-001', business_day: '2026-11-09', customer_name: 'Contoh', order_type: 'TAKEAWAY', table_no: null,
      items: [
        { product_id: '00000000-0000-4000-8000-000000000001', name: 'Kopi Susu', qty: 2, unit_price: 18000, subtotal: 36000, choices: [], note: '' },
        { product_id: '00000000-0000-4000-8000-000000000001', name: 'Roti Bakar', qty: 1, unit_price: 22000, subtotal: 22000, choices: [], note: '' },
      ],
      subtotal: 58_000, service_amount: q.service, tax_amount: q.tax, rounding_amount: q.rounding, total: q.total,
      status: 'COMPLETED', payment_method: 'CASH', cash_received: 100_000, created_at: '2026-11-09T05:00:00Z', paid_at: '2026-11-09T05:01:00Z',
    })
    return previewReceipt(order, { name: form.name || 'Nama usaha', address: form.address, footer: form.footer, logo: config?.logo }, paper)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logoReady: muat ulang setelah piksel logo siap
  }, [form, paper, config?.logo, logoReady])

  const sample = 100_000
  const p = preview(sample, form)
  const earn = Number(form.earnPer) || 0
  const pv = Number(form.pointValue) || 0

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Pengaturan toko"
        description="Profil usaha, pajak dan poin, tampilan struk, serta keamanan. Perubahan baru berlaku setelah disimpan."
        actions={<Chip tone={store.is_active ? 'good' : 'neutral'}>{store.is_active ? 'Toko aktif' : 'Toko nonaktif'}</Chip>}
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b scrollbar-none">
          {[
            ['profil', 'Profil'],
            ['pajak', 'Pajak & poin'],
            ['struk', 'Struk'],
            ['tampilan', 'Warna'],
            ['dapur', 'Dapur'],
            ['shift', 'Shift'],
            ['akses', 'Hak akses'],
            ['keamanan', 'Keamanan'],
          ].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="h-11 flex-none px-4">{l}</TabsTrigger>
          ))}
        </TabsList>

        {/* ===== Profil ===== */}
        <TabsContent value="profil" className="space-y-5">
          <SectionCard title="Profil usaha" hint="Tampil di halaman pemesanan pelanggan" className="[&>div]:divide-y [&>div]:p-0">
            <Row label="Nama usaha" htmlFor="st-name">
              <Input id="st-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={60} className="h-11" />
            </Row>
            <Row label="WhatsApp toko" htmlFor="st-wa" hint="Nomor kontak toko. Diawali 62, tanpa tanda +.">
              <div className="relative">
                <MessageCircle className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="st-wa" inputMode="numeric" value={form.wa} onChange={(e) => set('wa', digits(e.target.value).slice(0, 15))} placeholder="6281234567890" className="h-11 pl-9 font-mono" />
              </div>
            </Row>
            <Row label="Link pemesanan" hint="Bagikan ke pelanggan. QR per meja ada di halaman Meja & QR.">
              <div className="flex gap-2">
                <Input readOnly value={link} aria-label="Link pemesanan" onFocus={(e) => e.currentTarget.select()} className="h-11 font-mono text-xs" />
                <Button variant="outline" size="icon" className="size-11 shrink-0" aria-label="Salin link" onClick={copy}>
                  {copied ? <Check className="text-emerald-600" /> : <Copy />}
                </Button>
                <a href={link} target="_blank" rel="noreferrer" aria-label="Buka halaman pelanggan" className={buttonVariants({ variant: 'outline', size: 'icon', className: 'size-11 shrink-0' })}>
                  <ExternalLink />
                </a>
              </div>
              <Link to="/admin/meja" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <QrCode className="size-4" /> Atur meja & cetak QR
              </Link>
            </Row>
          </SectionCard>
        </TabsContent>

        {/* ===== Pajak & poin ===== */}
        <TabsContent value="pajak" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-5">
              <SectionCard title="Pajak & service" hint="Dihitung otomatis di tiap pesanan" className="[&>div]:divide-y [&>div]:p-0">
                <Row label="Pajak" htmlFor="st-tax" hint="PB1 restoran biasanya 10%.">
                  <Suffix unit="%"><Input id="st-tax" inputMode="decimal" value={form.tax} onChange={(e) => set('tax', e.target.value.replace(/[^\d,]/g, '').slice(0, 5))} className="h-11 pr-9" /></Suffix>
                </Row>
                <Row label="Harga sudah termasuk pajak" hint="Pajak tampil di struk tapi tidak menambah total.">
                  <Switch checked={form.inclusive} onCheckedChange={(v) => set('inclusive', v)} aria-label="Harga sudah termasuk pajak" />
                </Row>
                <Row label="Service charge" htmlFor="st-svc">
                  <Suffix unit="%"><Input id="st-svc" inputMode="decimal" value={form.service} onChange={(e) => set('service', e.target.value.replace(/[^\d,]/g, '').slice(0, 5))} className="h-11 pr-9" /></Suffix>
                </Row>
                <Row label="Pembulatan total">
                  <Select value={form.rounding} onValueChange={(v) => set('rounding', v ?? '1')} items={ROUNDING}>
                    <SelectTrigger aria-label="Pembulatan" className="h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROUNDING.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Row>
              </SectionCard>

              <SectionCard title="Poin member" hint="Isi 0 untuk mematikan program poin" className="[&>div]:divide-y [&>div]:p-0">
                <Row label="Belanja per 1 poin" htmlFor="st-earn" hint="Contoh: 10.000 berarti tiap Rp10.000 dapat 1 poin.">
                  <CurrencyInput id="st-earn" value={form.earnPer} onValueChange={(raw) => set('earnPer', raw)} className="h-11" />
                </Row>
                <Row label="Nilai 1 poin saat ditukar" htmlFor="st-pv" hint="Potongan harga tiap poin yang ditukar.">
                  <CurrencyInput id="st-pv" value={form.pointValue} onValueChange={(raw) => set('pointValue', raw)} className="h-11" />
                </Row>
              </SectionCard>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
              <SectionCard title="Contoh perhitungan" hint="Belanja Rp100.000">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{rupiah(sample)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Service</dt><dd className="tabular-nums">{rupiah(p.service)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Pajak{form.inclusive ? ' (termasuk)' : ''}</dt><dd className="tabular-nums">{rupiah(p.tax)}</dd></div>
                  {p.rounding !== 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Pembulatan</dt><dd className="tabular-nums">{rupiah(p.rounding)}</dd></div>}
                  <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{rupiah(p.total)}</dd></div>
                </dl>
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {earn > 0 ? `Member dapat ${Math.floor(p.total / earn)} poin dari belanja ini${pv > 0 ? `; 100 poin bernilai ${rupiah(100 * pv)}` : ''}.` : 'Program poin nonaktif.'}
                </p>
              </SectionCard>
            </aside>
          </div>
        </TabsContent>

        {/* ===== Struk ===== */}
        <TabsContent value="struk" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <SectionCard title="Isi struk" hint="Tampil di struk cetak dan printer thermal" className="[&>div]:divide-y [&>div]:p-0">
              <Row label="Logo" hint="Tercetak hitam-putih di atas struk. Tersimpan langsung.">
                <LogoPicker config={config} onSaved={reload} />
              </Row>
              <Row label="Alamat usaha" htmlFor="st-addr">
                <Input id="st-addr" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} placeholder="Jl. Contoh No. 1, Jakarta" className="h-11" />
              </Row>
              <Row label="Pesan di kaki struk" htmlFor="st-foot">
                <Input id="st-foot" value={form.footer} onChange={(e) => set('footer', e.target.value)} maxLength={200} placeholder="Terima kasih, sampai jumpa lagi!" className="h-11" />
              </Row>
              <Row label="Lebar kertas printer" hint="Hanya untuk perangkat ini.">
                <div className="grid grid-cols-2 gap-2">
                  {([32, 48] as const).map((n) => (
                    <Button key={n} type="button" variant={paper === n ? 'default' : 'outline'} className="h-11" onClick={() => { setPaper(n); setPaperChars(n) }}>
                      {n === 32 ? '58 mm' : '80 mm'}
                    </Button>
                  ))}
                </div>
              </Row>
            </SectionCard>

            <aside className="xl:sticky xl:top-4 xl:self-start">
              <ThermalPaper lines={receiptLines} chars={paper} logo={config?.logo} />
              <p className="mt-2 text-center text-xs text-muted-foreground">Pratinjau dari perintah printer yang sebenarnya (contoh isi)</p>
              <PrinterCalibration chars={paper} onChars={setPaper} />
            </aside>
          </div>
        </TabsContent>

        {/* ===== Warna aplikasi ===== */}
        <TabsContent value="tampilan" className="max-w-3xl space-y-5">
          <SectionCard title="Warna aplikasi" hint="Warna tombol dan menu untuk semua perangkat toko. Langsung tersimpan.">
            <ThemePicker config={config} onSaved={reload} />
          </SectionCard>
        </TabsContent>

        {/* ===== Dapur ===== */}
        <TabsContent value="dapur" className="max-w-3xl space-y-5">
          <KitchenSettings config={config} onSaved={reload} />
        </TabsContent>

        <TabsContent value="shift" className="max-w-3xl space-y-5">
          <ShiftNamesSettings />
        </TabsContent>
        <TabsContent value="akses" className="max-w-3xl space-y-5">
          <PermissionSettings />
        </TabsContent>

        {/* ===== Keamanan ===== */}
        <TabsContent value="keamanan" className="space-y-5">
          <SectionCard title="PIN supervisor" hint="Untuk void dan refund oleh kasir" className="[&>div]:p-0">
            <Row label="PIN baru" htmlFor="st-pin" hint="4–8 angka. Owner dan manager tidak perlu PIN. Lima kali salah, PIN terkunci 5 menit.">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id="st-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(digits(e.target.value).slice(0, 8))} placeholder="••••" className="h-11 pl-9 tracking-widest" />
                </div>
                <Button variant="outline" className="h-11" disabled={pin.length < 4} onClick={savePin}>Simpan PIN</Button>
              </div>
            </Row>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Bar simpan: hanya muncul bila ada perubahan */}
      <AnimatePresence>
        {(dirty.length > 0 || savedMsg) && (
          <m.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={liquid}
            role="status"
            className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg md:left-[calc(var(--sidebar-width,16rem)+1rem)]"
          >
            {dirty.length > 0 ? (
              <>
                <p className="text-sm"><span className="font-medium">{dirty.length} perubahan</span> <span className="text-muted-foreground">belum disimpan</span></p>
                <span className="flex gap-2">
                  <Button variant="ghost" className="h-10" disabled={busy} onClick={() => setForm(initial)}>Buang</Button>
                  <Button className="h-10" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
                </span>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-4" /> {savedMsg}</p>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
