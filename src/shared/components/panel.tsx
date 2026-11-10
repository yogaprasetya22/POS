import { X } from 'lucide-react'
import { m } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@shared/components/ui/drawer'
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
export function Panel({ onClose, title, description, media, aside, footer, maxWidth = 'sm:max-w-xl', children }: Props) {
  const isMobile = useIsMobile()
  // Mulai tertutup lalu buka satu frame kemudian, supaya transisi masuk Base UI ikut jalan.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const close = () => {
    setOpen(false)
    setTimeout(onClose, 220)
  }

  const heading = (Title: typeof DialogTitle | typeof DrawerTitle, Description: typeof DialogDescription | typeof DrawerDescription) => (
    <>
      <div className="min-w-0 flex-1">
        <Title className="text-lg font-semibold leading-tight">{title}</Title>
        <Description className={description ? 'mt-1 truncate' : 'sr-only'}>{description ?? title}</Description>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        <Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={close}>
          <X />
        </Button>
      </div>
    </>
  )

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none">
      {media}
      <div className="space-y-4 p-4">{children}</div>
    </div>
  )

  // Efek bubble: isi panel membal sedikit saat muncul (pegas dengan overshoot)
  const bubble = (from: { y?: number; scale?: number }, el: ReactNode) => (
    <m.div
      initial={{ opacity: 0, ...from }}
      animate={open ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.9 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {el}
    </m.div>
  )

  if (isMobile)
    return (
      <Drawer open={open} onOpenChange={(o) => !o && close()} showSwipeHandle>
        <DrawerContent className="max-h-[92%]">
          <DrawerHeader className="flex-row items-center border-b pb-3 text-left!">{heading(DrawerTitle, DrawerDescription)}</DrawerHeader>
          {body}
          <DrawerFooter className="border-t pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent showCloseButton={false} className={`flex max-h-[88%] w-full flex-col gap-0 overflow-hidden p-0 ${maxWidth}`}>
        {bubble(
          { scale: 0.82 },
          <>
            <DialogHeader className="flex-row items-center gap-3 border-b p-4">{heading(DialogTitle, DialogDescription)}</DialogHeader>
            {body}
            <DialogFooter className="m-0 rounded-none bg-card sm:flex-col">{footer}</DialogFooter>
          </>,
        )}
      </DialogContent>
    </Dialog>
  )
}
