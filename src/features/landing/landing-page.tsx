import {
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Coins,
  Gift,
  Headphones,
  Lock,
  MessageSquare,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  UserCog,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Reveal } from '@shared/components/reveal'
import { buttonVariants } from '@shared/components/ui/button'
import { fetchStores } from '@shared/lib/api'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'POS Resto'
const WA_SALES_LINK = 'https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20tertarik%20konsultasi%20sewa%20sistem%20POS%20untuk%20restoran%2Fkafe%20saya.'

const QUICK = [
  { icon: Smartphone, text: 'Bisa di HP, iPad, Tablet & Laptop' },
  { icon: Coins, text: '0% Komisi Transaksi (Omzet 100% Milik Anda)' },
  { icon: Receipt, text: 'Cetak Struk Thermal & Tiket Dapur' },
  { icon: Sparkles, text: 'Dilengkapi Asisten AI Analisis Omzet' },
]

const SHOWCASE_TABS = [
  {
    id: 'kasir',
    label: 'Layar Kasir POS',
    tag: 'Kasir & Pembayaran',
    title: 'Pencatatan kasir secepat kilat dengan kontrol laci transparan',
    text: 'Kasir melayani pesanan makan di tempat atau bungkus, split & merge bill, cetak struk thermal, dan menutup shift dengan audit uang kas yang rapi.',
    points: [
      'Pemisahan otomatis uang setoran owner vs modal kembalian di laci',
      'Pilihan bayar lengkap: Tunai, QRIS, dan Kartu EDC',
      'Dukungan barcode scanner dan pencarian menu instan',
      'Proteksi pembatalan transaksi (void) dengan PIN supervisor',
    ],
    img: '/landing/kasir.webp',
    alt: 'Antarmuka layar kasir dengan keranjang dan katalog menu',
  },
  {
    id: 'qr',
    label: 'Menu QR Meja',
    tag: 'Self-Order Pelanggan',
    title: 'Pelanggan pesan dan bayar dari meja tanpa antre di kasir',
    text: 'Cukup cetak stiker QR di tiap meja. Tamu memindai kode lewat kamera HP mereka, memilih menu beserta varian, dan pesanan langsung masuk ke antrean dapur.',
    points: [
      'Tanpa perlu download atau instal aplikasi apapun',
      'Status stok menu otomatis sinkron (menu habis tidak bisa dipilih)',
      'Dukungan catatan khusus pelanggan (mis. tanpa gula, pedas sedang)',
      'Memangkas beban antrean kasir hingga 60% saat jam sibuk',
    ],
    img: '/landing/pelanggan.webp',
    alt: 'Tampilan menu pelanggan di layar HP',
    phone: true,
  },
  {
    id: 'laporan',
    label: 'Dashboard & Laba',
    tag: 'Laporan & Finansial',
    title: 'Pantau omzet, laba kotor, dan HPP restoran kapan saja',
    text: 'Owner dapat mengakses data penjualan langsung dari smartphone di luar kota. Analisis hari ramai, menu terlaris, dan kinerja staf kasir tersaji jelas.',
    points: [
      'Perhitungan omzet kotor, omzet bersih, diskon, dan pajak restoran',
      'Laporan laba kotor (Gross Profit) dan rasio margin per menu',
      'Ekspor seluruh data transaksi dan inventori ke format CSV / Excel',
      'Riwayat tutup shift dan audit selisih kas tiap kasir',
    ],
    img: '/landing/dashboard.webp',
    alt: 'Dashboard analitik penjualan dan grafik omzet',
  },
  {
    id: 'stok',
    label: 'Stok & Resep',
    tag: 'Inventori Otomatis',
    title: 'Stok bahan baku terpotong otomatis saat pesanan lunas',
    text: 'Cukup masukkan takaran resep sekali. Setiap cangkir kopi atau porsi makanan yang terjual otomatis memotong gramatur bahan di gudang dan dapur.',
    points: [
      'Peringatan otomatis saat persediaan bahan baku kritis atau menipis',
      'Sisa porsi yang bisa dibuat langsung terlihat di layar kasir',
      'Pencatatan barang masuk (restock), barang rusak (waste), dan opname',
      'Mencegah kebocoran bahan baku dan selisih stok dapur',
    ],
    img: '/landing/stok.webp',
    alt: 'Manajemen resep dan bahan baku stok inventori',
  },
]

const FEATURES = [
  { icon: Receipt, title: 'Kasir Cepat & Fleksibel', text: 'Makan di tempat atau take-away, bayar belakangan, pisah tagihan (split bill), dan gabung meja dalam hitungan detik.' },
  { icon: ChefHat, title: 'Monitor Dapur (KDS)', text: 'Pesanan yang telah dibayar seketika tampil di layar koki dapur lengkap dengan tanda waktu dan tiket cetak otomatis.' },
  { icon: Wallet, title: 'Audit Laci & Shift Kasir', text: 'Serah terima shift teratur. Sistem otomatis menghitung modal awal, omzet tunai harian, dan mendeteksi kas tekor.' },
  { icon: Gift, title: 'Member, Poin & Voucher', text: 'Program loyalitas pelanggan berulang: kumpulkan poin tiap belanja dan gunakan kode promo diskon promosi.' },
  { icon: QrCode, title: 'Pencatatan Multi-Metode', text: 'Mendukung uang tunai, QRIS statis/dinamis, kartu debit/kredit, serta transfer bank dengan pembukuan terpisah.' },
  { icon: ClipboardList, title: 'Pajak PB1 & Service Charge', text: 'Pengaturan pajak restoran (PB1) dan service charge yang otomatis terhitung di nota kasir dan pembukuan bulanan.' },
  { icon: UserCog, title: 'Hak Akses Staf Berjenjang', text: 'Owner, Manager, Kasir, Pelayan, dan Koki memiliki layar dan wewenang yang berbeda demi keamanan kas.' },
  { icon: Boxes, title: 'Multi-Cabang Satu Akun', text: 'Kelola puluhan outlet atau cabang waralaba Anda dari satu akun pusat dengan data terisolasi.' },
  { icon: Sparkles, title: 'POS Intelligence AI', text: 'Terintegrasi asisten AI (MCP): tanyakan omzet hari ini, HPP menu, atau stok kritis lewat chat langsung.' },
]

const COMPARISON = [
  {
    feature: 'Biaya Awal Investasi',
    legacy: 'Jutaan rupiah untuk beli lisensi putus & paket server',
    pos: 'Mulai Rp 99.000/bln (Sewa fleksibel, tanpa modal besar)',
  },
  {
    feature: 'Potongan Komisi Penjualan',
    legacy: 'Dipotong 1% – 2.5% dari setiap pesanan yang masuk',
    pos: '0% Komisi — Seluruh omzet 100% masuk ke kantong Anda',
  },
  {
    feature: 'Keterikatan Perangkat (Hardware Lock)',
    legacy: 'Wajib beli tablet atau mesin kasir khusus dari vendor',
    pos: 'Bebas pakai tablet, iPad, laptop, atau HP yang sudah Anda punya',
  },
  {
    feature: 'Pembaruan Fitur & Cloud Backup',
    legacy: 'Bayar biaya upgrade software atau risiko data lokal hilang',
    pos: 'Update otomatis gratis di cloud & data ter-backup harian aman',
  },
  {
    feature: 'Pemesanan Mandiri QR Meja',
    legacy: 'Perlu langganan modul tambahan berbayar mahal',
    pos: 'Sudah termasuk langsung dalam paket tanpa biaya tambahan',
  },
  {
    feature: 'Asisten AI & Analitik Finansial',
    legacy: 'Hanya tabel angka statis tanpa penjelasan otomatis',
    pos: 'Bisa tanya jawab omzet & margin langsung dengan AI cerdas',
  },
]

const PRICING_PLANS = [
  {
    name: 'Starter',
    badge: 'Kedai & Booth',
    desc: 'Pilihan hemat untuk kedai kopi mandiri, stand boba, gerai takeaway, atau warung makan.',
    monthlyPrice: 99000,
    yearlyPrice: 79000,
    features: [
      '1 Terminal Kasir Aktif',
      'Unlimited Menu & Kategori',
      'Pemesanan QR Meja Mandiri',
      'Dukungan Printer Struk Bluetooth/USB',
      'Laporan Omzet Harian & Ekspor CSV',
      'Cloud Server Vercel & Supabase Terkelola',
    ],
    highlight: false,
    cta: 'Sewa Paket Starter',
  },
  {
    name: 'Pro Resto',
    badge: 'Paling Populer',
    desc: 'Solusi terlengkap untuk kafe ramai, resto dine-in, dan bistro dengan dapur aktif.',
    monthlyPrice: 189000,
    yearlyPrice: 149000,
    features: [
      'Semua fitur Starter',
      'Multi-Kasir & Akses Pelayan Tak Terbatas',
      'Layar Monitor Dapur (KDS) Realtime',
      'Manajemen Stok Bahan & Resep HPP Otomatis',
      'Program Member, Poin & Voucher Promo',
      'Audit Buka-Tutup Shift & Kontrol Uang Laci',
      'Cetak Tiket Dapur & Bar Terpisah',
      'Backup Database Harian Aman',
    ],
    highlight: true,
    cta: 'Sewa Paket Pro Resto',
  },
  {
    name: 'Multi-Outlet',
    badge: 'Franchise & Cabang',
    desc: 'Dirancang khusus untuk pemilik resto yang memiliki banyak cabang atau ekspansi bisnis.',
    monthlyPrice: 349000,
    yearlyPrice: 289000,
    features: [
      'Semua fitur Pro Resto',
      'Kelola Hingga 3 Cabang (Bisa Tambah)',
      'Dashboard Super Admin Terpusat',
      'Jejak Audit Keamanan & PIN Supervisor',
      'POS Intelligence AI (Tanya Jawab Finansial)',
      'Integrasi MCP Serverless & API Khusus',
      'Dukungan Teknis Prioritas via WhatsApp VIP',
    ],
    highlight: false,
    cta: 'Sewa Paket Multi-Outlet',
  },
]

const TRUST = [
  { icon: Lock, title: 'Data Terisolasi Antar Toko', text: 'Setiap toko memiliki ruang database mandiri. Toko lain tidak akan pernah bisa melihat menu, resep, atau omzet Anda.' },
  { icon: ShieldCheck, title: 'Kalkulasi Terpusat di Server', text: 'Nominal harga, promo, pajak, dan sisa stok dihitung di database serverless, mencegah manipulasi kasir di perangkat.' },
  { icon: ClipboardList, title: 'Jejak Audit Lengkap', text: 'Setiap pembatalan pesanan (void), refund uang, dan penyesuaian stok terekam rapi beserta nama staf dan waktunya.' },
  { icon: UserCog, title: 'Otorisasi PIN Supervisor', text: 'Aksi berisiko tinggi seperti void nota atau diskon manual wajib memasukkan PIN otorisasi manajer/owner.' },
]

const STEPS = [
  { step: '01', title: 'Daftar Akun & Toko Anda', text: 'Isi nama toko dan nomor WhatsApp Anda dalam 1 menit. Langsung aktif dengan masa uji coba gratis 14 hari penuh.' },
  { step: '02', title: 'Atur Menu & Cetak QR Meja', text: 'Masukkan menu, harga, dan resep bahan baku. Cetak kode QR meja untuk diletakkan di meja makan tamu.' },
  { step: '03', title: 'Buka Shift & Langsung Jualan', text: 'Buka aplikasi kasir di tablet atau HP, terima pembayaran tunai/QRIS, dan pantau pesanan terkirim ke dapur.' },
]

const RENTAL_FAQ = [
  {
    q: 'Bagaimana skema sewa sistem POS ini?',
    a: 'Sistem POS disewakan dengan biaya langganan flat per bulan atau per tahun tanpa ikatan kontrak jangka panjang. Anda mendapatkan akses penuh ke software kasir, pemesanan QR meja, layar dapur (KDS), dashboard manajemen stok, server cloud berkecepatan tinggi, dan pembaruan fitur gratis berkala.',
  },
  {
    q: 'Apakah ada potongan komisi per transaksi penjualan saya?',
    a: 'SAMA SEKALI TIDAK ADA (0% komisi). Berbeda dengan beberapa aplikasi POS lain yang memotong 1%–2.5% dari setiap nota, di sini seluruh omzet penjualan adalah 100% milik toko Anda.',
  },
  {
    q: 'Perangkat keras (hardware) apa saja yang saya perlukan?',
    a: 'Anda TIDAK PERLU membeli mesin kasir khusus jutaan rupiah. Aplikasi ini berjalan sempurna di web browser pada laptop, PC, iPad, tablet Android, bahkan smartphone kasir yang sudah ada. Jika ingin mencetak struk fisik, cukup hubungkan dengan printer thermal Bluetooth atau USB standar ukuran 58mm atau 80mm di pasaran.',
  },
  {
    q: 'Apakah ada masa uji coba sebelum saya memutuskan untuk menyewa?',
    a: 'Ya, tersedia masa uji coba gratis selama 14 hari dengan fitur lengkap tanpa perlu memasukkan kartu kredit. Anda bisa mencoba langsung di operasional toko Anda sebelum mulai berlangganan sewa.',
  },
  {
    q: 'Bagaimana jika di kemudian hari saya ingin menambah cabang atau berhenti sewa?',
    a: 'Sangat fleksibel. Anda bisa menambah cabang kapan saja melalui dashboard admin. Jika Anda memutuskan untuk berhenti sewa, tidak ada penalti apapun. Seluruh data transaksi, resep, dan kontak pelanggan dapat Anda ekspor ke format Excel / CSV kapan saja.',
  },
  {
    q: 'Seberapa aman data resep rahasia dan laporan omzet toko saya?',
    a: 'Data Anda dijamin aman dengan isolasi multi-tenant di database Supabase enterprise. Akses API MCP juga dilindungi token keamanan terenkripsi dan role-based access control, sehingga staf kasir tidak bisa mengintip data laba bersih atau HPP resep rahasia toko.',
  },
  {
    q: 'Apa itu fitur POS Intelligence AI yang ada pada paket sewa?',
    a: 'Fitur POS Intelligence AI memungkinkan owner menanyakan pertanyaan analitik seputar toko langsung lewat chat AI (seperti: "Berapa omzet dan menu terlaris minggu ini?", "Bahan baku apa yang menipis?", "Apakah ada kasir yang shift-nya tekor?"). AI akan menarik data valid dan menyajikan analisis instan dalam hitungan detik.',
  },
  {
    q: 'Bagaimana jika saya atau kasir saya butuh bantuan saat operasional toko?',
    a: 'Kami menyediakan dokumentasi panduan video interaktif per peran (kasir, dapur, owner) serta layanan bantuan teknis via WhatsApp yang siap mendampingi tim toko Anda.',
  },
]

type StoreLink = { slug: string; name: string }

function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-primary/10 ring-1 ring-black/5 dark:ring-white/10">
      <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-3">
        <span className="size-3 rounded-full bg-rose-500/80" />
        <span className="size-3 rounded-full bg-amber-500/80" />
        <span className="size-3 rounded-full bg-emerald-500/80" />
        <span className="ml-3 font-mono text-xs text-muted-foreground/80">pos.restonusantara.app</span>
      </div>
      {children}
    </div>
  )
}

function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-64 overflow-hidden rounded-[2.5rem] border-[10px] border-foreground/90 bg-card shadow-2xl shadow-primary/15 ring-1 ring-black/10">
      <div className="h-6 w-full bg-foreground/90 flex items-center justify-center">
        <span className="h-3 w-16 rounded-full bg-background/20" />
      </div>
      <img src={src} alt={alt} width={390} height={800} loading="lazy" className="block h-auto w-full object-cover" />
    </div>
  )
}

export function LandingPage() {
  const [stores, setStores] = useState<StoreLink[]>([])
  const [activeTab, setActiveTab] = useState('kasir')
  const [isYearly, setIsYearly] = useState(false)

  useEffect(() => {
    fetchStores().then(setStores).catch(() => setStores([]))
  }, [])

  const currentShowcase = SHOWCASE_TABS.find((t) => t.id === activeTab) || SHOWCASE_TABS[0]

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-4" />
            </span>
            <span>{APP_NAME}</span>
            <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary sm:inline-block">Cloud SaaS</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex" aria-label="Menu navigasi">
            <a href="#fitur" className="transition-colors hover:text-foreground">Fitur</a>
            <a href="#komparasi" className="transition-colors hover:text-foreground">Keunggulan Sewa</a>
            <a href="#paket" className="transition-colors hover:text-foreground">Paket Sewa</a>
            <a href="#keamanan" className="transition-colors hover:text-foreground">Keamanan</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Masuk
            </Link>
            <Link to="/register" className={buttonVariants({ size: 'sm' }) + ' shadow-sm'}>
              Coba 14 Hari Gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ─── HERO SECTION ─── */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[36rem] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent blur-2xl" />
          
          <div className="mx-auto max-w-6xl px-4 text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                <span>Sistem Kasir & QR Order Restoran Siap Sewa Bulanan</span>
              </div>

              <h1 className="mx-auto mt-6 max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl sm:leading-[1.12]">
                Kelola Kasir, Dapur, dan Stok Restoran Tanpa Investasi Mesin Mahal.
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg sm:leading-relaxed">
                Terima pesanan mandiri lewat QR meja, pantau antrean masak di layar dapur, dan lacak omzet serta HPP bahan baku secara real-time. Langsung jalan dari laptop, tablet, atau smartphone Anda.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                <Link to="/register" className={buttonVariants({ size: 'lg' }) + ' h-12 px-6 text-base font-semibold shadow-md shadow-primary/20'}>
                  Mulai Coba Gratis 14 Hari <ArrowRight className="size-4 ml-1.5" />
                </Link>
                <a
                  href={WA_SALES_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' h-12 px-5 text-base font-medium'}
                >
                  <MessageSquare className="size-4 mr-2 text-emerald-600" /> Tanya Sewa via WhatsApp
                </a>
              </div>

              <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2.5 text-sm font-medium text-muted-foreground">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" /> 0% Komisi Transaksi</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" /> Bebas Pakai Gadget Apapun</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" /> Tanpa Kontrak Pinalti</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" /> Siap Pakai dalam 5 Menit</li>
              </ul>
            </Reveal>

            {/* ─── INTERACTIVE SHOWCASE TABS ─── */}
            <Reveal delay={0.15} className="mt-14">
              <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border/80 pb-4">
                {SHOWCASE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mx-auto mt-8 grid max-w-5xl items-center gap-8 rounded-3xl border border-border/80 bg-card/60 p-6 text-left backdrop-blur-sm lg:grid-cols-12 lg:p-10">
                <div className="lg:col-span-5 space-y-4">
                  <span className="inline-block rounded-md bg-primary/10 px-3 py-1 text-xs font-bold text-primary tracking-wide uppercase">
                    {currentShowcase.tag}
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {currentShowcase.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {currentShowcase.text}
                  </p>
                  <ul className="space-y-2.5 pt-2">
                    {currentShowcase.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3" />
                        </span>
                        <span className="text-foreground/90">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lg:col-span-7 flex justify-center">
                  {currentShowcase.phone ? (
                    <PhoneFrame src={currentShowcase.img} alt={currentShowcase.alt} />
                  ) : (
                    <BrowserFrame>
                      <img
                        src={currentShowcase.img}
                        alt={currentShowcase.alt}
                        width={1440}
                        height={900}
                        loading="lazy"
                        className="block h-auto w-full"
                      />
                    </BrowserFrame>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── QUICK METRICS / BADGES ─── */}
        <section className="border-y border-border/60 bg-muted/40 py-6">
          <ul className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center justify-center gap-2.5 text-sm font-semibold text-foreground/90">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── KENAPA LEBIH MENGUNTUNGKAN SEWA (KOMPARASI) ─── */}
        <section id="komparasi" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Analisis Efisiensi Biaya
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Mengapa Menyewa Jauh Lebih Untung Dibanding Beli POS Konvensional?
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Bandingkan investasi awal dan biaya operasional tersembunyi. Kami merancang sistem ini agar bisnis kuliner Anda langsung profit sejak hari pertama.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/70 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Aspek Perbandingan</th>
                  <th className="px-6 py-4 text-rose-600 dark:text-rose-400">Sistem POS Lama / Mesin Konvensional</th>
                  <th className="px-6 py-4 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">Sewa Cloud POS Resto Kami</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-semibold text-foreground">{row.feature}</td>
                    <td className="px-6 py-4 text-muted-foreground flex items-start gap-2">
                      <XCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{row.legacy}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground bg-emerald-50/30 dark:bg-emerald-950/10">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{row.pos}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── FITUR LENGKAP EKOSISTEM ─── */}
        <section id="fitur" className="border-t border-border/80 bg-muted/20 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center max-w-3xl mx-auto">
              <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                Fitur Terintegrasi
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Semua Yang Dibutuhkan Restoran & Kafe Ada di Sini
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Satu aplikasi yang menggantikan kebutuhan mesin kasir terpisah, printer dapur manual, dan pembukuan stok excel.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }, i) => (
                <Reveal key={title} delay={Math.min(i, 4) * 0.04} className="h-full">
                  <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
                    <div>
                      <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-6" />
                      </span>
                      <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PAKET SEWA / PRICING PLANS ─── */}
        <section id="paket" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Pilihan Paket Sewa
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Paket Sewa Fleksibel, Tanpa Biaya Tersembunyi
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Pilih paket yang paling pas untuk skala usaha Anda. Bebas ganti paket atau batalkan kapan saja.
            </p>

            {/* Toggle Billing */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-muted/60 p-1.5 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setIsYearly(false)}
                className={`rounded-full px-4 py-1.5 transition-all ${
                  !isYearly ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sewa Bulanan
              </button>
              <button
                type="button"
                onClick={() => setIsYearly(true)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-all ${
                  isYearly ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Sewa Tahunan</span>
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white">Hemat 2 Bulan</span>
              </button>
            </div>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-3 items-stretch">
            {PRICING_PLANS.map((plan) => {
              const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col justify-between rounded-3xl border p-8 transition-all ${
                    plan.highlight
                      ? 'border-primary bg-card shadow-xl shadow-primary/10 ring-2 ring-primary'
                      : 'border-border bg-card/70 hover:border-border/80'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-primary-foreground shadow-sm">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-extrabold text-foreground">{plan.name}</h3>
                      {!plan.highlight && (
                        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{plan.desc}</p>

                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                        Rp {price.toLocaleString('id-ID')}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">/bulan</span>
                    </div>
                    {isYearly && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Ditagih tahunan (Rp {(price * 12).toLocaleString('id-ID')}/thn)
                      </p>
                    )}

                    <div className="my-6 border-t border-border" />

                    <ul className="space-y-3 text-sm text-foreground/90">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <Check className="size-4 shrink-0 text-primary mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-4">
                    <Link
                      to="/register"
                      className={
                        buttonVariants({
                          variant: plan.highlight ? 'default' : 'outline',
                          size: 'lg',
                        }) + ' w-full font-bold shadow-xs'
                      }
                    >
                      {plan.cta} <ArrowRight className="size-4 ml-1.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              Butuh paket custom untuk jaringan waralaba besar (&gt;10 cabang)?{' '}
              <a href={WA_SALES_LINK} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">
                Hubungi Konsultan Kami
              </a>
            </p>
          </div>
        </section>

        {/* ─── KEAMANAN DATA ENTERPRISE ─── */}
        <section id="keamanan" className="border-y border-border/80 bg-foreground py-20 text-background">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center max-w-3xl mx-auto">
              <span className="rounded-full bg-primary/20 px-3.5 py-1 text-xs font-bold text-primary tracking-wider uppercase">
                Standar Keamanan Toko
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Dibuat untuk Uang dan Data yang Wajib Akurat
              </h2>
              <p className="mt-3 text-base text-background/70">
                Pondasi database dan kontrol supervisor yang menjaga agar selisih kas, kebocoran bahan, atau kecurangan kasir langsung terdeteksi.
              </p>
            </div>

            <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xs">
                  <Icon className="size-7 text-primary" />
                  <h3 className="mt-4 font-bold text-lg text-background">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-background/75">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── 3 LANGKAH MULAI ─── */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Mulai Jualan dalam 3 Langkah</h2>
            <p className="mt-3 text-base text-muted-foreground">Tanpa teknisi datang ke toko. Sistem siap diaktifkan langsung oleh Anda.</p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="relative rounded-2xl border border-border bg-card p-7 shadow-xs">
                <span className="text-3xl font-black text-primary/30 font-mono">{s.step}</span>
                <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── FAQ SIAP SEWA (LENGKAP) ─── */}
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Tanya Jawab Sewa
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Pertanyaan yang Sering Diajukan Calon Penyewa
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Semua hal penting mengenai biaya sewa, perangkat keras, keamanan data, dan dukungan teknis.
            </p>
          </div>

          <div className="mt-12 space-y-3.5">
            {RENTAL_FAQ.map(({ q, a }, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-border bg-card px-6 py-4.5 transition-all duration-200 open:shadow-md open:border-primary/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-foreground text-base">
                  <span>{q}</span>
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground border-t border-border/50 pt-3.5">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── TOKO PENGGUNA (LIVE DEMO) ─── */}
        {stores.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-20">
            <div className="rounded-3xl border border-border bg-muted/20 p-8 sm:p-10">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Ingin Melihat Contoh Menu Pelanggan?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Coba buka menu online salah satu outlet yang telah beroperasi menggunakan platform ini:
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stores.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to={`/s/${s.slug}?meja=T1`}
                      className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <span className="flex items-center gap-2">
                        <Store className="size-4 text-primary" /> {s.name}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ─── BOTTOM CTA BANNER ─── */}
        <section className="mx-auto mb-20 max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground shadow-2xl shadow-primary/25 sm:px-14">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-20 size-72 rounded-full bg-black/10 blur-3xl" />
            
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Siap Mengembangkan Usaha Kuliner Anda Lebih Cepat?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-base opacity-95 leading-relaxed">
              Daftar sekarang, nikmati uji coba gratis 14 hari penuh. Tanpa perlu beli server, tanpa potong komisi omzet.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className={buttonVariants({ variant: 'secondary', size: 'lg' }) + ' h-12 px-7 text-base font-bold shadow-md'}
              >
                Mulai Uji Coba Gratis 14 Hari <ArrowRight className="size-4 ml-1.5" />
              </Link>
              <a
                href={WA_SALES_LINK}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'ghost', size: 'lg' }) + ' h-12 px-6 text-base font-semibold border border-white/25 hover:bg-white/15 text-primary-foreground'}
              >
                <Headphones className="size-4 mr-2" /> Hubungi Sales via WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium">
            <Store className="size-4 text-primary" />
            <span>© {new Date().getFullYear()} {APP_NAME}. Solusi Cloud POS &amp; Self-Ordering Restoran.</span>
          </div>
          <nav className="flex gap-6 font-medium" aria-label="Tautan Legal">
            <Link to="/privasi" className="transition-colors hover:text-foreground">Kebijakan Privasi</Link>
            <Link to="/syarat" className="transition-colors hover:text-foreground">Syarat &amp; Ketentuan</Link>
            <Link to="/login" className="transition-colors hover:text-foreground">Login Staf</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
