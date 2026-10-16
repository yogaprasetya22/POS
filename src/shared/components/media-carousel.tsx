import { ChevronLeft, ChevronRight, UtensilsCrossed, Video } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

type MediaItem =
  | { type: 'image'; url: string }
  | { type: 'video'; url: string }

type Props = {
  images?: string[]
  imageUrl?: string | null
  videoUrl?: string | null
  alt?: string
  className?: string
}

/**
 * Media Carousel ringan berbasis native CSS scroll-snap (Ponytail).
 * Mendukung multi-image dan video player tanpa library eksternal berlebih.
 */
export function MediaCarousel({ images = [], imageUrl, videoUrl, alt = '', className = '' }: Props) {
  // Satukan semua media: foto utama, foto-foto tambahan, dan video
  const mediaList: MediaItem[] = []

  // Kumpulkan list URL gambar unik
  const allImages = Array.from(new Set([imageUrl, ...images].filter((u): u is string => Boolean(u && u.trim()))))
  for (const url of allImages) {
    mediaList.push({ type: 'image', url })
  }

  // Tambahkan video jika ada
  if (videoUrl && videoUrl.trim()) {
    mediaList.push({ type: 'video', url: videoUrl.trim() })
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // Pantau index slide aktif via IntersectionObserver atau onScroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const width = el.offsetWidth
    if (width <= 0) return
    const newIdx = Math.round(el.scrollLeft / width)
    if (newIdx !== activeIndex && newIdx >= 0 && newIdx < mediaList.length) {
      setActiveIndex(newIdx)
    }
  }, [activeIndex, mediaList.length])

  const scrollToIndex = (idx: number) => {
    const el = containerRef.current
    if (!el) return
    const targetIdx = Math.max(0, Math.min(idx, mediaList.length - 1))
    el.scrollTo({
      left: targetIdx * el.offsetWidth,
      behavior: 'smooth',
    })
    setActiveIndex(targetIdx)
  }

  // Jika tidak ada media apapun
  if (mediaList.length === 0) {
    return (
      <div className={`relative flex items-center justify-center bg-accent text-primary/40 ${className || 'h-52 w-full'}`}>
        <UtensilsCrossed className="size-12" aria-hidden />
      </div>
    )
  }

  // Jika hanya ada 1 media
  if (mediaList.length === 1) {
    const item = mediaList[0]
    return (
      <div className={`relative overflow-hidden bg-black/90 ${className || 'h-52 w-full'}`}>
        {item.type === 'image' ? (
          <img src={item.url} alt={alt} className="size-full object-cover" />
        ) : (
          <video
            src={item.url}
            controls
            playsInline
            preload="metadata"
            className="size-full object-contain"
          />
        )}
      </div>
    )
  }

  return (
    <div className={`group relative overflow-hidden bg-black/95 select-none ${className || 'h-56 sm:h-64 w-full'}`}>
      {/* Scrollable Container with Scroll-Snap */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex size-full snap-x snap-mandatory overflow-x-auto scrollbar-none overscroll-x-contain"
      >
        {mediaList.map((item, idx) => (
          <div
            key={idx}
            className="relative size-full shrink-0 snap-center snap-always flex items-center justify-center overflow-hidden"
          >
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt={`${alt} ${idx + 1}`}
                className="size-full object-cover"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            ) : (
              <div className="relative size-full bg-black flex items-center justify-center">
                <video
                  src={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="size-full object-contain max-h-full"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigasi Tombol Panah (Desktop & Tablet) */}
      {activeIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            scrollToIndex(activeIndex - 1)
          }}
          aria-label="Sebelumnya"
          className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/60 text-white hover:bg-black/85 flex items-center justify-center backdrop-blur-xs transition-opacity sm:opacity-0 sm:group-hover:opacity-100 z-10 cursor-pointer shadow-md"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {activeIndex < mediaList.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            scrollToIndex(activeIndex + 1)
          }}
          aria-label="Selanjutnya"
          className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/60 text-white hover:bg-black/85 flex items-center justify-center backdrop-blur-xs transition-opacity sm:opacity-0 sm:group-hover:opacity-100 z-10 cursor-pointer shadow-md"
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      {/* Slide Badge Type (Image / Video) */}
      <div className="absolute top-2.5 left-2.5 z-10">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md shadow-xs">
          {mediaList[activeIndex].type === 'video' ? (
            <>
              <Video className="size-2.5 text-rose-400" />
              <span>Video</span>
            </>
          ) : (
            <span>
              {activeIndex + 1} / {mediaList.length}
            </span>
          )}
        </span>
      </div>

      {/* Dots Indicator di Bawah */}
      <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-none">
        {mediaList.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              scrollToIndex(idx)
            }}
            aria-label={`Slide ${idx + 1}`}
            className={`pointer-events-auto h-1.5 transition-all rounded-full ${
              activeIndex === idx
                ? 'w-4 bg-white shadow-xs'
                : 'w-1.5 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
