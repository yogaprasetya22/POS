/*
 * Logo struk. Saat diunggah, gambar diperkecil dan diubah jadi hitam-putih (printer thermal hanya bisa hitam),
 * lalu disimpan sebagai PNG kecil. Saat mencetak, pikselnya dibaca dari cache supaya pencetakan tetap sinkron.
 */

const MAX_W = 256 // titik; muat di kertas 58 mm (384 titik) dan 80 mm
const MAX_H = 128

export type LogoPixels = { width: number; height: number; data: Uint8ClampedArray }

const round8 = (n: number) => Math.max(8, Math.round(n / 8) * 8)

/** File gambar → data URL PNG hitam-putih siap cetak. */
export async function prepareLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Pilih file gambar (PNG atau JPG).')
  const bmp = await createImageBitmap(file)
  const scale = Math.min(MAX_W / bmp.width, MAX_H / bmp.height, 1)
  const w = round8(bmp.width * scale)
  const h = round8(bmp.height * scale)
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#fff' // latar transparan jadi putih, bukan hitam
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  // Floyd–Steinberg: gradasi tetap terlihat sebagai titik-titik
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const v = g[i] < 128 ? 0 : 255
      const err = g[i] - v
      g[i] = v
      if (x + 1 < w) g[i + 1] += (err * 7) / 16
      if (y + 1 < h) {
        if (x > 0) g[i + w - 1] += (err * 3) / 16
        g[i + w] += (err * 5) / 16
        if (x + 1 < w) g[i + w + 1] += err / 16
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    img.data.fill(g[i], i * 4, i * 4 + 3)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return cv.toDataURL('image/png')
}

const cache = new Map<string, LogoPixels>()
const pending = new Map<string, Promise<LogoPixels | null>>()

/** Muat piksel logo ke cache (panggil saat pengaturan toko dibaca). */
export function loadLogo(src: string | null | undefined): Promise<LogoPixels | null> {
  if (!src) return Promise.resolve(null)
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  if (!pending.has(src)) {
    pending.set(
      src,
      new Promise((resolve) => {
        const im = new Image()
        im.onload = () => {
          const cv = document.createElement('canvas')
          cv.width = im.width
          cv.height = im.height
          const ctx = cv.getContext('2d')!
          ctx.drawImage(im, 0, 0)
          const d = ctx.getImageData(0, 0, im.width, im.height)
          const px = { width: d.width, height: d.height, data: d.data }
          cache.set(src, px)
          resolve(px)
        }
        im.onerror = () => resolve(null)
        im.src = src
      }),
    )
  }
  return pending.get(src)!
}

/** Piksel logo bila sudah dimuat; null bila belum (struk dicetak tanpa logo). */
export const logoPixels = (src: string | null | undefined) => (src ? (cache.get(src) ?? null) : null)
