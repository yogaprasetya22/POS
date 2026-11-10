const KEY = 'pos_motion'

/** "full" = animasi selalu aktif walau sistem meminta gerakan dikurangi; selain itu mengikuti setelan sistem. */
export function getMotionPref(): 'system' | 'full' {
  try {
    return localStorage.getItem(KEY) === 'full' ? 'full' : 'system'
  } catch {
    return 'system'
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
