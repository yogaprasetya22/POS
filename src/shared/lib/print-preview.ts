import CodepageEncoder from '@point-of-sale/codepage-encoder'

/** Satu baris di atas kertas thermal: teks apa adanya (spasi = posisi kolom), dengan gaya cetaknya. */
export type PreviewLine = { text: string; bold: boolean; scale: number; kind: 'text' | 'cut' | 'qrcode' | 'barcode' }

type Cmd = { type: string; property?: string; value?: unknown; payload?: number[] }

// ESC t n → code page. Cukup untuk perangkat umum; sisanya diperlakukan sebagai CP437 (bawaan printer).
const PAGES: Record<number, string> = { 0: 'cp437', 2: 'cp850', 3: 'cp860', 4: 'cp863', 5: 'cp865', 16: 'windows1252', 19: 'cp858' }
const tables = new Map<string, number[]>()
function table(name: string) {
  if (!tables.has(name)) tables.set(name, CodepageEncoder.getCodepoints(name as never, true))
  return tables.get(name)!
}

/**
 * Terjemahkan keluaran `encoder.encode('lines')` menjadi baris siap tampil: byte teks didekode memakai code page
 * yang aktif (jadi "é" tampil benar, dan karakter yang tidak didukung tampil "?" seperti di printer).
 */
export function toPreview(lines: object[][]): PreviewLine[] {
  const out: PreviewLine[] = []
  let bold = false
  let scale = 1
  let page = 'cp437'
  for (const line of lines as Cmd[][]) {
    let text = ''
    let lineScale = 1
    let lineBold = false
    let marker: PreviewLine['kind'] | null = null
    let sawText = false
    for (const c of line) {
      if (c.type === 'text' && c.payload) {
        sawText = true
        lineBold ||= bold
        lineScale = Math.max(lineScale, scale)
        text += c.payload.map((b) => (b < 0x80 ? String.fromCharCode(b) : String.fromCodePoint(table(page)[b] ?? 63))).join('')
      } else if (c.type === 'codepage' && c.payload) page = PAGES[c.payload[2]] ?? 'cp437'
      else if (c.type === 'style' && c.property === 'bold') bold = c.value === true
      else if (c.type === 'style' && c.property === 'size') {
        const v = c.value as { width?: number; height?: number }
        scale = Math.max(v.width ?? 1, v.height ?? 1)
      } else if (c.type === 'cut') marker = 'cut'
      else if (c.type === 'qrcode' && c.property === undefined) marker = 'qrcode'
      else if (c.type === 'barcode' && c.property === undefined) marker = 'barcode'
    }
    if (marker) out.push({ text: marker === 'cut' ? '' : marker === 'qrcode' ? 'QR' : 'BARCODE', bold: false, scale: 1, kind: marker })
    else if (sawText) out.push({ text: text.replace(/\s+$/, ''), bold: lineBold, scale: lineScale, kind: 'text' })
  }
  return out
}

/** Pratinjau sebagai teks polos (untuk tes golden dan salin-tempel). */
export const previewToText = (lines: PreviewLine[]) =>
  lines.map((l) => (l.kind === 'cut' ? '✂ - - - - - - - -' : l.kind === 'text' ? l.text : `[${l.text}]`)).join('\n')
