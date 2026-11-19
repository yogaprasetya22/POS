import { ArrowRight, BarChart3, Boxes, ChefHat, Check, ClipboardList, Gift, Lock, QrCode, Receipt, ShieldCheck, Smartphone, Store, UserCog, Wallet } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Reveal } from '@shared/components/reveal'
import { buttonVariants } from '@shared/components/ui/button'
import { fetchStores } from '@shared/lib/api'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'POS'

const QUICK = [
  { icon: Smartphone, text: 'Jalan di browser, HP, dan tablet' },
  { icon: Receipt, text: 'Cetak struk & tiket dapur' },
  { icon: BarChart3, text: 'Laporan & ekspor CSV' },
  { icon: Store, text: 'Banyak toko, satu akun' },
]

const SHOWCASE: { id: string; tag: string; title: string; text: string; points: string[]; img: string; alt: string; phone?: boolean }[] = [
  {
    id: 'stok',
    tag: 'Stok & resep',
    title: 'Stok bahan terhubung langsung dengan menu',
    text: 'Catat resep tiap menu sekali. Setelahnya stok bahan berkurang otomatis setiap pesanan dibayar, dan kembali saat pesanan di-void.',
    points: ['Menu otomatis "Habis" saat bahan tidak cukup', 'Sisa porsi terlihat di layar kasir', 'Modal dan untung tiap menu dihitung otomatis', 'Peringatan saat stok bahan menipis'],
    img: '/landing/stok.webp',
    alt: 'Halaman Stok & Resep dengan daftar bahan baku dan HPP menu',
  },
  {
    id: 'laporan',
    tag: 'Laporan',
    title: 'Pantau penjualan toko kapan saja',
    text: 'Ikhtisar harian, grafik penjualan, transaksi terbaru, dan hal yang perlu perhatian tampil dalam satu layar.',
    points: ['Omzet, jumlah transaksi, dan rata-rata belanja', 'Menu terlaris dan menu yang habis', 'Riwayat shift dan log audit', 'Ekspor laporan ke CSV'],
    img: '/landing/dashboard.webp',
    alt: 'Dashboard ikhtisar penjualan dengan grafik 30 hari',
  },
  {
    id: 'qr',
    tag: 'Pesan via QR',
    title: 'Pelanggan memesan sendiri dari meja',
    text: 'Cetak QR per meja. Pelanggan scan, pilih menu dan varian, lalu pesanan masuk ke kasir dengan kode antrean. Tanpa unduh aplikasi.',
    points: ['Menu lengkap dengan foto, varian, dan catatan', 'Status "Habis" selalu mengikuti stok', 'Kasir tinggal memeriksa dan menerima pembayaran', 'Nomor meja tervalidasi'],
    img: '/landing/pelanggan.webp',
    alt: 'Tampilan menu pelanggan di layar HP',
    phone: true,
  },
]

const FEATURES = [
  { icon: Receipt, title: 'Kasir cepat', text: 'Pilih menu, varian, dan catatan. Makan di sini atau bawa pulang, bayar nanti, pisah dan gabung tagihan.' },
  { icon: ChefHat, title: 'Layar dapur', text: 'Pesanan yang sudah dibayar langsung muncul di dapur, lengkap dengan status dan tiket cetak.' },
  { icon: Wallet, title: 'Shift & laci kas', text: 'Buka-tutup shift, hitung selisih kas, catat kas masuk dan keluar.' },
  { icon: Gift, title: 'Promo, voucher & member', text: 'Diskon, voucher sekali pakai, dan poin member agar pelanggan kembali.' },
  { icon: QrCode, title: 'Pembayaran fleksibel', text: 'Tunai, QRIS, dan kartu debit/kredit dicatat per metode. Uang non-tunai tidak masuk hitungan laci.' },
  { icon: ClipboardList, title: 'Pajak & service', text: 'Atur pajak, service charge, dan pembulatan. Total dihitung di server, sama di kasir dan struk.' },
  { icon: UserCog, title: 'Tim & peran', text: 'Owner, manager, kasir, pelayan, dan dapur punya akses berbeda sesuai tugasnya.' },
  { icon: Boxes, title: 'Multi-toko', text: 'Kelola beberapa cabang dengan satu akun. Data tiap toko terpisah.' },
]

const ROLES = [
  { role: 'Owner & manager', text: 'Atur menu, promo, stok, tim, dan lihat laporan lengkap termasuk modal per menu dan catatan aktivitas.' },
  { role: 'Kasir', text: 'Buka shift, terima pesanan dan pembayaran, cetak struk, void dengan PIN supervisor.' },
  { role: 'Pelayan', text: 'Ambil pesanan di meja dan kelola bill tanpa akses ke uang laci.' },
  { role: 'Dapur', text: 'Melihat antrean yang perlu dimasak dan menandai menu habis dengan cepat.' },
]

const TRUST = [
  { icon: Lock, title: 'Data toko terisolasi', text: 'Setiap toko hanya bisa mengakses datanya sendiri, dijaga langsung di level database.' },
  { icon: ShieldCheck, title: 'Hitungan dijaga server', text: 'Harga, promo, pajak, dan poin dihitung di database, bukan di perangkat, sehingga sulit dimanipulasi.' },
  { icon: ClipboardList, title: 'Jejak audit', text: 'Pembatalan, uang kembali, perubahan stok, dan pengaturan penting tercatat lengkap dengan siapa pelakunya.' },
  { icon: UserCog, title: 'Akses sesuai peran', text: 'Tindakan sensitif seperti void dan refund butuh PIN supervisor.' },
]

const STEPS = [
  { title: 'Daftar & buat toko', text: 'Buat akun dan toko dalam beberapa menit. Langsung dapat uji coba 14 hari.' },
  { title: 'Isi menu & resep', text: 'Tambahkan menu, harga, varian, dan resep bahan. Cetak QR untuk meja.' },
  { title: 'Mulai berjualan', text: 'Buka shift, terima pesanan dari kasir maupun QR, dapur langsung menyiapkan.' },
]

const FAQ = [
  { q: 'Apakah perlu instal aplikasi atau beli alat khusus?', a: 'Tidak. Aplikasi berjalan di browser pada laptop, tablet, atau HP, dan bisa dipasang ke layar utama. Printer struk bersifat opsional.' },
  { q: 'Bagaimana dengan pembayaran QRIS dan kartu?', a: 'Pembayaran QRIS dan kartu debit/kredit dicatat per metode oleh kasir. Aplikasi belum terhubung langsung ke payment gateway.' },
  { q: 'Apakah data toko saya aman dan terpisah dari toko lain?', a: 'Ya. Data setiap toko diisolasi di level database, dan tindakan sensitif tercatat di log audit.' },
  { q: 'Bisa untuk lebih dari satu cabang?', a: 'Bisa. Satu akun dapat mengelola beberapa toko, masing-masing dengan menu, stok, dan tim sendiri.' },
  { q: 'Bagaimana dengan biaya dan masa uji coba?', a: 'Setiap toko baru mendapat uji coba 14 hari. Setelah itu toko dapat dilanjutkan dengan paket langganan.' },
]

type StoreLink = { slug: string; name: string }

function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/10 ring-1 ring-black/5">
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2.5">
        <span className="size-2.5 rounded-full bg-red-400/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-emerald-400/80" />
      </div>
      {children}
    </div>
  )
}

function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-60 overflow-hidden rounded-[2rem] border-8 border-foreground/90 bg-card shadow-2xl shadow-primary/10">
      <img src={src} alt={alt} width={390} height={800} loading="lazy" className="block h-auto w-full" />
    </div>
  )
}

export function LandingPage() {
  const [stores, setStores] = useState<StoreLink[]>([])

  useEffect(() => {
    fetchStores().then(setStores).catch(() => setStores([]))
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">{APP_NAME}</Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Bagian halaman">
            <a href="#fitur" className="hover:text-foreground">Fitur</a>
            <a href="#peran" className="hover:text-foreground">Peran</a>
            <a href="#keamanan" className="hover:text-foreground">Keamanan</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Masuk</Link>
            <Link to="/register" className={buttonVariants({ size: 'sm' })}>Coba gratis</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-linear-to-b from-primary/10 to-transparent" />
          <div className="mx-auto max-w-6xl px-4 pb-8 pt-14 text-center sm:pt-20">
            <Reveal>
              <span className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                Uji coba gratis 14 hari
              </span>
              <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl sm:leading-[1.1]">
                Kasir, dapur, dan stok restoran dalam satu aplikasi.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Terima pesanan dari kasir atau QR meja, kirim ke dapur, potong stok bahan otomatis, dan lihat laporan penjualan. Semuanya dari browser.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/register" className={buttonVariants({ size: 'lg' })}>
                  Mulai uji coba gratis <ArrowRight className="size-4" />
                </Link>
                <a href="#fitur" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Lihat fitur</a>
              </div>
              <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {['Tanpa instal', 'Cocok untuk kafe, warung, dan resto', 'Siap dipakai dalam hitungan menit'].map((b) => (
                  <li key={b} className="flex items-center gap-1.5"><Check className="size-4 text-primary" /> {b}</li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1} className="mx-auto mt-12 max-w-5xl text-left">
              <BrowserFrame>
                <img src="/landing/kasir.webp" alt="Layar kasir dengan menu dan ringkasan pesanan" width={1440} height={900} className="block h-auto w-full" />
              </BrowserFrame>
              <p className="mt-3 text-center text-xs text-muted-foreground">Tampilan layar kasir dengan data contoh.</p>
            </Reveal>
          </div>
        </section>

        <section className="border-y bg-muted/40">
          <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center justify-center gap-2 text-sm font-medium">
                <Icon className="size-4 text-primary" /> {text}
              </li>
            ))}
          </ul>
        </section>

        <div id="fitur" className="mx-auto max-w-6xl scroll-mt-16 px-4">
          {SHOWCASE.map((s, i) => (
            <section key={s.id} className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16">
              <Reveal className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <span className="text-sm font-semibold text-primary">{s.tag}</span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{s.title}</h2>
                <p className="mt-3 text-muted-foreground">{s.text}</p>
                <ul className="mt-5 space-y-2.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check className="size-3.5" /></span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={0.08}>
                {s.phone ? (
                  <PhoneFrame src={s.img} alt={s.alt} />
                ) : (
                  <BrowserFrame>
                    <img src={s.img} alt={s.alt} width={1440} height={900} loading="lazy" className="block h-auto w-full" />
                  </BrowserFrame>
                )}
              </Reveal>
            </section>
          ))}
        </div>

        <section aria-labelledby="semua-fitur" className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="semua-fitur" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Semua yang dibutuhkan untuk berjualan</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">Dari meja pelanggan sampai laporan akhir bulan, tanpa perlu menggabungkan banyak aplikasi.</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }, i) => (
                <li key={title}>
                  <Reveal delay={Math.min(i, 4) * 0.05} className="h-full">
                    <div className="h-full rounded-xl border bg-card p-5">
                      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
                      <h3 className="mt-4 font-semibold">{title}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="peran" aria-labelledby="peran-h" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16">
          <h2 id="peran-h" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Setiap anggota tim punya layarnya sendiri</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(({ role, text }, i) => (
              <li key={role}>
                <Reveal delay={i * 0.05} className="h-full">
                  <div className="h-full rounded-xl border p-5">
                    <h3 className="font-semibold">{role}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section id="keamanan" aria-labelledby="aman-h" className="scroll-mt-16 border-y bg-foreground py-16 text-background">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="aman-h" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Dibuat untuk uang dan data yang harus akurat</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-background/70">Kontrol yang biasa dibutuhkan pemilik usaha supaya selisih dan kecurangan mudah ketahuan.</p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon className="size-6 text-primary" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-background/70">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="alur" className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="alur" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Mulai dalam 3 langkah</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map(({ title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 0.08}>
                  <span className="grid size-10 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">{i + 1}</span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" aria-labelledby="faq-h" className="mx-auto max-w-3xl scroll-mt-16 px-4 pb-16">
          <h2 id="faq-h" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Pertanyaan yang sering diajukan</h2>
          <div className="mt-8 divide-y rounded-xl border">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span aria-hidden className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {stores.length > 0 && (
          <section aria-labelledby="toko" className="mx-auto max-w-6xl px-4 pb-16">
            <h2 id="toko" className="text-xl font-semibold">Coba tampilan menu pelanggan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Contoh toko yang memakai {APP_NAME}.</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((s) => (
                <li key={s.slug}>
                  <Link to={`/s/${s.slug}`} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:bg-muted">
                    <span className="font-medium">{s.name}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mx-auto mb-16 max-w-6xl px-4">
          <div className="rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Siap merapikan penjualan tokomu?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm opacity-90">Buat akun, isi menu pertamamu, dan coba gratis selama 14 hari.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/register" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                Mulai uji coba gratis <ArrowRight className="size-4" />
              </Link>
              <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'lg' }) + ' text-primary-foreground hover:bg-white/10 hover:text-primary-foreground'}>Sudah punya akun</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <nav className="flex gap-4" aria-label="Info">
            <Link to="/privasi" className="hover:text-foreground">Privasi</Link>
            <Link to="/syarat" className="hover:text-foreground">Syarat</Link>
            <Link to="/login" className="hover:text-foreground">Masuk</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
