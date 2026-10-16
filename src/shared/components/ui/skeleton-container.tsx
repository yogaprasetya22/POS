import type { ReactNode } from 'react'
import { cn } from 'cn'

interface SkeletonContainerProps {
  isLoading: boolean
  children: ReactNode
  className?: string
}

/**
 * SkeletonContainer: Mengubah elemen anak menjadi kerangka loading animasi pulse
 * tanpa layout shift, menjaga bentuk asli UI selama data dimuat.
 */
export function SkeletonContainer({
  isLoading,
  children,
  className = '',
}: SkeletonContainerProps) {
  if (!isLoading) return <>{children}</>

  return (
    <div
      className={cn(
        `animate-pulse pointer-events-none select-none
        [&_p]:!bg-muted [&_p]:!text-transparent [&_p]:!rounded-md [&_p]:!border-transparent
        [&_h1]:!bg-muted [&_h1]:!text-transparent [&_h1]:!rounded-md [&_h1]:!border-transparent
        [&_h2]:!bg-muted [&_h2]:!text-transparent [&_h2]:!rounded-md [&_h2]:!border-transparent
        [&_h3]:!bg-muted [&_h3]:!text-transparent [&_h3]:!rounded-md [&_h3]:!border-transparent
        [&_h4]:!bg-muted [&_h4]:!text-transparent [&_h4]:!rounded-md [&_h4]:!border-transparent
        [&_span]:!bg-muted [&_span]:!text-transparent [&_span]:!rounded-md [&_span]:!border-transparent
        [&_a]:!bg-card [&_a]:!border-border
        [&_button]:!bg-muted [&_button]:!text-transparent [&_button]:!border-transparent
        [&_img]:!opacity-0 [&_img]:!bg-muted
        [&_svg]:!opacity-0`,
        className
      )}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}
