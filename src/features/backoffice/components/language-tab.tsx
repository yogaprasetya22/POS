import { Check, Pencil, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorAlert } from '@shared/components/error-alert'
import { FilterChips, PageHeader } from '@shared/components/page'
import { Panel } from '@shared/components/panel'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { LOCALES, MESSAGES, defaultTemplate, initLocale, isOverridden, render, setOverrides, template, useI18n, type Locale, type MsgKey } from '@shared/i18n'
import { rpc } from '@shared/lib/api'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
import { supabase } from '@shared/lib/supabase'

const KEYS = Object.keys(MESSAGES) as MsgKey[]
const GROUPS = [...new Set(KEYS.map((k) => MESSAGES[k].group))]
type Msg = { desc: string; params?: Record<string, string | number> }

/** Contoh kalimat tiap bahasa, supaya pemilik bisa membayangkan nadanya sebelum memilih. */
const SAMPLE: Record<Locale, string> = {
  id: 'Modal awal tidak valid. Periksa lagi.',
  jaksel: 'Modal awalnya nggak valid nih, cek lagi ya.',
  en: 'Opening cash is not valid. Please check again.',
}

const refreshOverrides = async () => {
  const { data } = await supabase.from('message_overrides').select('locale,key,text')
  setOverrides(data ?? [])
}

/** Halaman Bahasa & pesan: 1) pilih bahasa toko, 2) ubah kalimat peringatan satu per satu lewat panel. */
export function LanguageTab() {
  const { storeId } = useStaff()
  const { config, reload } = useStoreConfig(storeId)
  useI18n() // render ulang saat timpaan berubah
  const [lang, setLang] = useState<Locale>(config?.locale ?? 'id')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<MsgKey | null>(null)
  const [error, setError] = useState('')
  const storeLocale = config?.locale ?? 'id'

  const setStoreLocale = async (l: Locale) => {
    const { error: err } = await rpc('save_store_locale', { p_locale: l })
    if (err) return setError(err.message)
    setError('')
    reload()
    initLocale(l)
    toast.success(`Bahasa toko sekarang ${LOCALES.find((x) => x.value === l)?.label}`)
  }

  const term = q.trim().toLowerCase()
  const match = (k: MsgKey) => !term || (MESSAGES[k] as Msg).desc.toLowerCase().includes(term) || template(k, lang).toLowerCase().includes(term)
  const edited = KEYS.filter((k) => isOverridden(k, lang)).length

  return (
    <div className="space-y-8">
      <PageHeader title="Bahasa & pesan" description="Pilih bahasa toko, lalu ubah kalimat peringatan supaya mudah dimengerti timmu." />
      <ErrorAlert message={error} />

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">1. Bahasa toko</h2>
          <p className="text-base text-muted-foreground">Dipakai semua staf, kecuali yang memilih bahasa sendiri dari menu akun.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Bahasa toko">
          {LOCALES.map((l) => {
            const on = storeLocale === l.value
            return (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => !on && void setStoreLocale(l.value)}
                className={`rounded-2xl border-2 bg-card p-4 text-left transition-colors ${on ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
              >
                <span className="flex items-center justify-between gap-2 text-lg font-bold">
                  {l.label}
                  {on && <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-sm text-primary-foreground"><Check className="size-4" aria-hidden /> Dipakai</span>}
                </span>
                <span className="mt-1 block text-base text-muted-foreground">“{SAMPLE[l.value]}”</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">2. Kalimat peringatan</h2>
          <p className="text-base text-muted-foreground">Kalimat yang muncul saat ada masalah. Tekan “Ubah” untuk menggantinya.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips id="edit-locale" label="Bahasa" value={lang} onChange={setLang} options={LOCALES.map((l) => ({ value: l.value, label: l.label }))} />
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kalimat…" aria-label="Cari kalimat" className="h-12 pl-11 text-base" />
          </div>
        </div>
        {edited > 0 && <p className="text-base text-muted-foreground">{edited} kalimat sudah kamu ubah untuk bahasa ini.</p>}

        {GROUPS.map((g) => {
          const keys = KEYS.filter((k) => MESSAGES[k].group === g && match(k))
          if (!keys.length) return null
          return (
            <div key={g} className="space-y-2">
              <h3 className="text-base font-bold text-muted-foreground">{g}</h3>
              <ul className="divide-y rounded-2xl border-2 bg-card">
                {keys.map((k) => {
                  const m = MESSAGES[k] as Msg
                  return (
                    <li key={k} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold">
                          {m.desc}
                          {isOverridden(k, lang) && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-sm font-bold text-sky-900 dark:bg-sky-500/20 dark:text-sky-200">Sudah diubah</span>}
                        </p>
                        <p className="text-base text-muted-foreground">“{render(template(k, lang), m.params)}”</p>
                      </div>
                      <Button variant="outline" className="h-12 shrink-0 border-2 px-4 text-base" aria-label={`Ubah kalimat: ${m.desc}`} onClick={() => setOpen(k)}>
                        <Pencil /> Ubah
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
        {GROUPS.every((g) => !KEYS.some((k) => MESSAGES[k].group === g && match(k))) && (
          <p className="rounded-2xl border-2 border-dashed p-6 text-center text-base text-muted-foreground">Tidak ada kalimat yang cocok. Coba kata lain.</p>
        )}
      </section>

      {open && <MessageEditor k={open} lang={lang} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Panel ubah satu kalimat: teks, tombol sisip bagian otomatis, pratinjau, simpan / kembalikan. */
function MessageEditor({ k, lang, onClose }: { k: MsgKey; lang: Locale; onClose: () => void }) {
  const m = MESSAGES[k] as Msg
  const [text, setText] = useState(template(k, lang))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const custom = isOverridden(k, lang)
  const label = LOCALES.find((l) => l.value === lang)?.label

  const save = async (value: string) => {
    setBusy(true)
    const { error: err } = await rpc('save_message', { p_locale: lang, p_key: k, p_text: value })
    setBusy(false)
    if (err) return setError(err.message)
    await refreshOverrides()
    toast.success(value ? 'Kalimat tersimpan' : 'Kalimat dikembalikan ke bawaan')
    onClose()
  }

  return (
    <Panel
      onClose={onClose}
      title="Ubah kalimat"
      description={`${m.desc} (${label})`}
      footer={
        <div className="flex w-full flex-col gap-2">
          <ErrorAlert message={error} />
          <Button className="h-12 w-full text-base font-bold" disabled={busy || !text.trim() || text === template(k, lang)} onClick={() => void save(text)}>
            {busy ? 'Menyimpan…' : 'Simpan kalimat'}
          </Button>
          {custom && (
            <Button variant="outline" className="h-12 w-full border-2 text-base" disabled={busy} onClick={() => void save('')}>
              <RotateCcw /> Kembalikan ke kalimat bawaan
            </Button>
          )}
        </div>
      }
    >
      <Textarea value={text} rows={3} maxLength={400} aria-label="Kalimat" autoFocus onChange={(e) => setText(e.target.value)} className="min-h-24 !text-base" />
      {m.params && (
        <div className="space-y-1.5">
          <p className="text-base font-semibold">Bagian yang terisi otomatis (ketuk untuk menyisipkan):</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(m.params).map(([p, v]) => (
              <Button key={p} variant="outline" className="h-11 border-2 text-base" onClick={() => setText((t) => `${t}{${p}}`)}>
                {`{${p}}`} <span className="text-muted-foreground">= {String(v)}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl bg-muted p-3">
        <p className="text-sm font-semibold text-muted-foreground">Yang dilihat staf:</p>
        <p className="text-base">{render(text, m.params) || '—'}</p>
      </div>
      {custom && <p className="text-base text-muted-foreground">Kalimat bawaan: “{render(defaultTemplate(k, lang), m.params)}”</p>}
    </Panel>
  )
}
