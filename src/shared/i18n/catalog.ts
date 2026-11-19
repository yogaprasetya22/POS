export type Locale = 'id' | 'jaksel' | 'en'
export const LOCALES: { value: Locale; label: string; hint: string }[] = [
  { value: 'id', label: 'Indonesia', hint: 'Baku dan sopan' },
  { value: 'jaksel', label: 'Santai (Jaksel)', hint: 'Gaya anak Jaksel' },
  { value: 'en', label: 'English', hint: 'English' },
]

export type Msg = {
  /** Penjelasan untuk admin: kapan kalimat ini muncul. */
  desc: string
  group: 'Shift & kas' | 'Pembayaran' | 'Pembatalan & PIN' | 'Toko & pesanan' | 'Umum'
  /** Nama parameter yang boleh dipakai di kalimat, ditulis {nama}. */
  params?: Record<string, string | number>
  id: string
  jaksel: string
  en: string
}

/**
 * Kamus pesan. Kunci yang diawali `shift.` dst. dipakai langsung oleh UI; kode galat dari database
 * (mis. E:SHIFT_HELD) dipetakan ke kunci lewat ERROR_CODES. Parameter uang (opening, expected, diff, amount) otomatis
 * diformat jadi Rupiah. Admin bisa menimpa tiap kalimat per toko (tabel message_overrides).
 */
export const MESSAGES = {
  'shift.held': {
    group: 'Shift & kas',
    desc: 'Kasir lain mencoba membuka shift padahal laci masih dipegang.',
    params: { who: 'kasir@pos.test', at: '01.23' },
    id: 'Laci masih dipegang {who} sejak {at}. Untuk ganti kasir, shift itu harus ditutup dan dihitung dulu (serah terima).',
    jaksel: 'Eh, lacinya masih dipegang {who} nih sejak {at}. Minta dia tutup shift dulu ya, atau manager bisa tutup paksa.',
    en: 'The drawer is still held by {who} since {at}. Close and count that shift first to switch cashiers.',
  },
  'shift.handover_diff': {
    group: 'Shift & kas',
    desc: 'Modal awal yang diketik berbeda dari uang yang diserahkan shift sebelumnya.',
    params: { opening: 175000, expected: 170000 },
    id: 'Modal awal {opening} berbeda dari uang serah terima {expected}. Tulis catatan penyebabnya.',
    jaksel: 'Hmm, modal awal {opening} kok beda sama uang serah terima {expected}? Kasih catatan dulu ya biar jelas.',
    en: 'Opening cash {opening} differs from the handover amount {expected}. Please add a note explaining why.',
  },
  'shift.taken': {
    group: 'Shift & kas',
    desc: 'Dua kasir menekan "Buka shift" hampir bersamaan.',
    id: 'Shift baru saja dibuka oleh kasir lain.',
    jaksel: 'Yah, shift-nya baru aja dibuka kasir lain.',
    en: 'Another cashier just opened the shift.',
  },
  'shift.opening_invalid': { group: 'Shift & kas', desc: 'Modal awal kosong atau negatif.', id: 'Modal awal tidak valid.', jaksel: 'Modal awalnya nggak valid nih, cek lagi ya.', en: 'Invalid opening cash.' },
  'shift.amount_invalid': { group: 'Shift & kas', desc: 'Jumlah uang yang dihitung tidak valid.', id: 'Jumlah uang tidak valid.', jaksel: 'Jumlah uangnya nggak valid, cek lagi ya.', en: 'Invalid amount.' },
  'shift.none_open': { group: 'Shift & kas', desc: 'Menutup shift padahal tidak ada shift terbuka.', id: 'Tidak ada shift yang terbuka.', jaksel: 'Lagi nggak ada shift yang kebuka.', en: 'There is no open shift.' },
  'shift.diff_needs_note': {
    group: 'Shift & kas',
    desc: 'Menutup shift dengan selisih tanpa catatan penyebab.',
    params: { diff: -5000 },
    id: 'Ada selisih {diff}. Tulis catatan penyebabnya dulu.',
    jaksel: 'Ada selisih {diff} nih. Tulis dulu ya penyebabnya biar semua paham.',
    en: 'There is a difference of {diff}. Please write the reason first.',
  },
  'shift.force_reason': { group: 'Shift & kas', desc: 'Tutup paksa tanpa alasan.', id: 'Alasan tutup paksa wajib diisi.', jaksel: 'Alasan tutup paksanya wajib diisi ya.', en: 'A reason is required to force-close a shift.' },
  'shift.review_invalid': { group: 'Shift & kas', desc: 'Meninjau shift yang belum ditutup.', id: 'Shift belum ditutup atau tidak ditemukan.', jaksel: 'Shift-nya belum ditutup atau nggak ketemu.', en: 'The shift is not closed yet or was not found.' },
  'shift.required': {
    group: 'Shift & kas',
    desc: 'Kasir menerima pembayaran sebelum membuka shift.',
    id: 'Buka shift kasir dulu sebelum menerima pembayaran.',
    jaksel: 'Buka shift dulu ya sebelum terima pembayaran.',
    en: 'Open your cashier shift before accepting payments.',
  },

  'shift.ui.not_open_title': { group: 'Shift & kas', desc: 'Judul bar saat shift belum dibuka.', id: 'Shift belum dibuka', jaksel: 'Shift belum dibuka nih', en: 'Shift not open yet' },
  'shift.ui.hint_first': {
    group: 'Shift & kas',
    desc: 'Petunjuk di bar buka shift (shift pertama toko).',
    id: 'Hitung uang receh di laci, isi sebagai modal awal untuk mulai menerima pembayaran.',
    jaksel: 'Itung dulu uang receh di laci, isi jadi modal awal biar bisa mulai terima pembayaran.',
    en: 'Count the change in the drawer and enter it as opening cash to start taking payments.',
  },
  'shift.ui.hint_handover': {
    group: 'Shift & kas',
    desc: 'Petunjuk di bar buka shift saat ada uang serah terima dari shift sebelumnya.',
    params: { who: 'kasir@pos.test', amount: 170000 },
    id: 'Modal di laci dari {who}: {amount}. Hitung uang di laci, pastikan sama.',
    jaksel: 'Modal di laci dari {who}: {amount}. Itung dulu isi lacinya, pastiin sama ya.',
    en: 'Drawer float from {who}: {amount}. Count the drawer and make sure it matches.',
  },
  'shift.ui.opening_why': {
    group: 'Shift & kas',
    desc: 'Penjelasan singkat kenapa modal awal diminta.',
    id: 'Modal awal = uang receh di laci untuk kembalian. Dipakai untuk menghitung selisih saat shift ditutup.',
    jaksel: 'Modal awal itu uang receh di laci buat kembalian. Nanti dipakai buat ngitung selisih pas tutup shift.',
    en: 'Opening cash is the change in the drawer. It is used to work out any difference when the shift closes.',
  },
  'shift.ui.opening_differs': {
    group: 'Shift & kas',
    desc: 'Peringatan di bar buka shift saat angka yang diketik beda dari serah terima.',
    params: { diff: 5000 },
    id: 'Berbeda {diff} dari uang serah terima. Jelaskan penyebabnya.',
    jaksel: 'Beda {diff} dari uang serah terima nih. Jelasin dulu penyebabnya ya.',
    en: 'This is {diff} off from the handover amount. Please explain why.',
  },
  'shift.ui.held_title': { group: 'Shift & kas', desc: 'Judul saat laci dipegang kasir lain.', params: { who: 'kasir@pos.test' }, id: 'Laci dipegang {who}', jaksel: 'Lacinya lagi dipegang {who}', en: 'Drawer held by {who}' },
  'shift.ui.held_hint': {
    group: 'Shift & kas',
    desc: 'Penjelasan saat laci dipegang kasir lain.',
    params: { at: '01.23' },
    id: 'Shift terbuka sejak {at}. Untuk mengganti kasir, shift itu harus ditutup dan dihitung dulu (serah terima).',
    jaksel: 'Shift-nya kebuka dari jam {at}. Biar bisa ganti kasir, shift itu harus ditutup dan dihitung dulu ya (serah terima).',
    en: 'That shift has been open since {at}. To switch cashiers it must be closed and counted first (handover).',
  },
  'shift.ui.diff_exact': { group: 'Shift & kas', desc: 'Hasil hitung kas pas.', id: 'Kas pas, tidak ada selisih.', jaksel: 'Kas pas, aman nggak ada selisih!', en: 'Cash matches. No difference.' },
  'shift.ui.diff_short': {
    group: 'Shift & kas',
    desc: 'Uang di laci kurang dari seharusnya.',
    params: { amount: 5000 },
    id: 'Uang kurang {amount} dari seharusnya. Jelaskan penyebabnya di catatan.',
    jaksel: 'Uangnya kurang {amount} dari yang seharusnya nih. Tulis penyebabnya di catatan ya.',
    en: 'Cash is {amount} short. Please explain in the note.',
  },
  'shift.ui.diff_over': {
    group: 'Shift & kas',
    desc: 'Uang di laci lebih dari seharusnya.',
    params: { amount: 5000 },
    id: 'Uang lebih {amount} dari seharusnya. Jelaskan penyebabnya di catatan.',
    jaksel: 'Uangnya lebih {amount} dari yang seharusnya nih. Tulis penyebabnya di catatan ya.',
    en: 'Cash is {amount} over. Please explain in the note.',
  },
  'shift.ui.closed_hint': { group: 'Shift & kas', desc: 'Setelah shift ditutup.', id: 'Serahkan uang ini ke kasir berikutnya.', jaksel: 'Serahin uang ini ke kasir berikutnya ya.', en: 'Hand this cash to the next cashier.' },

  'pay.failed': { group: 'Pembayaran', desc: 'Pembayaran ditolak (sudah dibayar, dibatalkan, atau uang kurang).', id: 'Pembayaran gagal: pesanan sudah dibayar, dibatalkan, atau uang kurang.', jaksel: 'Pembayarannya gagal nih: pesanannya udah dibayar, dibatalin, atau uangnya kurang.', en: 'Payment failed: the order is already paid, cancelled, or the cash is not enough.' },
  'pay.voucher_used': { group: 'Pembayaran', desc: 'Voucher sudah dipakai pesanan lain.', id: 'Voucher sudah dipakai.', jaksel: 'Vouchernya udah kepake, nih.', en: 'This voucher has already been used.' },
  'pay.points_short': { group: 'Pembayaran', desc: 'Poin member tidak cukup.', id: 'Poin member tidak cukup.', jaksel: 'Poin membernya nggak cukup.', en: 'Not enough member points.' },

  'pin.wrong': { group: 'Pembatalan & PIN', desc: 'PIN supervisor salah.', id: 'PIN salah.', jaksel: 'PIN-nya salah, coba lagi ya.', en: 'Wrong PIN.' },
  'pin.locked': { group: 'Pembatalan & PIN', desc: 'PIN terkunci setelah 5 kali salah.', id: 'PIN terkunci sementara, coba lagi nanti.', jaksel: 'PIN-nya dikunci dulu sebentar, coba lagi nanti ya.', en: 'PIN is temporarily locked. Try again later.' },
  'pin.not_set': { group: 'Pembatalan & PIN', desc: 'Owner belum mengatur PIN supervisor.', id: 'PIN supervisor belum diatur owner.', jaksel: 'Owner belum atur PIN supervisor nih.', en: 'The owner has not set a supervisor PIN yet.' },
  'reverse.reason_required': { group: 'Pembatalan & PIN', desc: 'Void/refund tanpa alasan.', id: 'Alasan wajib diisi.', jaksel: 'Alasannya wajib diisi ya.', en: 'A reason is required.' },

  'plan.expired': { group: 'Toko & pesanan', desc: 'Langganan toko berakhir.', id: 'Langganan toko sudah berakhir.', jaksel: 'Langganan tokonya udah habis nih.', en: 'The store subscription has expired.' },
  'store.closed': { group: 'Toko & pesanan', desc: 'Pelanggan memesan saat toko nonaktif.', id: 'Toko sedang tutup.', jaksel: 'Tokonya lagi tutup, yaa.', en: 'The store is closed.' },
  'queue.full': { group: 'Toko & pesanan', desc: 'Antrean pesanan publik penuh.', id: 'Antrean sedang penuh, coba lagi beberapa menit lagi.', jaksel: 'Antreannya lagi penuh banget, coba lagi beberapa menit ya.', en: 'The queue is full right now. Please try again in a few minutes.' },
  'table.unknown': { group: 'Toko & pesanan', desc: 'Nomor meja tidak terdaftar.', id: 'Nomor meja tidak terdaftar.', jaksel: 'Nomor mejanya nggak terdaftar, cek lagi ya.', en: 'This table number is not registered.' },
  'table.busy': { group: 'Toko & pesanan', desc: 'Meja sudah punya terlalu banyak pesanan menunggu.', id: 'Meja ini sudah punya pesanan menunggu pembayaran.', jaksel: 'Meja ini udah punya pesanan yang nunggu dibayar nih.', en: 'This table already has an order waiting for payment.' },

  forbidden: { group: 'Umum', desc: 'Pengguna mencoba aksi yang tidak diizinkan perannya.', id: 'Kamu tidak punya akses untuk melakukan ini.', jaksel: 'Kamu nggak punya akses buat ini, ya.', en: 'You do not have permission to do this.' },
} as const satisfies Record<string, Msg>

export type MsgKey = keyof typeof MESSAGES

/** Kode galat dari database (E:KODE:{json}) → kunci pesan. */
export const ERROR_CODES: Record<string, MsgKey> = {
  SHIFT_HELD: 'shift.held',
  SHIFT_HANDOVER_DIFF: 'shift.handover_diff',
  SHIFT_TAKEN: 'shift.taken',
  SHIFT_OPENING_INVALID: 'shift.opening_invalid',
  AMOUNT_INVALID: 'shift.amount_invalid',
  SHIFT_NONE: 'shift.none_open',
  SHIFT_DIFF_NEEDS_NOTE: 'shift.diff_needs_note',
  SHIFT_FORCE_REASON: 'shift.force_reason',
  SHIFT_REVIEW_INVALID: 'shift.review_invalid',
}

/** Pesan lama berupa teks Indonesia dari fungsi SQL yang belum memakai kode. */
export const LEGACY: [RegExp, MsgKey][] = [
  [/Buka shift kasir dulu/i, 'shift.required'],
  [/Pembayaran gagal/i, 'pay.failed'],
  [/Voucher sudah dipakai/i, 'pay.voucher_used'],
  [/Poin member tidak cukup/i, 'pay.points_short'],
  [/^PIN salah$/i, 'pin.wrong'],
  [/PIN terkunci/i, 'pin.locked'],
  [/PIN supervisor belum diatur/i, 'pin.not_set'],
  [/^Alasan wajib diisi/i, 'reverse.reason_required'],
  [/Langganan toko berakhir/i, 'plan.expired'],
  [/Toko sedang tutup/i, 'store.closed'],
  [/Antrean sedang penuh/i, 'queue.full'],
  [/Nomor meja tidak terdaftar/i, 'table.unknown'],
  [/Meja ini sudah punya pesanan/i, 'table.busy'],
  [/^forbidden$/i, 'forbidden'],
]
