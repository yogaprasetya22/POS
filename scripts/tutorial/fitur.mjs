/**
 * Seri video "fitur untuk apa" (gaya penjelasan produk). Satu adegan = satu blok narasi = satu file suara.
 * Urutan adegan global menentukan nomor slide: docs/audio/slide-01.mp3, slide-02.mp3, ...
 * Teks di sini adalah sumber tunggal: `node scripts/tutorial/export-narasi.mjs` menulis docs/narasi.txt dan docs/narasi-peta.md.
 * Narasi ditulis seperti diucapkan (angka dengan huruf, singkatan dieja) dan hanya menyebut hal yang benar-benar ada.
 * Adegan: [narasi, fungsi(page, ctx) | undefined, deskripsi layar].
 */
import { ACC, SLUG, as, clearShifts, customerOrder, digits, finishOrders, go, hold, login, need, restock, scroll } from './roles.mjs'

const ownerLogin = async (p, to) => { await login(p, ACC.owner); await p.goto(to) }

async function cleanVouchers() {
  const o = await as(ACC.owner)
  const rows = (await o.from('vouchers').select('id').eq('note', 'db-check')).data ?? []
  for (const v of rows) await o.rpc('delete_voucher', { p_id: v.id })
}

/** Buka shift kasir lewat database lalu buat pesanan terbayar, agar video fokus ke fitur yang dijelaskan. */
async function openShiftWithPaidOrders(names) {
  const c = await as(ACC.cashier)
  const st = (await c.rpc('shift_status')).data
  await need(c.rpc('open_shift', { p_opening_cash: st?.last_closed?.counted_cash ?? 100000, p_note: '' }))
  for (const n of names) {
    const o = await customerOrder(n)
    await need(c.rpc('pay_order', { p_order_id: o.id, p_method: 'CASH', p_cash_received: 100000 }))
  }
}
async function closeCashierShift() {
  const k = await as(ACC.cashier)
  const s = (await k.rpc('shift_summary')).data
  if (s) await k.rpc('close_shift', { p_counted_cash: s.expected_cash, p_note: '' })
}

export const VIDEOS = {
  pengenalan: {
    file: '01-pengenalan', title: 'Pengenalan WA-Order POS',
    before: async () => { await clearShifts(); await restock() },
    scenes: () => [
      ['Selamat datang di WA-Order POS, aplikasi kasir untuk warung kopi, restoran, dan kafe. Satu aplikasi untuk pesanan pelanggan, kasir, dapur, dan laporan.', (p) => p.goto('/'), 'Halaman depan'],
      ['Pelanggan memesan sendiri dari meja lewat kode QR. Kasir menerima pembayaran, dapur langsung melihat pesanan, dan pemilik memantau penjualan. Semuanya terhubung dan berjalan waktu nyata.', (p) => p.goto(`/s/${SLUG}?meja=T1`), 'Menu pelanggan'],
      ['Aplikasi ini juga menjaga uang Anda. Setiap shift kasir tercatat, selisih kas harus dijelaskan, dan hak akses staf dibatasi sesuai perannya.', (p) => ownerLogin(p, '/admin/shift'), 'Login owner → Shift & audit'],
      ['Mari kita lihat fitur satu per satu.', hold, 'Tetap di Shift & audit'],
    ],
  },

  qr: {
    file: '02-pesan-qr', title: 'Pemesanan lewat QR',
    before: async () => { await clearShifts(); await restock(); return { name: 'Tamu Fitur' } },
    after: async (c) => { await finishOrders([c.name]) },
    scenes: (c) => [
      ['Fitur pertama: pemesanan lewat kode QR. Setiap meja punya kode QR sendiri. Pelanggan tinggal memindainya dengan kamera ponsel, tanpa mengunduh aplikasi dan tanpa membuat akun.', (p) => p.goto(`/s/${SLUG}?meja=T1`), 'Halaman menu dari QR'],
      ['Nomor meja sudah terisi otomatis, jadi pesanan tidak salah meja. Menu tampil lengkap dengan foto, harga, dan promo yang sedang berlaku.', (p) => scroll(p, 500), 'Scroll menu'],
      ['Menu yang kehabisan ditandai dari dapur, sehingga pelanggan tidak memesan sesuatu yang tidak tersedia. Pilihan seperti tingkat gula atau tambahan bisa diatur per menu.', (p) => p.getByRole('button', { name: /Es Teh Lemon/ }).click(), 'Buka menu + pilihan'],
      ['Setelah memilih, pelanggan memeriksa keranjang, mengisi nama, lalu menekan kirim. Pesanan masuk ke kasir lewat WhatsApp, lengkap dengan kode antrean.', async (p) => {
        await p.getByRole('button', { name: /Tambah ke keranjang/ }).click()
        await p.waitForTimeout(400)
        await p.getByRole('button', { name: /Lihat pesanan/ }).click()
        await p.getByLabel('Nama', { exact: true }).fill(c.name)
        await p.getByRole('button', { name: /Kirim (pesanan|ke WhatsApp)/i }).click()
      }, 'Keranjang → kirim → pesan WhatsApp'],
      ['Harga dihitung oleh sistem, bukan oleh ponsel pelanggan. Jadi total di layar pelanggan, kasir, dan struk selalu sama.', hold, 'Pesan WhatsApp'],
    ],
  },

  kasir: {
    file: '03-kasir-pembayaran', title: 'Kasir dan pembayaran',
    before: async () => {
      await clearShifts()
      const names = ['Dimas Anggara', 'Nadia Putri']
      const c = await as(ACC.cashier)
      const st = (await c.rpc('shift_status')).data
      await need(c.rpc('open_shift', { p_opening_cash: st?.last_closed?.counted_cash ?? 100000, p_note: '' }))
      const a = await customerOrder(names[0]), b = await customerOrder(names[1])
      return { a: a.queue_code, b: b.queue_code, names }
    },
    after: async (c) => { await finishOrders(c.names); await closeCashierShift() },
    scenes: (c) => {
      const find = async (p, code, name) => {
        await p.getByLabel('Cari pesanan').fill(code)
        await p.getByLabel('Cari pesanan').press('Enter')
        await p.getByText(`#${code} · ${name} · Meja T1`).waitFor()
      }
      return [
        ['Fitur kedua: kasir. Semua pesanan yang masuk muncul di antrean, baik dari pelanggan maupun yang dibuat sendiri oleh staf.', (p) => login(p, ACC.cashier), 'Login kasir'],
        ['Kasir cukup mencari kode antrean lalu membuka pesanannya. Kasir juga bisa membuat pesanan langsung dari daftar menu untuk pelanggan yang datang ke kasir.', (p) => find(p, c.a, c.names[0]), 'Cari kode antrean'],
        ['Pembayaran bisa tunai, QRIS, atau kartu. Untuk tunai ada tombol uang pas dan pecahan cepat, dan sistem menghitung kembalian. QRIS dan kartu dicatat oleh kasir setelah pembayarannya dipastikan masuk.', (p) => p.getByRole('button', { name: 'Rp100.000' }).click(), 'Pilih tunai, uang diterima'],
        ['Setelah dibayar, struk tampil dan pesanan otomatis terkirim ke dapur. Struk bisa dicetak biasa, atau dilihat dulu lewat pratinjau printer thermal.', async (p) => {
          await p.getByRole('button', { name: 'Terima Pembayaran' }).click()
          await p.getByRole('dialog').getByText('Pembayaran Berhasil').waitFor()
          await p.getByRole('button', { name: 'Pratinjau printer' }).click()
          await p.waitForTimeout(2500)
          await p.keyboard.press('Escape')
          await p.getByRole('dialog').getByRole('button', { name: 'Selesai' }).click()
        }, 'Terima pembayaran → struk → pratinjau printer'],
        ['Untuk meja yang memesan bertahap, ada simpan bill, serta fitur pisah dan gabung bill.', async (p) => {
          await find(p, c.b, c.names[1])
          await p.getByRole('button', { name: /Gabung bill/ }).hover()
        }, 'Pesanan kedua, tombol pisah/gabung bill'],
        ['Jika ada kesalahan, pesanan bisa dibatalkan lewat void atau refund. Kasir butuh pin supervisor, sedangkan manager dan owner tidak. Setiap pembatalan tercatat.', async (p) => {
          await p.getByRole('button', { name: /Riwayat/ }).click()
          await p.waitForTimeout(3000)
          await p.keyboard.press('Escape')
        }, 'Riwayat pesanan hari ini'],
      ]
    },
  },

  shift: {
    file: '04-shift-kas', title: 'Shift dan kas',
    before: async () => { await clearShifts(); return { opening: 0 } },
    after: async () => { await clearShifts() },
    scenes: (c) => [
      ['Fitur ketiga: shift dan kas. Inilah yang menjaga uang di laci tetap bisa dilacak.', (p) => login(p, ACC.cashier), 'Login kasir'],
      ['Satu laci hanya boleh dipegang satu kasir dalam satu waktu. Sebelum menerima pembayaran, kasir membuka shift dan mengisi modal awal. Angkanya sudah terisi otomatis dari uang hasil hitung shift sebelumnya.', async (p) => {
        c.opening = digits(await p.getByLabel('Modal awal (Rp)').inputValue())
      }, 'Bar Buka shift, modal terisi'],
      ['Jika kasir mengisi angka yang berbeda, alasannya wajib ditulis. Jadi tidak ada uang yang berpindah tanpa penjelasan.', hold, 'Bar Buka shift'],
      ['Tekan Buka shift, maka laci kas tercatat atas nama kasir itu. Selama shift berjalan, uang yang masuk atau keluar dari laci, misalnya untuk beli es batu, dicatat lewat kas masuk dan kas keluar.', async (p) => {
        await p.getByRole('button', { name: 'Buka shift' }).click()
        await p.getByText('Shift terbuka').waitFor()
        await p.getByRole('button', { name: /Kas & tutup shift/ }).click()
        await p.getByRole('button', { name: 'Kas keluar', exact: true }).click()
        await p.getByLabel('Jumlah', { exact: true }).fill('5000')
        await p.getByLabel('Alasan', { exact: true }).fill('Beli es batu')
        await p.getByRole('button', { name: 'Simpan', exact: true }).click()
      }, 'Buka shift, catat kas keluar'],
      ['Saat shift berakhir, kasir menghitung uang di laci. Sistem membandingkannya dengan uang yang seharusnya ada, yaitu modal awal ditambah penjualan tunai dan kas masuk, dikurangi kas keluar dan refund tunai.', async (p) => {
        await p.getByLabel('Uang yang dihitung di laci (Rp)').fill(String(c.opening - 5000 - 500))
        await p.getByLabel('Catatan', { exact: true }).fill('Uang kembalian kurang')
      }, 'Isi uang dihitung (kurang lima ratus)'],
      ['Kalau ada selisih, kasir wajib menulis penyebabnya, dan manager menandai selisih itu sudah ditinjau. Uang hasil hitung otomatis menjadi modal awal kasir berikutnya. Jika kasir lupa menutup, manager bisa menutup paksa dengan alasan.', async (p) => {
        await p.getByRole('button', { name: 'Tutup shift', exact: true }).click()
        await p.getByText('Shift ditutup').waitFor()
      }, 'Tutup shift, ringkasan selisih'],
    ],
  },

  dapur: {
    file: '05-dapur', title: 'Layar dapur',
    before: async () => { await clearShifts(); const names = ['Rizky Pratama', 'Putri Lestari', 'Agus Salim']; await openShiftWithPaidOrders(names); return { names } },
    after: async (c) => { await finishOrders(c.names); await closeCashierShift() },
    scenes: (c) => [
      ['Fitur keempat: layar dapur.', (p) => login(p, ACC.kitchen), 'Login dapur'],
      ['Pesanan yang sudah dibayar muncul sendiri di layar dapur tanpa perlu menyegarkan halaman, lengkap dengan nomor antrean, meja, menu, pilihan, dan catatan dari pelanggan.', hold, 'Kartu pesanan'],
      ['Koki menekan Siap diambil saat pesanan selesai, lalu Sudah diambil saat pelanggan menerimanya. Kartu pun hilang dari layar.', async (p) => {
        const card = p.locator('article').filter({ hasText: c.names[0] })
        await card.getByRole('button', { name: 'Siap diambil' }).click()
        await card.getByRole('button', { name: 'Sudah diambil' }).click()
      }, 'Siap diambil → Sudah diambil'],
      ['Kalau bahan habis, dapur bisa mematikan menu lewat Stok menu. Menu itu langsung tidak bisa dipesan pelanggan.', (p) => p.getByRole('button', { name: /Stok menu/ }).click(), 'Jendela Stok menu'],
      ['Dapur juga bisa mencetak tiket otomatis setiap ada pesanan baru ke printer thermal. Pasangkan printer sekali, lalu aktifkan Cetak otomatis. Halaman dapur harus tetap terbuka, dan fitur ini butuh Chrome atau Edge.', async (p) => {
        await p.keyboard.press('Escape')
        await p.getByRole('button', { name: /Cetak otomatis/ }).hover()
      }, 'Tombol Pasangkan printer dan Cetak otomatis'],
    ],
  },

  member: {
    file: '06-member-promo', title: 'Member, voucher, dan promo',
    before: async () => { await clearShifts(); await cleanVouchers() },
    scenes: () => [
      ['Fitur kelima: pelanggan setia. Di halaman Member, kasir dan manager mendaftarkan pelanggan dengan nomor telepon.', (p) => ownerLogin(p, '/admin/member'), 'Member & voucher'],
      ['Setiap pembelian menambah poin, dan poin bisa ditukar menjadi potongan harga di kasir.', (p) => scroll(p, 250), 'Daftar member dan poin'],
      ['Anda juga bisa membuat voucher berupa potongan rupiah atau persen, lengkap dengan masa berlaku. Setiap voucher hanya bisa dipakai sekali.', hold, 'Bagian voucher'],
      ['Di halaman Promo, atur diskon otomatis, beli dua gratis satu, potongan dengan minimal belanja, atau kode promo, lengkap dengan periode dan syaratnya.', go('/admin/promo'), 'Promo & diskon'],
      ['Semua potongan dihitung otomatis oleh sistem, jadi kasir tidak perlu menghitung manual.', hold, 'Promo & diskon'],
    ],
  },

  menu: {
    file: '07-menu-stok-resep', title: 'Menu, stok, dan resep',
    before: async () => { await clearShifts(); await restock() },
    scenes: () => [
      ['Fitur keenam: katalog menu.', (p) => ownerLogin(p, '/admin/menu'), 'Katalog menu'],
      ['Tambah atau ubah menu beserta harga, kategori, dan foto. Atur juga pilihan seperti ukuran dan tingkat gula, serta tandai menu tersedia atau habis.', (p) => scroll(p, 300), 'Daftar menu'],
      ['Perubahan harga langsung berlaku di layar pelanggan dan di kasir.', hold, 'Daftar menu'],
      ['Di halaman Stok dan Resep, catat bahan baku beserta resep tiap menu.', go('/admin/stok'), 'Stok & resep'],
      ['Stok bahan berkurang otomatis setiap ada penjualan, dan dikembalikan jika pesanan dibatalkan. Bahan yang menipis diberi tanda.', hold, 'Daftar bahan'],
      ['Dari resep, sistem menghitung harga pokok penjualan dan margin tiap menu, jadi Anda tahu menu mana yang paling menguntungkan.', hold, 'Kartu HPP dan margin'],
    ],
  },

  laporan: {
    file: '08-laporan-audit', title: 'Laporan dan audit',
    before: async () => { await clearShifts(); await restock() },
    scenes: () => [
      ['Fitur ketujuh: laporan.', (p) => ownerLogin(p, '/admin'), 'Ikhtisar'],
      ['Ikhtisar menampilkan penjualan, pesanan terbaru, menu terlaris, dan bahan yang menipis.', (p) => scroll(p, 350), 'Ikhtisar'],
      ['Halaman Penjualan memperlihatkan omzet, jumlah transaksi, rata-rata per transaksi, serta penjualan per hari, per metode bayar, dan per kasir. Datanya bisa diekspor ke C S V.', go('/admin/laporan'), 'Laporan penjualan'],
      ['Void dan refund dicatat terpisah, jadi pembatalan transaksi mudah diaudit.', (p) => scroll(p, 500), 'Menu terlaris, per kasir'],
      ['Halaman Shift dan Audit menampilkan selisih kas di setiap shift, siapa kasirnya, dan rincian tiap pesanan tunai.', go('/admin/shift'), 'Shift & audit'],
      ['Log audit mencatat tindakan penting seperti void, refund, dan perubahan pengaturan, lengkap dengan siapa yang melakukannya dan kapan.', (p) => p.getByRole('tab', { name: /Log audit/ }).click(), 'Tab Log audit'],
    ],
  },

  tim: {
    file: '09-meja-tim-akses', title: 'Meja, tim, dan hak akses',
    before: async () => { await clearShifts() },
    scenes: () => [
      ['Fitur kedelapan: meja dan tim.', (p) => ownerLogin(p, '/admin/meja'), 'Meja & QR'],
      ['Daftarkan meja toko Anda, lalu cetak kode QR untuk tiap meja. Pesanan dari QR hanya diterima untuk meja yang terdaftar.', hold, 'Daftar meja'],
      ['Di Tim dan Peran, tambahkan staf dengan email lalu tentukan perannya.', go('/admin/tim'), 'Tim & peran'],
      ['Ada lima peran: owner, manager, kasir, pelayan, dan dapur. Kasir tidak bisa melihat laporan penjualan, pelayan tidak bisa menerima pembayaran, dan dapur hanya mengurus dapur.', (p) => scroll(p, 300), 'Daftar peran'],
      ['Aturan ini dijaga langsung di database, bukan sekadar disembunyikan di layar. Jadi staf tidak bisa menembusnya.', hold, 'Tim & peran'],
    ],
  },

  pengaturan: {
    file: '10-pengaturan-bahasa', title: 'Pengaturan toko dan bahasa',
    before: async () => { await clearShifts() },
    scenes: () => [
      ['Fitur kesembilan: pengaturan toko.', (p) => ownerLogin(p, '/admin/toko'), 'Pengaturan toko'],
      ['Atur profil usaha, nomor WhatsApp kasir, dan link pemesanan untuk pelanggan.', hold, 'Tab Profil'],
      ['Di tab Pajak dan Poin, atur pajak, biaya layanan, pembulatan, dan aturan poin.', (p) => p.getByRole('tab', { name: /Pajak/ }).click(), 'Tab Pajak & poin'],
      ['Tab Struk mengatur alamat dan pesan di struk. Di sini juga ada kalibrasi printer thermal, lengkap dengan cetak tes.', (p) => p.getByRole('tab', { name: 'Struk' }).click(), 'Tab Struk + pratinjau'],
      ['Tab Keamanan menyimpan pin supervisor yang dipakai untuk void dan refund oleh kasir.', (p) => p.getByRole('tab', { name: 'Keamanan' }).click(), 'Tab Keamanan'],
      ['Halaman Bahasa mengatur tiga bahasa: Indonesia, Santai gaya Jakarta Selatan, dan English. Owner bisa menyunting kalimat peringatan sesuai gaya toko, dan tiap staf bisa memilih bahasanya sendiri.', go('/admin/bahasa'), 'Bahasa & pesan'],
    ],
  },

  platform: {
    file: '11-multi-toko-keamanan', title: 'Banyak toko dan keamanan',
    before: async () => { await clearShifts() },
    scenes: () => [
      ['Fitur kesepuluh: banyak toko dalam satu platform.', (p) => login(p, ACC.super), 'Login super admin'],
      ['Super admin membuat toko baru, menentukan pemiliknya, dan mengatur paket serta masa langganan. Pemilik usaha juga bisa mendaftar sendiri dan langsung mendapat masa uji coba empat belas hari.', (p) => scroll(p, 300), 'Kelola seluruh toko'],
      ['Data setiap toko terpisah di tingkat database. Owner satu toko tidak bisa melihat pesanan toko lain, dan super admin pun tidak bisa membaca pesanan pelanggan.', hold, 'Kelola seluruh toko'],
      ['Halaman privasi dan syarat layanan tersedia, dan aplikasi bisa dipasang seperti aplikasi di ponsel atau tablet.', go('/syarat'), 'Syarat layanan'],
    ],
  },

  penutup: {
    file: '12-penutup', title: 'Penutup',
    before: async () => { await clearShifts() },
    scenes: () => [
      ['Itulah fitur WA-Order POS: pesan lewat QR, kasir, shift, dapur, member, laporan, dan banyak toko, dalam satu aplikasi.', (p) => p.goto('/'), 'Halaman depan'],
      ['Kami jujur soal batasnya. Pembayaran QRIS dan kartu masih dicatat manual oleh kasir, dan transaksi baru tetap membutuhkan internet. Printer thermal sudah disiapkan, tetapi perlu diuji dengan printer toko Anda.', hold, 'Halaman depan'],
      ['Silakan coba sekarang dengan masa uji coba empat belas hari. Terima kasih.', hold, 'Halaman depan'],
    ],
  },
}
