import { Camera, Link2, PackagePlus, ScanLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { supabase } from '@shared/lib/supabase'
import type { Ingredient } from './data'

/**
 * Kotak scan barcode. Scanner USB/Bluetooth bekerja seperti keyboard (kode + Enter), jadi cukup kotak ini fokus.
 * Tombol Kamera untuk HP/tablet. Kalau tidak terbaca, kode bisa diketik manual lalu Enter.
 */
export function BarcodeField({ onCode, autoFocus, placeholder = 'Scan barcode atau ketik kodenya lalu Enter' }: { onCode: (code: string) => void; autoFocus?: boolean; placeholder?: string }) {
  const [value, setValue] = useState('')
  const [camera, setCamera] = useState(false)
  const submit = () => {
    const code = value.trim()
    if (code) onCode(code)
    setValue('')
  }
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <ScanLine className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          aria-label="Barcode"
          className="h-12 pl-11 text-base"
        />
      </div>
      <Button type="button" variant="outline" className="h-12 border-2 px-4 text-base" onClick={() => setCamera(true)}>
        <Camera /> Kamera
      </Button>
      {camera && (
        <CameraScanner
          onClose={() => setCamera(false)}
          onCode={(c) => {
            setCamera(false)
            onCode(c)
          }}
        />
      )}
    </div>
  )
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] as const

/** Pemindai kamera. Pakai BarcodeDetector bawaan browser bila ada; selain itu ponyfill (dimuat saat dibutuhkan). */
function CameraScanner({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  // simpan callback di ref: efek kamera hanya jalan sekali, tidak menyala-mati tiap render
  const found = useRef(onCode)
  found.current = onCode

  useEffect(() => {
    let stream: MediaStream | null = null
    let stop = false
    let raf = 0
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stop || !video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: readonly string[] }) => { detect: (s: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
        const Detector = Native ?? (await import('barcode-detector/ponyfill')).BarcodeDetector
        const detector = new Detector({ formats: [...FORMATS] })
        const tick = async () => {
          if (stop || !video.current) return
          try {
            const hits = await detector.detect(video.current)
            if (hits[0]?.rawValue) {
              navigator.vibrate?.(80)
              found.current(hits[0].rawValue)
              return
            }
          } catch {
            /* frame belum siap */
          }
          raf = requestAnimationFrame(() => void tick())
        }
        void tick()
      } catch {
        setError('Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau ketik kode barcode secara manual.')
      }
    })()
    return () => {
      stop = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <Panel
      onClose={onClose}
      title="Scan barcode"
      description="Arahkan kamera ke barcode di kemasan. Jaga jarak sekitar 15 cm dan pastikan cukup terang."
      footer={
        <Button variant="outline" className="h-12 w-full border-2 text-base" onClick={onClose}>
          <X /> Tutup kamera
        </Button>
      }
    >
      <ErrorAlert message={error} />
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={video} muted playsInline className="aspect-video w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" aria-hidden />
      </div>
    </Panel>
  )
}

/**
 * Barcode belum terdaftar: hubungkan ke bahan yang ada (disimpan untuk scan berikutnya), atau buat bahan baru.
 */
export function UnknownBarcode({
  code,
  items,
  storeId,
  onLinked,
  onCreateNew,
  onClose,
}: {
  code: string
  items: Ingredient[]
  storeId: string
  onLinked: (ingredientId: string) => void
  onCreateNew: () => void
  onClose: () => void
}) {
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = items.filter((i) => i.is_active)

  const link = async () => {
    setBusy(true)
    const { error: err } = await supabase.from('ingredient_barcodes').insert({ store_id: storeId, code, ingredient_id: pick })
    setBusy(false)
    if (err) return setError(err.message)
    onLinked(pick)
  }

  return (
    <Panel
      onClose={onClose}
      title="Barcode belum terdaftar"
      description={`Kode ${code} belum terhubung ke bahan mana pun.`}
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button className="h-12 w-full text-base font-bold" disabled={!pick || busy} onClick={link}>
            <Link2 /> {busy ? 'Menyimpan…' : 'Hubungkan ke bahan ini'}
          </Button>
          <Button variant="outline" className="h-12 w-full border-2 text-base" onClick={onCreateNew}>
            <PackagePlus /> Buat bahan baru dengan barcode ini
          </Button>
        </div>
      }
    >
      <p className="text-base">Pilih bahan yang sesuai dengan kemasan ini. Berikutnya, scan barcode yang sama akan langsung memilih bahan itu.</p>
      <Select value={pick} onValueChange={(v) => setPick(v ?? '')} items={active.map((i) => ({ value: i.id, label: i.name }))}>
        <SelectTrigger aria-label="Pilih bahan" className="h-12 w-full text-base"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
        <SelectContent>{active.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
      </Select>
    </Panel>
  )
}
