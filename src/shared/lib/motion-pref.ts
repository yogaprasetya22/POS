const KEY = 'pos_motion'

/**
 * "full" (bawaan) = animasi selalu aktif walau sistem meminta gerakan dikurangi.
 * "system" = mengikuti setelan sistem; hanya bila pengguna memilihnya sendiri.
 */
export function getMotionPref(): 'system' | 'full' {
  try {
    return localStorage.getItem(KEY) === 'system' ? 'system' : 'full'
  } catch {
    return 'full'
  }
}

export function setMotionPref(v: 'system' | 'full') {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* penyimpanan tidak tersedia */
  }
  window.location.reload() // MotionConfig dibaca saat aplikasi dimulai
}
