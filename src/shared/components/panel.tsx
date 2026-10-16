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
  children: ReactNode
}

/** Pola "responsive dialog" shadcn: Drawer (bisa diswipe) di HP, Dialog di tablet/desktop. */
export function Panel({ onClose, title, description, media, aside, footer, children }: Props) {
  const isMobile = useIsMobile()

  const content = (Title: typeof DialogTitle, Description: typeof DialogDescription) => (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1 pr-2">
          <Title className="text-sm sm:text-base font-bold leading-tight">{title}</Title>
          <Description className={description ? 'mt-0.5 text-xs text-muted-foreground truncate' : 'sr-only'}>
            {description ?? title}
          </Description>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {aside}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Tutup"
            onClick={onClose}
            className="size-7 rounded-full text-muted-foreground hover:bg-muted active:scale-95 transition-transform"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none">
        {media}
        <div className="space-y-3 p-3.5 sm:space-y-4 sm:p-4">{children}</div>
      </div>

      <div className="border-t bg-card px-3.5 py-2.5 sm:px-4 sm:py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {footer}
      </div>
    </>
  )

  if (isMobile)
    return (
      <Drawer open onOpenChange={(open) => !open && onClose()} showSwipeHandle>
        <DrawerContent className="rounded-t-3xl">{content(DrawerTitle as unknown as typeof DialogTitle, DrawerDescription as unknown as typeof DialogDescription)}</DrawerContent>
      </Drawer>
    )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
        {content(DialogTitle, DialogDescription)}
      </DialogContent>
    </Dialog>
  )
}
