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
  onConfirm: () => void
}

/** Tombol yang meminta konfirmasi lewat AlertDialog sebelum menjalankan aksi berbahaya. */
export function ConfirmButton({ title, description, confirmLabel = 'Ya, lanjutkan', onConfirm, children, ...buttonProps }: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button {...buttonProps} />}>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
