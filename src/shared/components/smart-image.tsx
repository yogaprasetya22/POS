import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { cn } from 'cn'
import { canResize, sizedImage, srcSetFor } from '@shared/lib/image-url'

/**
 * Gambar yang cepat & halus:
 * - mengunduh ukuran yang pas (width = lebar tampil dalam px CSS; 2x untuk layar tajam),
 * - selama memuat menampilkan versi mini (±1–3 KB) yang diburamkan, lalu gambar asli memudar masuk,
 * - priority = gambar di layar pertama (dimuat segera, tanpa lazy).
 * Mengisi penuh induknya (absolute inset-0): induk wajib relative + ukuran tetap (aspect-ratio / size-*).
 */
export function SmartImage({
  src,
  alt,
  width,
  priority = false,
  className,
  onError,
}: {
  src: string
  alt: string
  width: number
  priority?: boolean
  className?: string
  onError?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const blur = canResize(src) ? sizedImage(src, 24, 30) : null

  return (
    <>
      <AnimatePresence initial={false}>
        {!loaded && (
          <m.span key="ph" aria-hidden initial={false} exit={{ opacity: 0, transition: { duration: 0.35 } }} className="absolute inset-0 overflow-hidden bg-muted">
            {blur ? (
              // scale-110: tepi buram tidak menampakkan garis putih
              <img src={blur} alt="" decoding="async" referrerPolicy="no-referrer" className="size-full scale-110 object-cover blur-md" />
            ) : (
              <span className="block size-full animate-pulse bg-muted" />
            )}
          </m.span>
        )}
      </AnimatePresence>
      <m.img
        src={sizedImage(src, width)}
        srcSet={srcSetFor(src, width)}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={onError}
        initial={false}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn('absolute inset-0 size-full object-cover', className)}
      />
    </>
  )
}
