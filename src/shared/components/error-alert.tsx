import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@shared/components/ui/alert'
import { friendlyError } from '@shared/lib/friendly-error'

/** Kotak pesan gagal: pesan teknis diterjemahkan ke bahasa sehari-hari beserta cara memperbaikinya. */
export function ErrorAlert({ message, className }: { message: string; className?: string }) {
  if (!message) return null
  return (
    <Alert variant="destructive" role="alert" className={className}>
      <AlertCircle />
      <AlertDescription className="text-base">{friendlyError(message)}</AlertDescription>
    </Alert>
  )
}
