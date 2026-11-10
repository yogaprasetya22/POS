import { useState } from 'react'
import { SkeletonContainer } from '@shared/components/ui/skeleton-container'
import { cn } from 'cn'
import { UtensilsCrossed } from 'lucide-react'

interface MenuImageProps {
  src?: string | null
  alt: string
  className?: string
  aspectRatio?: string
  fallbackIconSize?: string
}

/**
 * MenuImage: Gambar menu dengan skeleton pulse halus selama memuat (load)
 * dan transisi fade-in lembut saat gambar selesai diunduh.
 * // ponytail: murni React state + CSS transitions, tanpa library berat.
 */
export function MenuImage({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-4/3',
  fallbackIconSize = 'size-8 sm:size-10',
}: MenuImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return (
      <div className={cn('relative w-full overflow-hidden bg-muted/60 grid place-items-center text-primary/40', aspectRatio)}>
        <UtensilsCrossed className={fallbackIconSize} aria-hidden />
      </div>
    )
  }

  return (
    <div className={cn('relative w-full overflow-hidden bg-muted', aspectRatio)}>
      {/* Skeleton Pulse saat gambar sedang dimuat dari jaringan */}
      {!isLoaded && (
        <SkeletonContainer isLoading className="absolute inset-0 z-10">
          <span className="block size-full rounded-none">gambar</span>
        </SkeletonContainer>
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={cn(
          'size-full object-cover transition-opacity duration-200',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
      />
    </div>
  )
}
