import { useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { ThermalPaper } from '@shared/components/thermal-preview'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
  BAUD_RATES, CHAR_WIDTHS, PRINTER_LIMITS, escposTestPage, getBaudRate, getFeedBeforeCut, previewTestPage,
  sendToPrinter, setBaudRate, setFeedBeforeCut, setPaperChars,
} from '@shared/lib/print'

const clamp = (n: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, Math.round(n) || min))

/** Kalibrasi printer thermal untuk perangkat ini: lebar baris, baud rate, feed sebelum potong, dan cetak tes. */
export function PrinterCalibration({ chars, onChars }: { chars: number; onChars: (n: number) => void }) {
  const [baud, setBaud] = useState(getBaudRate())
  const [feed, setFeed] = useState(getFeedBeforeCut())
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [showTest, setShowTest] = useState(false)

  const changeChars = (v: number) => {
    onChars(v)
    setPaperChars(v)
  }

  const test = async () => {
    setBusy(true)
    setMsg('')
    setErr('')
    const r = await sendToPrinter(escposTestPage(chars))
    setBusy(false)
    if (r.ok) setMsg('Lembar uji terkirim. Periksa hasil cetakannya.')
    else setErr(r.error)
  }

  return (
    <section className="mt-4 space-y-3 rounded-xl border bg-card p-4 text-sm">
      <div>
        <h3 className="font-semibold">Kalibrasi printer</h3>
        <p className="text-xs text-muted-foreground">Berlaku untuk perangkat ini saja. Cetak tes dulu, lalu sesuaikan.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Karakter per baris</span>
        <select value={chars} onChange={(e) => changeChars(Number(e.target.value))} className="h-11 w-full rounded-md border bg-background px-3">
          {CHAR_WIDTHS.map((n) => <option key={n} value={n}>{n}{n === 32 ? ' (58 mm umum)' : n === 48 ? ' (80 mm umum)' : ''}</option>)}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Baud rate (USB serial)</span>
        <select
          value={baud}
          onChange={(e) => { const n = Number(e.target.value); setBaud(n); setBaudRate(n) }}
          className="h-11 w-full rounded-md border bg-background px-3">
          {BAUD_RATES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Baris kosong sebelum potong ({PRINTER_LIMITS.feed[0]}–{PRINTER_LIMITS.feed[1]})</span>
        <Input
          type="number" inputMode="numeric" min={PRINTER_LIMITS.feed[0]} max={PRINTER_LIMITS.feed[1]} value={feed}
          onChange={(e) => { const v = clamp(Number(e.target.value), PRINTER_LIMITS.feed); setFeed(v); setFeedBeforeCut(v) }} className="h-11" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => setShowTest((v) => !v)}>{showTest ? 'Tutup pratinjau' : 'Lihat lembar uji'}</Button>
        <Button type="button" className="h-11" disabled={busy} onClick={test}>{busy ? 'Mengirim…' : 'Cetak tes'}</Button>
      </div>
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      <ErrorAlert message={err} />
      {showTest && <ThermalPaper lines={previewTestPage(chars)} chars={chars} />}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Cara membaca hasil cetak</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Penggaris terpotong atau membungkus: kurangi karakter per baris sampai utuh.</li>
          <li>Ada ruang kosong di kanan: naikkan karakter per baris.</li>
          <li>Tulisan acak atau tidak keluar: coba baud rate lain (umumnya 9600 atau 115200).</li>
          <li>Pisau memotong tulisan terakhir: naikkan baris kosong sebelum potong.</li>
          <li>Huruf beraksen jadi tanda tanya: printer tidak punya codepage itu, abaikan atau hindari aksen.</li>
          <li>Cetakan pucat: atur kepadatan di printer (self-test atau tombol feed), bukan di aplikasi.</li>
        </ul>
      </details>
    </section>
  )
}
