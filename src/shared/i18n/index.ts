import { useSyncExternalStore } from 'react'
import { ERROR_CODES, LEGACY, MESSAGES, type Locale, type MsgKey } from './catalog'

export { LOCALES, MESSAGES, type Locale, type MsgKey } from './catalog'

const PREF_KEY = 'pos_locale'
const isLocale = (v: unknown): v is Locale => v === 'id' || v === 'jaksel' || v === 'en'

function savedLocale(): Locale | null {
  try {
    const v = localStorage.getItem(PREF_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

type State = { locale: Locale; overrides: Record<string, string>; version: number }
let state: State = { locale: savedLocale() ?? 'id', overrides: {}, version: 0 }
const listeners = new Set<() => void>()
const emit = () => {
  state = { ...state, version: state.version + 1 }
  listeners.forEach((l) => l())
}

/** Bahasa bawaan toko dipakai selama pengguna belum memilih sendiri. */
export function initLocale(storeLocale: Locale) {
  if (savedLocale()) return
  if (state.locale !== storeLocale) {
    state = { ...state, locale: storeLocale }
    emit()
  }
}
export function setLocale(l: Locale) {
  try {
    localStorage.setItem(PREF_KEY, l)
  } catch {
    /* penyimpanan tidak tersedia */
  }
  state = { ...state, locale: l }
  emit()
}
export const hasUserLocale = () => savedLocale() !== null
/** Timpaan kalimat dari admin: kunci `${locale}:${key}`. */
export function setOverrides(rows: { locale: string; key: string; text: string }[]) {
  state = { ...state, overrides: Object.fromEntries(rows.map((r) => [`${r.locale}:${r.key}`, r.text])) }
  emit()
}

const MONEY = new Set(['opening', 'expected', 'diff', 'amount', 'counted'])
const rupiah = (n: number) => `Rp${Math.abs(n).toLocaleString('id-ID')}`

function fill(template: string, params: Record<string, unknown> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k]
    if (v === undefined || v === null) return `{${k}}`
    return MONEY.has(k) && typeof v === 'number' ? rupiah(v) : String(v)
  })
}

/** Teks aktif sebuah kunci untuk bahasa tertentu: timpaan admin → kamus bawaan → Indonesia. */
export function template(key: MsgKey, locale: Locale = state.locale): string {
  return state.overrides[`${locale}:${key}`] ?? MESSAGES[key][locale] ?? MESSAGES[key].id
}
export function defaultTemplate(key: MsgKey, locale: Locale): string {
  return MESSAGES[key][locale]
}
export const isOverridden = (key: MsgKey, locale: Locale) => `${locale}:${key}` in state.overrides

export function t(key: MsgKey, params?: Record<string, unknown>, locale: Locale = state.locale): string {
  return fill(template(key, locale), params)
}
export { fill as render }

/**
 * Ubah pesan mentah dari server jadi kalimat sesuai bahasa aktif.
 * Bentuk kode `E:KODE` atau `E:KODE:{json}`; teks Indonesia lama dicocokkan lewat LEGACY; selain itu dikembalikan apa adanya.
 */
export function msg(raw: string): string {
  const coded = /^E:([A-Z_]+)(?::(.*))?$/s.exec(raw.trim())
  if (coded) {
    const key = ERROR_CODES[coded[1]]
    if (key) {
      let params: Record<string, unknown> = {}
      try {
        params = coded[2] ? JSON.parse(coded[2]) : {}
      } catch {
        /* parameter rusak: tampilkan kalimat tanpa isian */
      }
      return t(key, params)
    }
  }
  for (const [re, key] of LEGACY) if (re.test(raw)) return t(key)
  return raw
}

/** Hook: render ulang saat bahasa atau timpaan berubah. */
export function useI18n() {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
  return { locale: s.locale, t, msg, setLocale }
}
