import type { ComponentProps } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@shared/components/ui/alert-dialog'
import { Button } from '@shared/components/ui/button'

type Props = Omit<ComponentProps<typeof Button>, 'onClick' | 'title'> & {
  title: string
  description?: string
  confirmLabel?: string
  /** Tombol aman yang paling menonjol, mis. "Batal, jangan hapus". */
  cancelLabel?: string
  onConfirm: () => void
}

/**
 * Tombol yang meminta konfirmasi sebelum aksi berbahaya (hapus, batalkan).
 * Pilihan aman ("Batal, jangan") dibuat paling menonjol; aksi berbahaya berwarna merah di bawahnya.
 */
export function ConfirmButton({ title, description, confirmLabel = 'Ya, lanjutkan', cancelLabel = 'Batal, jangan', onConfirm, children, ...buttonProps }: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button {...buttonProps} />}>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-base text-foreground/80">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3">
          <AlertDialogCancel variant="default" className="h-12 text-base font-bold">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" className="h-12 text-base font-bold" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
