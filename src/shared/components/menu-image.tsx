import { useState } from 'react'
import { cn } from 'cn'
import { UtensilsCrossed } from 'lucide-react'
import { SmartImage } from './smart-image'

interface MenuImageProps {
  src?: string | null
  alt: string
  className?: string
  aspectRatio?: string
  fallbackIconSize?: string
  /** Lebar tampil kira-kira (px CSS). Kartu menu ±200px. */
  width?: number
  /** Gambar di layar pertama: dimuat segera. */
  priority?: boolean
}

/** Gambar menu: ukuran pas, versi buram dulu saat memuat, lalu memudar halus ke gambar asli. */
export function MenuImage({ src, alt, className = '', aspectRatio = 'aspect-4/3', fallbackIconSize = 'size-8 sm:size-10', width = 320, priority = false }: MenuImageProps) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return (
      <div className={cn('relative grid w-full place-items-center overflow-hidden bg-muted/60 text-primary/40', aspectRatio)}>
        <UtensilsCrossed className={fallbackIconSize} aria-hidden />
      </div>
    )
  }

  return (
    <div className={cn('relative w-full overflow-hidden bg-muted', aspectRatio)}>
      <SmartImage src={src} alt={alt} width={width} priority={priority} onError={() => setHasError(true)} className={className} />
    </div>
  )
}
