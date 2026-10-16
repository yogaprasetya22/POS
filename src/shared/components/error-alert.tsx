import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@shared/components/ui/alert'

export function ErrorAlert({ message, className }: { message: string; className?: string }) {
  if (!message) return null
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
