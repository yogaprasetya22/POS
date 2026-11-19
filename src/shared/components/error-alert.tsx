import { AlertCircle } from 'lucide-react'
import { m } from 'motion/react'
import { useRef } from 'react'
import { Alert, AlertDescription } from '@shared/components/ui/alert'
import { friendlyError } from '@shared/lib/friendly-error'
import { Collapse } from './motion'

/**
 * Kotak pesan gagal: pesan teknis diterjemahkan ke bahasa sehari-hari beserta cara memperbaikinya.
 * Muncul dengan membuka ruang halus (tidak "meloncat"), dan sedikit bergetar saat pesan baru masuk.
 */
export function ErrorAlert({ message, className }: { message: string; className?: string }) {
  // pesan terakhir disimpan supaya isinya tetap terlihat selama animasi menutup
  const last = useRef(message)
  if (message) last.current = message
  const shown = message || last.current
  return (
    <Collapse open={!!message}>
      <m.div key={shown} animate={{ x: [0, -5, 5, -3, 3, 0] }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <Alert variant="destructive" role="alert" className={className}>
          <AlertCircle />
          <AlertDescription className="text-base">{friendlyError(shown)}</AlertDescription>
        </Alert>
      </m.div>
    </Collapse>
  )
}
