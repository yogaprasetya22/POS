import { useEffect } from 'react'
import { initLocale, setOverrides } from '@shared/i18n'
import { useStaff } from '@shared/lib/auth'
import { useStoreConfig } from '@shared/lib/store-config'
import { supabase } from '@shared/lib/supabase'

/** Memuat bahasa bawaan toko dan kalimat yang disunting admin saat staf masuk. */
export function I18nBoot() {
  const staff = useStaff()
  const { config } = useStoreConfig(staff.storeId)

  useEffect(() => {
    if (config?.locale) initLocale(config.locale)
  }, [config?.locale])

  useEffect(() => {
    if (!staff.storeId) return
    void supabase.from('message_overrides').select('locale,key,text').then(({ data }) => setOverrides(data ?? []))
  }, [staff.storeId])

  return null
}
