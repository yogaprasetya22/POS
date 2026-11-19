import { Scissors } from 'lucide-react'
import type { PreviewLine } from '@shared/lib/print-preview'
import { getLogoPct } from '@shared/lib/print'
import { logoAt, paperDots } from '@shared/lib/receipt-logo'

/**
 * Kertas thermal tiruan. Isinya dibaca dari perintah ESC/POS yang sama dengan yang dikirim ke printer,
 * jadi yang tampil di sini adalah isi cetakan sebenarnya (kolom, rata, tebal, ukuran, dan karakter yang didukung).
 */
export function ThermalPaper({ lines, chars, logo, logoPct = getLogoPct() }: { lines: PreviewLine[]; chars: number; logo?: string; logoPct?: number }) {
  // lebar logo di pratinjau = lebar cetak sebenarnya dibanding lebar kertas
  const px = logoAt(logo, logoPct, chars)
  const logoWidth = px ? `${(px.width / paperDots(chars)) * 100}%` : '70%'
  return (
    <div role="img" aria-label="Pratinjau cetakan printer thermal" className="mx-auto w-fit max-w-full overflow-x-auto rounded-sm bg-white px-4 py-5 text-black shadow-md ring-1 ring-black/10">
      <div className="font-mono text-[11px] leading-[1.45]" style={{ width: `${chars}ch` }}>
        {lines.map((l, i) =>
          l.kind === 'cut' ? (
            <div key={i} className="mt-3 flex items-center gap-2 text-black/40" aria-hidden>
              <Scissors className="size-3 shrink-0" />
              <span className="flex-1 border-t border-dashed border-black/40" />
            </div>
          ) : l.kind === 'text' ? (
            <div key={i} className="whitespace-pre" style={{ fontWeight: l.bold ? 700 : 400, fontSize: l.scale > 1 ? `${l.scale * 11}px` : undefined, lineHeight: l.scale > 1 ? 1.2 : undefined }}>
              {l.text || ' '}
            </div>
          ) : l.kind === 'image' && logo ? (
            <img key={i} src={logo} alt="Logo toko" style={{ width: logoWidth }} className="mx-auto mb-2 transition-[width] duration-300 [image-rendering:pixelated]" />
          ) : (
            <div key={i} className="my-2 grid h-16 place-items-center border border-dashed border-black/50 text-[10px] text-black/60">
              {l.kind === 'qrcode' ? 'QR code' : 'Barcode'}
            </div>
          ),
        )}
      </div>
    </div>
  )
}
