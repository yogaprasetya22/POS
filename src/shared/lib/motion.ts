/** Satu bahasa gerak untuk seluruh aplikasi: pegas dengan sedikit overshoot (terasa "cair"), hanya transform/opacity. */
export const liquid = { type: 'spring', stiffness: 380, damping: 26, mass: 0.9 } as const
export const liquidSoft = { type: 'spring', stiffness: 220, damping: 26 } as const
