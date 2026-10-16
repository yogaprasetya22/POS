import { Check, Copy, ExternalLink, QrCode, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'

/**
 * Komponen Tautan & QR Meja Pelanggan
 * Membantu owner menyalin link umum, link meja spesifik (QR meja), atau link bungkus/takeaway.
 */
export function StoreLink({ slug }: { slug: string }) {
  const [copiedGeneral, setCopiedGeneral] = useState(false)
  const [copiedTable, setCopiedTable] = useState(false)
  const [copiedTakeaway, setCopiedTakeaway] = useState(false)
  const [tableNo, setTableNo] = useState('1')

  const baseUrl = `${window.location.origin}/s/${slug}`
  const tableUrl = `${baseUrl}?meja=${encodeURIComponent(tableNo || '1')}`
  const takeawayUrl = `${baseUrl}?tipe=bungkus`

  const copy = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="rounded-2xl border">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            <CardTitle className="text-base font-bold">Tautan Pemesanan Pelanggan</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            /{slug}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Bagikan link ini atau cetak dalam bentuk QR Code agar pelanggan dapat langsung memesan lewat ponsel masing-masing.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Tautan Utama */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Tautan Utama Toko (Umum)</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={baseUrl}
              aria-label="Tautan utama toko"
              className="text-xs font-mono h-9 rounded-xl"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(baseUrl, setCopiedGeneral)}
              className="gap-1.5 text-xs h-9 rounded-xl shrink-0"
            >
              {copiedGeneral ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copiedGeneral ? 'Tersalin' : 'Salin'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 rounded-xl shrink-0"
              nativeButton={false}
              render={<a href={baseUrl} target="_blank" rel="noreferrer" title="Buka katalog pelanggan" />}
            >
              <ExternalLink className="size-4" />
            </Button>
          </div>
        </div>

        {/* Generator Tautan QR Meja */}
        <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <UtensilsCrossed className="size-3.5 text-primary" />
              Generator Tautan Meja (Untuk Stiker QR Meja)
            </span>
            <span className="text-[11px] text-muted-foreground">Otomatis terisi nomor meja</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24">
              <Input
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                placeholder="No. Meja"
                aria-label="Nomor meja"
                className="text-xs h-9 rounded-xl text-center font-bold"
              />
            </div>
            <Input
              readOnly
              value={tableUrl}
              aria-label="Tautan meja"
              className="text-xs font-mono h-9 rounded-xl flex-1 bg-background"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copy(tableUrl, setCopiedTable)}
              className="gap-1 text-xs h-9 rounded-xl shrink-0"
            >
              {copiedTable ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copiedTable ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
        </div>

        {/* Generator Tautan Bawa Pulang */}
        <div className="flex items-center justify-between p-3 rounded-xl border bg-background text-xs">
          <div className="min-w-0 pr-2">
            <span className="font-semibold block text-foreground">Tautan Bawa Pulang (Takeaway)</span>
            <span className="text-muted-foreground font-mono text-[11px] truncate block">{takeawayUrl}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copy(takeawayUrl, setCopiedTakeaway)}
            className="gap-1.5 text-xs h-8 rounded-xl shrink-0"
          >
            {copiedTakeaway ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copiedTakeaway ? 'Tersalin' : 'Salin'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
