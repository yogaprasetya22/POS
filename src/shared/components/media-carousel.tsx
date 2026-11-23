import { playableUrl } from '@shared/lib/media-url'
import { SmartImage } from './smart-image'
import { ChevronLeft, ChevronRight, UtensilsCrossed, Maximize2, Play, Video, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

  // Foto dulu, video tegak 9:16 di akhir
  if (videoUrl && videoUrl.trim()) {
    mediaList.push({ type: 'video', url: playableUrl(videoUrl) })
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

  // slide video: bingkai tegak ala TikTok (videoClassName), video di tengah

  // slide video: tinggi bingkai mengikuti rasio video agar video utuh (dibatasi tinggi layar)
  const [videoRatio, setVideoRatio] = useState(0)
  const frameStyle = mediaList[activeIndex]?.type === 'video' && videoRatio ? { aspectRatio: String(videoRatio), height: 'auto', maxHeight: 'calc(100svh - 17rem)' } : undefined

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
      <div style={frameStyle} className={`relative overflow-hidden bg-black/90 ${className || 'h-48 sm:h-64 w-full'}`}>
        {item.type === 'image' ? (
          <SmartImage src={item.url} alt={alt} width={640} priority className="object-contain" />
        ) : (
          <ReelVideo src={item.url} active alt={alt} onRatio={setVideoRatio} />
        )}
      </div>
    )
  }

  return (
    <div style={frameStyle} className={`group relative overflow-hidden bg-black/95 select-none  ${className || 'h-48 sm:h-64 w-full'}`}>
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
              <SmartImage src={item.url} alt={`${alt} ${idx + 1}`} width={640} priority={idx === 0} className="object-contain" />
            ) : (
              <ReelVideo src={item.url} active={activeIndex === idx} alt={alt} onRatio={setVideoRatio} />
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
        <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-white/95 backdrop-blur-md shadow-xs">
          {mediaList[activeIndex].type === 'video' ? (
            <>
              <Video className="size-2.5 text-sky-400" />
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

/** Slide video: putar otomatis tanpa suara. Ketuk = buka layar penuh ala TikTok. */
function ReelVideo({ src, active, alt = '', onRatio }: { src: string; active: boolean; alt?: string; onRatio?: (r: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [full, setFull] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (active && !full) v.play().catch(() => {})
    else v.pause()
  }, [active, full])
  return (
    <>
      <button type="button" onClick={() => setFull(true)} aria-label="Putar video layar penuh" className="relative size-full overflow-hidden bg-black">
        <video ref={ref} src={src} onLoadedMetadata={(e) => e.currentTarget.videoHeight && onRatio?.(e.currentTarget.videoWidth / e.currentTarget.videoHeight)} autoPlay muted loop playsInline preload="auto" className="size-full object-contain" />
        <span className="absolute right-3 top-2.5 z-10 grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
          <Maximize2 className="size-4" />
        </span>
      </button>
      {full && createPortal(<FullVideo src={src} alt={alt} onClose={() => setFull(false)} />, document.body)}
    </>
  )
}

/** Layar penuh seperti TikTok: video utuh di tengah, latar abu-abu, ketuk = jeda/putar. */
function FullVideo({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={alt || 'Video'} className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-neutral-600">
      <video
        ref={ref}
        src={src}
        autoPlay
        muted={muted}
        loop
        playsInline
        onClick={toggle}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        className="max-h-full w-full object-contain"
      />
      {paused && (
        <span className="pointer-events-none absolute grid size-16 place-items-center rounded-full bg-black/40 text-white">
          <Play className="size-8 fill-current" />
        </span>
      )}
      <button type="button" onClick={onClose} aria-label="Tutup" className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
        <X className="size-5" />
      </button>
      <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'} className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
      {alt && <p className="pointer-events-none absolute inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] text-base font-bold text-white drop-shadow">{alt}</p>}
    </div>
  )
}
