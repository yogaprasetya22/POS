import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { Input } from '@shared/components/ui/input'
import { cn } from '@shared/lib/utils'

const MAX_INT_DIGITS = 12

/** Pisahkan teks yang diketik jadi bagian bulat, desimal, dan ada-tidaknya koma. Titik pemisah ribuan diabaikan. */
function split(typed: string, decimals: number) {
  const s = typed.replace(/[^\d,]/g, '')
  const [intRaw, ...rest] = s.split(',')
  const int = intRaw.replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS)
  const comma = decimals > 0 && s.includes(',')
  const dec = comma ? rest.join('').slice(0, decimals) : ''
  return { int, dec, comma }
}

/** "240000" → "240.000", "0.25" → "0,25". Format Indonesia: titik ribuan, koma desimal. */
export function formatRupiahInput(raw: string | number | null | undefined, decimals = 0): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const { int, dec, comma } = split(String(raw).replace('.', ','), decimals)
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return grouped + (comma ? `,${dec}` : '')
}

/** Teks tampilan → nilai bersih: "240.000" → "240000", "0,25" → "0.25". */
export function parseRupiahInput(typed: string, decimals = 0): string {
  const { int, dec } = split(typed, decimals)
  return int + (dec ? `.${dec}` : '')
}

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  /** Nilai bersih (angka tanpa titik ribuan); kosong = ''. Boleh berupa number. */
  value: string | number
  onValueChange: (raw: string, num: number) => void
  /** Jumlah angka di belakang koma (mis. harga bahan per gram). Default 0 = bilangan bulat. */
  decimals?: number
  /** Tulisan di kiri kolom. Default "Rp"; kirim '' untuk menyembunyikan. */
  prefix?: string
}

/**
 * Kolom isian uang: tampil 240.000 saat mengetik, tapi nilai yang dikirim ke state selalu bersih ("240000").
 * Hanya menerima angka (dan koma bila decimals > 0); kursor tetap di tempatnya saat titik ribuan bertambah.
 */
export function CurrencyInput({ value, onValueChange, decimals = 0, prefix = 'Rp', className, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const raw = value === '' ? '' : String(value)
  const [text, setText] = useState(() => formatRupiahInput(raw, decimals))

  // Sinkron saat nilai berubah dari luar (mis. direset atau terisi otomatis), tanpa menimpa ketikan yang sedang berjalan.
  useEffect(() => {
    if (parseRupiahInput(text, decimals) !== raw) setText(formatRupiahInput(raw, decimals))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, decimals])

  useLayoutEffect(() => {
    if (caret.current === null || !ref.current) return
    let seen = 0
    let pos = 0
    while (pos < text.length && seen < caret.current) {
      if (/[\d,]/.test(text[pos])) seen++
      pos++
    }
    ref.current.setSelectionRange(pos, pos)
    caret.current = null
  }, [text])

  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      <Input
        {...props}
        ref={ref}
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const typed = e.target.value
          const at = e.target.selectionStart ?? typed.length
          caret.current = typed.slice(0, at).replace(/[^\d,]/g, '').length
          const next = formatRupiahInput(parseRupiahInput(typed, decimals), decimals)
          // koma yang baru diketik harus tetap tampil ("12," sebelum angka desimalnya)
          const display = decimals > 0 && typed.slice(0, typed.length).includes(',') && !next.includes(',') ? `${next},` : next
          setText(display)
          const clean = parseRupiahInput(display, decimals)
          onValueChange(clean, Number(clean) || 0)
        }}
        className={cn('tabular-nums', prefix && 'pl-9', className)}
      />
    </div>
  )
}
