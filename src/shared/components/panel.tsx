import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@shared/components/ui/drawer'
import { useIsMobile } from '@shared/hooks/use-mobile'

type Props = {
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  /** gambar/header penuh di atas judul */
  media?: ReactNode
  /** elemen di samping judul (mis. stepper jumlah) */
  aside?: ReactNode
  /** aksi utama; selalu terlihat, tidak ikut di-scroll */
  footer: ReactNode
  maxWidth?: string
  children: ReactNode
}

/** Pola "responsive dialog" shadcn: Drawer (bisa diswipe) di HP, Dialog di tablet/desktop. */
export function Panel({
  onClose,
  title,
  description,
  media,
  aside,
  footer,
  maxWidth = 'sm:max-w-xl md:max-w-2xl',
  children,
}: Props) {
  const isMobile = useIsMobile()

  const content = (Title: typeof DialogTitle, Description: typeof DialogDescription) => (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4 shrink-0 bg-background/80 backdrop-blur-xs">
        <div className="min-w-0 flex-1 pr-3">
          <Title className="text-base sm:text-xl font-black leading-tight text-foreground">{title}</Title>
          <Description className={description ? 'mt-0.5 text-xs sm:text-sm font-bold text-primary truncate' : 'sr-only'}>
            {description ?? title}
          </Description>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {aside}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Tutup"
            onClick={onClose}
            className="size-8 sm:size-9 rounded-full text-muted-foreground hover:bg-muted active:scale-95 transition-transform"
          >
            <X className="size-4 sm:size-5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none">
        {media}
        <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">{children}</div>
      </div>

      <div className="border-t bg-card px-4 py-3 sm:px-6 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {footer}
      </div>
    </>
  )

  if (isMobile)
    return (
      <Drawer open onOpenChange={(open) => !open && onClose()} showSwipeHandle>
        <DrawerContent className="rounded-t-3xl max-h-[92dvh]">{content(DrawerTitle as unknown as typeof DialogTitle, DrawerDescription as unknown as typeof DialogDescription)}</DrawerContent>
      </Drawer>
    )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className={`flex max-h-[88dvh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl ${maxWidth}`}>
        {content(DialogTitle, DialogDescription)}
      </DialogContent>
    </Dialog>
  )
}
