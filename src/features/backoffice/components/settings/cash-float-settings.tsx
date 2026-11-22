import { useEffect, useState } from 'react'
import { CurrencyInput } from '@shared/components/currency-input'
import { ErrorAlert } from '@shared/components/error-alert'
import { SectionCard } from '@shared/components/page'
import { Button } from '@shared/components/ui/button'
import { rpc } from '@shared/lib/api'
import { rupiah } from '@shared/lib/utils'

/** Modal laci tetap: saat tutup kasir, uang di atas jumlah ini disetor ke owner, sisanya jadi modal shift berikutnya. */
export function CashFloatSettings() {
  const [amount, setAmount] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    void rpc('shift_status').then(({ data }) => {
      const f = (data as { cash_float?: number } | null)?.cash_float
      if (typeof f === 'number') {
        setSaved(f)
        setAmount(String(f))
      }
    })
  }, [])

  const save = async () => {
    setBusy(true)
    setError('')
    const n = Number(amount) || 0
    const { error: err } = await rpc('set_cash_float', { p_amount: n })
    setBusy(false)
    if (err) return setError(err.message)
    setSaved(n)
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }

  return (
    <SectionCard title="Modal laci kasir" hint="Uang receh yang selalu ditinggal di laci untuk kembalian">
      <div className="space-y-3">
        <div className="flex gap-2">
          <CurrencyInput aria-label="Modal laci" value={amount} onValueChange={setAmount} className="h-11 flex-1" placeholder="100.000" />
          <Button className="h-11" disabled={busy || amount === '' || Number(amount) === saved} onClick={save}>
            {ok ? 'Tersimpan ✓' : busy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Saat tutup kasir, uang di atas {rupiah(Number(amount) || 0)} disetor ke owner. Sisanya ({rupiah(Number(amount) || 0)}) ditinggal sebagai modal shift berikutnya, jadi uang laci tidak menumpuk.
        </p>
        <ErrorAlert message={error} />
      </div>
    </SectionCard>
  )
}
