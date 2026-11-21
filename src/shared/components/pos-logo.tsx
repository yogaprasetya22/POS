import { cn } from '@shared/lib/utils'

interface PosLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  subtitle?: boolean
  className?: string
  textClassName?: string
}

const SIZE_CONFIG = {
  xs: { box: 'size-6', svg: 24, font: 'text-sm', sub: 'text-[9px]' },
  sm: { box: 'size-8', svg: 32, font: 'text-base', sub: 'text-[10px]' },
  md: { box: 'size-9', svg: 36, font: 'text-lg', sub: 'text-[11px]' },
  lg: { box: 'size-11', svg: 44, font: 'text-xl', sub: 'text-xs' },
  xl: { box: 'size-14', svg: 56, font: 'text-2xl', sub: 'text-sm' },
}

export function PosLogo({
  size = 'md',
  showText = true,
  subtitle = false,
  className,
  textClassName,
}: PosLogoProps) {
  const cfg = SIZE_CONFIG[size]

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Scalable Vector Emblem */}
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-105',
          cfg.box
        )}
      >
        <svg
          viewBox="0 0 128 128"
          className="size-full block"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="pos-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
            <linearGradient id="pos-logo-spark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="pos-logo-loop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E0E7FF" />
            </linearGradient>
          </defs>

          {/* Background Squircle */}
          <rect width="128" height="128" rx="32" fill="url(#pos-logo-bg)" />
          <rect
            x="1"
            y="1"
            width="126"
            height="126"
            rx="31"
            stroke="#FFFFFF"
            strokeOpacity="0.22"
            strokeWidth="2"
          />

          {/* POS "P" Stem */}
          <rect x="36" y="30" width="16" height="68" rx="8" fill="url(#pos-logo-loop)" />

          {/* Cloche Dome / Loop */}
          <path
            d="M48 30 C 78 30, 94 45, 94 62 C 94 79, 78 92, 48 92 L 48 76 C 67 76, 78 68, 78 62 C 78 54, 67 46, 48 46 Z"
            fill="url(#pos-logo-loop)"
            fillRule="evenodd"
          />

          {/* Dining / Notification Spark */}
          <circle cx="83" cy="38" r="8" fill="url(#pos-logo-spark)" />

          {/* Receipt Flow Notch */}
          <rect x="56" y="58" width="16" height="4.5" rx="2.25" fill="#6366F1" fillOpacity="0.85" />
        </svg>
      </div>

      {/* Typography Wordmark */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'font-extrabold tracking-tight text-foreground transition-colors',
              cfg.font,
              textClassName
            )}
          >
            Resto<span className="text-primary">POS</span>
          </span>
          {subtitle && (
            <span
              className={cn(
                'mt-1 font-bold uppercase tracking-wider text-muted-foreground/75',
                cfg.sub
              )}
            >
              Kafe &amp; Kuliner
            </span>
          )}
        </div>
      )}
    </div>
  )
}

