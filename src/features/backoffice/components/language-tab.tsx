import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { ErrorAlert } from '@shared/components/error-alert'
import { Chip, FilterChips, ListCard, PageHeader } from '@shared/components/page'
import { Button } from '@shared/components/ui/button'
import { Textarea } from '@shared/components/ui/textarea'
import { LOCALES, MESSAGES, defaultTemplate, initLocale, isOverridden, render, setOverrides, template, useI18n, type Locale, type MsgKey } from '@shared/i18n'
import { rpc } from '@shared/lib/api'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
import { supabase } from '@shared/lib/supabase'

const KEYS = Object.keys(MESSAGES) as MsgKey[]
const GROUPS = [...new Set(KEYS.map((k) => MESSAGES[k].group))]

/** Admin mengatur bahasa bawaan toko dan menyunting tiap kalimat peringatan per bahasa. */
export function LanguageTab() {
  const { storeId } = useStaff()
  const { config, reload } = useStoreConfig(storeId)
  useI18n() // render ulang saat timpaan berubah
  const [editing, setEditing] = useState<Locale>('jaksel')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const refreshOverrides = async () => {
    const { data } = await supabase.from('message_overrides').select('locale,key,text')
    setOverrides(data ?? [])
  }

  const setStoreLocale = async (l: Locale) => {
    const { error: err } = await rpc('save_store_locale', { p_locale: l })
    if (err) return setError(err.message)
    setError('')
    reload()
    initLocale(l)
  }

  const draftKey = (k: MsgKey) => `${editing}:${k}`
  const current = (k: MsgKey) => drafts[draftKey(k)] ?? template(k, editing)

  const save = async (k: MsgKey, text: string) => {
    setBusy(k)
    const { error: err } = await rpc('save_message', { p_locale: editing, p_key: k, p_text: text })
    setBusy('')
    if (err) return setError(err.message)
    setError('')
    setDrafts((d) => {
      const n = { ...d }
      delete n[draftKey(k)]
      return n
    })
    await refreshOverrides()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bahasa & pesan"
        description="Atur bahasa bawaan toko dan sunting kalimat peringatan supaya mudah dimengerti timmu. Tiap staf juga bisa memilih bahasanya sendiri dari menu akun."
      />
      <ErrorAlert message={error} />

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Bahasa bawaan toko</h2>
          <p className="text-xs text-muted-foreground">Dipakai staf yang belum memilih bahasa sendiri.</p>
        </div>
        <FilterChips id="store-locale" label="Bahasa bawaan toko" value={config?.locale ?? 'id'} onChange={setStoreLocale} options={LOCALES.map((l) => ({ value: l.value, label: l.label }))} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Kalimat peringatan</h2>
            <p className="text-xs text-muted-foreground">Pilih bahasa yang mau disunting. Tulis {'{nama}'} untuk bagian yang terisi otomatis, mis. {'{who}'} jadi nama kasir.</p>
          </div>
          <FilterChips id="edit-locale" label="Bahasa yang disunting" value={editing} onChange={setEditing} options={LOCALES.map((l) => ({ value: l.value, label: l.label }))} />
        </div>

        {GROUPS.map((g) => (
          <div key={g} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</h3>
            <ListCard className="divide-y">
              {KEYS.filter((k) => MESSAGES[k].group === g).map((k) => {
                const m = MESSAGES[k] as { desc: string; params?: Record<string, string | number> }
                const text = current(k)
                const changed = text !== template(k, editing)
                const custom = isOverridden(k, editing)
                return (
                  <div key={k} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{m.desc}</p>
                      <span className="flex items-center gap-1.5">
                        {custom && <Chip tone="info">Disunting</Chip>}
                        {m.params && Object.keys(m.params).map((p) => <Chip key={p}>{`{${p}}`}</Chip>)}
                      </span>
                    </div>
                    <Textarea value={text} rows={2} maxLength={400} aria-label={`Kalimat: ${m.desc}`} onChange={(e) => setDrafts((d) => ({ ...d, [draftKey(k)]: e.target.value }))} className="min-h-16 text-sm" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Tampil:</span> {render(text, m.params)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="h-10" disabled={!changed || busy === k || text.trim() === ''} onClick={() => save(k, text)}>
                        Simpan
                      </Button>
                      {(custom || changed) && (
                        <Button size="sm" variant="outline" className="h-10" disabled={busy === k} onClick={() => (custom ? save(k, '') : setDrafts((d) => { const n = { ...d }; delete n[draftKey(k)]; return n }))}>
                          <RotateCcw /> {custom ? 'Kembalikan ke bawaan' : 'Batal'}
                        </Button>
                      )}
                      {custom && <span className="self-center text-xs text-muted-foreground">Bawaan: {defaultTemplate(k, editing)}</span>}
                    </div>
                  </div>
                )
              })}
            </ListCard>
          </div>
        ))}
      </section>
    </div>
  )
}
