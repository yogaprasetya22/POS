/**
 * Naskah + langkah layar untuk tiap peran. Setiap langkah: [narasi, fungsi(page, ctx)].
 * Narasi ditulis seperti diucapkan (angka dengan huruf) agar suara terdengar wajar.
 * `before` menyiapkan data demo dan `after` membersihkannya, sehingga video bisa direkam ulang kapan saja.
 */
import { createClient } from '@supabase/supabase-js'

const SLUG = 'warkop-nusantara'
const ACC = {
  owner: ['admin@pos.test', 'admin12345'],
  manager: ['manager@pos.test', 'manager12345'],
  cashier: ['kasir@pos.test', 'kasir12345'],
  kitchen: ['dapur@pos.test', 'dapur12345'],
  waiter: ['pelayan@pos.test', 'pelayan12345'],
  super: ['super@pos.test', 'super12345'],
}

const anon = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function as([email, password]) {
  const c = anon()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}
const need = async (p) => {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data
}

/** Tutup semua shift yang masih terbuka supaya laci kosong. */
async function clearShifts() {
  for (const a of [ACC.cashier, ACC.manager, ACC.owner]) {
    const c = await as(a)
    const s = (await c.rpc('shift_summary')).data
    if (s) await c.rpc('close_shift', { p_counted_cash: s.expected_cash, p_note: 'dibersihkan video panduan' })
  }
}
/** Isi ulang bahan yang menipis/minus (sisa simulasi) agar halaman Stok di video tidak penuh peringatan. */
async function restock() {
  const o = await as(ACC.owner)
  const rows = await need(o.from('ingredients').select('id,stock,min_stock').eq('is_active', true))
  for (const r of rows) {
    const target = Math.max(Number(r.min_stock) * 5, 1000)
    if (Number(r.stock) < Number(r.min_stock) * 2) await o.rpc('stock_adjust', { p_ingredient: r.id, p_delta: target - Number(r.stock), p_reason: 'RESTOCK', p_note: 'Belanja bahan (data demo video)' })
  }
}

/** Produk + pilihan wajib (opsi pertama tiap grup wajib), seperti yang dipilih pelanggan di layar. */
async function product(name) {
  const o = await as(ACC.owner)
  const p = await need(o.from('products').select('id,modifiers').eq('name', name).limit(1).single())
  const choices = (p.modifiers ?? []).filter((g) => g.required).map((g) => ({ group: g.name, option: g.options[0].name }))
  return { id: p.id, choices }
}
async function storeId() {
  return (await need(anon().from('stores').select('id').eq('slug', SLUG).single())).id
}
async function customerOrder(name, qty = 1) {
  const [sid, pid] = [await storeId(), await product('Es Teh Lemon')]
  return await need(anon().rpc('create_order', {
    p_store_id: sid, p_customer_name: name, p_order_type: 'DINE_IN', p_table_no: 'T1',
    p_lines: [{ product_id: pid.id, qty, choices: pid.choices, note: '' }],
  }))
}
async function finishOrders(names) {
  const k = await as(ACC.kitchen)
  const c = await as(ACC.cashier)
  const rows = (await need(c.from('orders').select('id,status').in('customer_name', names).in('status', ['UNPAID', 'IN_KITCHEN', 'READY']))) ?? []
  for (const o of rows) {
    if (o.status === 'UNPAID') await c.rpc('advance_order', { p_order_id: o.id, p_to: 'CANCELLED' })
    else {
      if (o.status === 'IN_KITCHEN') await k.rpc('advance_order', { p_order_id: o.id, p_to: 'READY' })
      await k.rpc('advance_order', { p_order_id: o.id, p_to: 'COMPLETED' })
    }
  }
}

const digits = (s) => Number(s.replace(/\D/g, ''))
const login = async (page, [email, password]) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await page.waitForURL(/\/(cashier|kitchen|admin|super)/)
}
const scroll = (page, dy = 420) => page.mouse.wheel(0, dy)
const go = (path) => (page) => page.goto(path)
const hold = () => undefined

export const ROLES = {
  // ───────────────────────────── Pelanggan ─────────────────────────────
  pelanggan: {
    file: '01-pelanggan', title: 'Pelanggan memesan lewat QR di meja',
    before: async () => { await clearShifts(); return { name: 'Tamu Video' } },
    after: async (c) => { await finishOrders([c.name]) },
    steps: (c) => [
      ['Panduan untuk pelanggan. Pesan makanan dari meja Anda, tanpa antre dan tanpa perlu membuat akun.', (p) => p.goto(`/s/${SLUG}?meja=T1`)],
      ['Scan kode QR yang ada di meja. Halaman menu terbuka, dan nomor meja sudah terisi otomatis.', hold],
      ['Geser ke bawah untuk melihat menu. Setiap menu menampilkan foto dan harganya.', (p) => scroll(p, 500)],
      ['Pilih menu yang Anda mau. Menu yang kehabisan akan ditandai, jadi tidak bisa dipesan.', (p) => p.getByRole('button', { name: /Es Teh Lemon/ }).click()],
      ['Atur pilihan seperti ukuran atau tambahan, lalu tekan Tambah ke keranjang.', (p) => p.getByRole('button', { name: /Tambah ke keranjang/ }).click()],
      ['Tekan Lihat pesanan untuk memeriksa isi keranjang dan total harga.', (p) => p.getByRole('button', { name: 'Lihat pesanan' }).click()],
      ['Isi nama Anda supaya pesanan mudah dipanggil.', (p) => p.getByLabel('Nama', { exact: true }).fill(c.name)],
      ['Terakhir, tekan Kirim ke WhatsApp. Pesanan masuk ke kasir dan Anda mendapat kode antrean.', (p) => p.getByRole('button', { name: /Kirim ke WhatsApp/ }).click()],
      ['Tunjukkan kode antrean ke kasir, lalu bayar. Setelah dibayar, pesanan langsung disiapkan di dapur. Selamat menikmati.', hold],
    ],
  },

  // ───────────────────────────── Kasir ─────────────────────────────
  kasir: {
    file: '02-kasir', title: 'Kasir: buka shift, terima bayar, tutup shift',
    before: async () => {
      await clearShifts()
      const a = await customerOrder('Dimas Anggara'), b = await customerOrder('Nadia Putri')
      return { a: a.queue_code, b: b.queue_code, names: ['Dimas Anggara', 'Nadia Putri'], opening: 0 }
    },
    after: async (c) => { await finishOrders(c.names) },
    steps: (c) => {
      const find = async (p, code, name) => {
        await p.getByLabel('Cari pesanan').fill(code)
        await p.getByLabel('Cari pesanan').press('Enter')
        await p.getByText(`#${code} · ${name} · Meja T1`).waitFor()
      }
      const pay = async (p) => {
        await p.getByRole('button', { name: 'Terima Pembayaran' }).click()
        await p.getByRole('dialog').getByText('Pembayaran Berhasil').waitFor()
      }
      return [
        ['Panduan untuk kasir. Kita mulai dari masuk ke aplikasi dengan email dan password kasir.', (p) => login(p, ACC.cashier)],
        ['Ini layar kasir. Di kiri ada antrean pesanan dan menu. Di kanan ada keranjang dan pembayaran.', hold],
        ['Sebelum menerima pembayaran, kasir wajib membuka shift. Modal awal sudah terisi dari uang serah terima shift sebelumnya. Jika angkanya beda, isi alasannya.', async (p) => {
          c.opening = digits(await p.getByLabel('Modal awal (Rp)').inputValue())
        }],
        ['Tekan Buka shift. Sekarang laci kas atas nama Anda, dan semua penjualan tercatat di shift ini.', async (p) => {
          await p.getByRole('button', { name: 'Buka shift' }).click()
          await p.getByText('Shift terbuka').waitFor()
        }],
        ['Pesanan dari pelanggan muncul di antrean. Cari dengan kode antrean, lalu tekan Enter untuk membukanya.', (p) => find(p, c.a, 'Dimas Anggara')],
        ['Pilih metode Tunai, lalu masukkan uang yang diterima. Tombol Uang pas atau pecahan cepat mempercepat kerja.', (p) => p.getByRole('button', { name: 'Rp100.000' }).click()],
        ['Tekan Terima Pembayaran. Struk menampilkan kembalian, dan pesanan langsung terkirim ke dapur.', pay],
        ['Anda bisa mencetak struk, atau melihat pratinjau printer thermal sebelum mengirim ke printer.', async (p) => {
          await p.getByRole('button', { name: 'Pratinjau printer' }).click()
          await p.waitForTimeout(2500)
          await p.keyboard.press('Escape')
        }],
        ['Tekan Selesai untuk kembali ke antrean.', (p) => p.getByRole('dialog').getByRole('button', { name: 'Selesai' }).click()],
        ['Pesanan kedua dibayar dengan QRIS. Pilih QRIS, pastikan pembayaran sudah masuk di aplikasi bank atau e-wallet, baru tekan Terima Pembayaran.', async (p) => {
          await find(p, c.b, 'Nadia Putri')
          await p.getByRole('radio', { name: 'QRIS' }).or(p.getByRole('button', { name: 'QRIS', exact: true })).first().click()
        }],
        ['Pembayaran non tunai tidak masuk hitungan uang di laci, hanya penjualan tunai.', async (p) => {
          await pay(p)
          await p.getByRole('dialog').getByRole('button', { name: 'Selesai' }).click()
        }],
        ['Jika ada uang keluar dari laci, misalnya beli es batu, catat lewat Kas dan tutup shift. Pilih Kas keluar, isi jumlah dan alasannya.', async (p) => {
          await p.getByRole('button', { name: /Kas & tutup shift/ }).click()
          await p.getByRole('button', { name: 'Kas keluar', exact: true }).click()
          await p.getByLabel('Jumlah', { exact: true }).fill('5000')
          await p.getByLabel('Alasan', { exact: true }).fill('Beli es batu')
          await p.getByRole('button', { name: 'Simpan', exact: true }).click()
        }],
        ['Saat shift berakhir, hitung uang di laci dan isi jumlahnya. Sistem membandingkan dengan uang yang seharusnya ada, dan menampilkan selisihnya. Jika ada selisih, alasan wajib diisi.', async (p) => {
          await p.getByLabel('Uang yang dihitung di laci (Rp)').fill(String(c.opening + 10000 - 5000))
        }],
        ['Tekan Tutup shift. Uang yang Anda hitung menjadi modal awal untuk kasir berikutnya, jadi serah terima tercatat rapi.', async (p) => {
          await p.getByRole('button', { name: 'Tutup shift', exact: true }).click()
          await p.getByText('Shift ditutup').waitFor()
        }],
        ['Selesai. Itulah alur kasir, dari buka shift sampai tutup shift.', hold],
      ]
    },
  },

  // ───────────────────────────── Dapur ─────────────────────────────
  dapur: {
    file: '03-dapur', title: 'Dapur: kerjakan pesanan dan atur stok menu',
    before: async () => {
      await clearShifts()
      const c = await as(ACC.cashier)
      const st = (await c.rpc('shift_status')).data
      await need(c.rpc('open_shift', { p_opening_cash: st?.last_closed?.counted_cash ?? 100000, p_note: '' }))
      const names = ['Rizky Pratama', 'Putri Lestari', 'Agus Salim']
      for (const n of names) {
        const o = await customerOrder(n)
        await need(c.rpc('pay_order', { p_order_id: o.id, p_method: 'CASH', p_cash_received: 100000 }))
      }
      return { names }
    },
    after: async (c) => {
      await finishOrders(c.names)
      const k = await as(ACC.cashier)
      const s = (await k.rpc('shift_summary')).data
      if (s) await k.rpc('close_shift', { p_counted_cash: s.expected_cash, p_note: '' })
    },
    steps: (c) => [
      ['Panduan untuk staf dapur. Masuk dengan akun dapur.', (p) => login(p, ACC.kitchen)],
      ['Ini layar dapur. Setiap kartu adalah satu pesanan yang sudah dibayar, lengkap dengan nomor antrean, nama, meja, dan menu yang harus dibuat.', hold],
      ['Pesanan baru muncul sendiri tanpa perlu menyegarkan halaman. Perhatikan juga catatan khusus pelanggan, yang ditandai warna kuning.', hold],
      ['Setelah makanan atau minuman selesai dibuat, tekan Siap diambil di kartu pesanan.', (p) => p.locator('article').filter({ hasText: c.names[0] }).getByRole('button', { name: 'Siap diambil' }).click()],
      ['Saat pelanggan sudah menerima pesanannya, tekan Sudah diambil. Kartu pun hilang dari layar.', async (p) => {
        const card = p.locator('article').filter({ hasText: c.names[0] })
        await card.getByRole('button', { name: 'Sudah diambil' }).click()
      }],
      ['Jika ada bahan yang habis, tekan Stok menu, lalu matikan menu tersebut. Menu itu langsung tidak bisa dipesan pelanggan.', (p) => p.getByRole('button', { name: /Stok menu/ }).click()],
      ['Tutup jendela ini bila sudah selesai.', (p) => p.keyboard.press('Escape')],
      ['Jika printer thermal sudah dipasang di komputer dapur, tombol Cetak otomatis akan mencetak tiket setiap ada pesanan baru. Pasangkan printer sekali saja lewat tombol Pasangkan printer.', (p) => p.getByRole('button', { name: /Cetak otomatis/ }).hover()],
      ['Itulah tugas dapur. Selamat bekerja.', hold],
    ],
  },

  // ───────────────────────────── Pelayan ─────────────────────────────
  pelayan: {
    file: '04-pelayan', title: 'Pelayan: ambil pesanan di meja',
    before: async () => { await clearShifts(); return { name: 'Tamu Pelayan' } },
    after: async (c) => { await finishOrders([c.name]) },
    steps: (c) => [
      ['Panduan untuk pelayan. Masuk dengan akun pelayan.', (p) => login(p, ACC.waiter)],
      ['Pelayan memakai layar yang sama dengan kasir, tetapi tanpa bagian pembayaran dan tanpa shift. Tugasnya mengambil pesanan di meja.', hold],
      ['Pilih menu yang diminta pelanggan.', (p) => p.getByRole('button', { name: /Es Teh Lemon/ }).first().click()],
      ['Atur pilihan menu bila ada, lalu tambahkan ke keranjang.', (p) => p.getByRole('button', { name: /Tambah ke keranjang/ }).click()],
      ['Isi nama pelanggan dan nomor mejanya.', async (p) => {
        await p.getByPlaceholder(/Nama pelanggan/i).first().fill(c.name)
        await p.getByPlaceholder('Meja').fill('T3')
      }],
      ['Tekan Simpan pesanan. Pesanan tersimpan dan menunggu dibayar di kasir. Pelayan tidak bisa menerima pembayaran, sehingga uang hanya dipegang kasir.', (p) => p.getByRole('button', { name: 'Simpan pesanan' }).click()],
      ['Selesai. Pesanan Anda kini muncul di antrean kasir.', hold],
    ],
  },

  // ───────────────────────────── Manager ─────────────────────────────
  manager: {
    file: '05-manager', title: 'Manager: pantau penjualan dan awasi shift',
    before: async () => { await clearShifts(); await restock(); return {} },
    steps: () => [
      ['Panduan untuk manager. Masuk dengan akun manager, lalu buka Back office.', async (p) => { await login(p, ACC.manager); await p.goto('/admin') }],
      ['Dashboard menampilkan ringkasan penjualan, jumlah pesanan, dan menu terlaris.', (p) => scroll(p, 350)],
      ['Di halaman Laporan, pilih rentang tanggal untuk melihat omzet, diskon, pajak, penjualan per metode bayar, dan per kasir.', go('/admin/laporan')],
      ['Void dan refund juga tercatat di laporan, jadi pembatalan transaksi mudah diaudit.', (p) => scroll(p, 500)],
      ['Halaman Shift adalah pusat pengawasan uang. Setiap shift menampilkan kasirnya, modal awal, uang seharusnya, uang dihitung, dan selisih.', go('/admin/shift')],
      ['Buka satu shift untuk melihat rinciannya, mulai dari pesanan, kas masuk dan keluar, sampai void dan refund di shift itu.', (p) => p.getByRole('row').nth(1).click()],
      ['Jika kasir lupa menutup shift, manager bisa menutup paksa dengan alasan, dan tindakan itu tercatat.', hold],
      ['Halaman Stok menampilkan sisa bahan. Bahan yang menipis atau minus ditandai, jadi bisa segera dibelanjakan atau dikoreksi.', go('/admin/stok')],
      ['Di halaman Member, kelola pelanggan setia, poin, dan voucher mereka.', go('/admin/member')],
      ['Itulah tugas manager. Pengaturan tim dan toko hanya bisa diubah oleh pemilik.', hold],
    ],
  },

  // ───────────────────────────── Owner ─────────────────────────────
  owner: {
    file: '06-owner', title: 'Owner: atur menu, promo, tim, dan toko',
    before: async () => { await clearShifts(); await restock(); return {} },
    steps: () => [
      ['Panduan untuk pemilik usaha. Masuk dengan akun owner, lalu buka Back office.', async (p) => { await login(p, ACC.owner); await p.goto('/admin') }],
      ['Owner punya akses penuh. Dashboard menampilkan penjualan dan ringkasan toko Anda.', hold],
      ['Di halaman Menu, tambah atau ubah produk, harga, foto, kategori, pilihan tambahan, dan resep bahan.', go('/admin/menu')],
      ['Halaman Promo mengatur diskon otomatis dan kode promo, lengkap dengan periode dan syaratnya.', go('/admin/promo')],
      ['Halaman Member mengelola pelanggan setia, poin, dan voucher.', go('/admin/member')],
      ['Halaman Stok mencatat sisa bahan. Stok berkurang otomatis setiap ada penjualan, dan Anda bisa menyesuaikannya saat belanja atau stok opname.', go('/admin/stok')],
      ['Halaman Laporan menunjukkan omzet dan penjualan per hari, per metode bayar, dan per kasir.', go('/admin/laporan')],
      ['Halaman Shift memperlihatkan serah terima uang antar kasir beserta selisihnya, sehingga kebocoran kas mudah dilacak.', go('/admin/shift')],
      ['Halaman Meja membuat kode QR untuk setiap meja. Cetak dan tempel di meja pelanggan.', go('/admin/meja')],
      ['Di halaman Tim, tambah staf dan tentukan perannya, yaitu manager, kasir, pelayan, atau dapur. Hak akses tiap peran sudah diatur otomatis.', go('/admin/tim')],
      ['Halaman Toko berisi profil usaha, pajak dan service, poin, tampilan struk, dan keamanan seperti PIN supervisor.', go('/admin/toko')],
      ['Di tab Struk, atur alamat, pesan kaki struk, dan kalibrasi printer thermal, termasuk cetak tes.', (p) => p.getByRole('tab', { name: 'Struk' }).click()],
      ['Halaman Bahasa mengatur bahasa aplikasi. Anda bisa mengubah kalimat sesuai gaya toko Anda.', go('/admin/bahasa')],
      ['Itulah gambaran lengkap fitur untuk pemilik. Selamat berjualan.', hold],
    ],
  },

  // ───────────────────────────── Super admin ─────────────────────────────
  super: {
    file: '07-super-admin', title: 'Super admin: kelola semua toko',
    before: async () => ({}),
    steps: () => [
      ['Panduan untuk super admin, yaitu pengelola platform yang menaungi banyak toko.', (p) => login(p, ACC.super)],
      ['Halaman Kelola Toko menampilkan semua toko beserta penjualannya.', hold],
      ['Dari sini Anda bisa membuat toko baru, menentukan pemiliknya, serta mengatur paket dan masa langganan.', (p) => scroll(p, 350)],
      ['Super admin tidak bisa membaca pesanan atau data pelanggan toko. Setiap toko terisolasi satu sama lain di tingkat database.', hold],
    ],
  },
}

// dipakai juga oleh fitur.mjs
export { as, anon, need, ACC, SLUG, clearShifts, restock, customerOrder, finishOrders, login, scroll, go, hold, digits }
