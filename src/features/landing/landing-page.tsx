import {
  ArrowRight,
  Boxes,
  Calculator,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Coins,
  Gift,
  Headphones,
  Lock,
  MessageSquare,
  Pause,
  Play,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  UserCog,
  Video,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Reveal } from '@shared/components/reveal'
import { buttonVariants } from '@shared/components/ui/button'
import { fetchStores } from '@shared/lib/api'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'POS Resto'
const WA_SALES_LINK = 'https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20tertarik%20konsultasi%20sewa%20sistem%20POS%20untuk%20restoran%2Fkafe%20saya.'

const formatRp = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num)

const QUICK = [
  { icon: Smartphone, text: 'Bisa di HP, iPad, Tablet Android & Laptop' },
  { icon: Coins, text: '0% Komisi Transaksi (Omzet 100% Milik Anda)' },
  { icon: Receipt, text: 'Cetak Struk Thermal & Tiket Dapur Otomatis' },
  { icon: Sparkles, text: 'Terintegrasi Asisten AI Analisis Finansial' },
]

const SHOWCASE_TABS = [
  {
    id: 'kasir',
    label: 'Layar Kasir POS',
    tag: 'Kasir & Pembayaran',
    title: 'Pencatatan kasir secepat kilat dengan kontrol laci transparan',
    text: 'Kasir melayani pesanan makan di tempat atau bungkus, split bill, cetak struk thermal, dan menutup shift dengan audit uang kas yang rapi.',
    points: [
      'Pemisahan otomatis uang setoran owner vs modal kembalian di laci',
      'Pilihan bayar lengkap: Tunai, QRIS dinamis, dan Kartu EDC',
      'Pencarian menu instan dengan filter kategori & status ketersediaan',
      'Proteksi pembatalan transaksi (void) dengan otorisasi PIN supervisor',
    ],
    img: '/landing/kasir.webp',
    video: '/landing/video-kasir.webm',
    alt: 'Antarmuka layar kasir dengan keranjang dan katalog menu',
  },
  {
    id: 'qr',
    label: 'Menu QR Meja',
    tag: 'Pemesanan Mandiri Tamu',
    title: 'Pelanggan pesan dan bayar dari meja tanpa antre di kasir',
    text: 'Cukup cetak stiker QR di tiap meja. Tamu memindai kode lewat kamera HP mereka, memilih menu beserta varian, dan pesanan langsung masuk ke dapur.',
    points: [
      'Tanpa download aplikasi, bekerja langsung di browser smartphone tamu',
      'Status stok menu otomatis sinkron (menu habis tidak bisa dipilih)',
      'Dukungan catatan khusus pelanggan (mis. tanpa gula, pedas sedang)',
      'Memangkas beban antrean kasir hingga 60% saat jam-jam sibuk',
    ],
    img: '/landing/pelanggan.webp',
    video: '/landing/video-qr.webm',
    alt: 'Tampilan menu pelanggan responsif di layar smartphone',
    phone: true,
  },
  {
    id: 'dapur',
    label: 'Layar Dapur (KDS)',
    tag: 'Kitchen Display System',
    title: 'Tiket antrean pesanan real-time di dapur tanpa kertas tercecer',
    text: 'Pesanan lunas seketika tampil di monitor dapur koki. Dilengkapi penanda waktu masak visual agar seluruh sajian keluar tepat waktu.',
    points: [
      'Tiket terurut otomatis berdasarkan waktu pesanan masuk ke sistem',
      'Indikator timer visual warna-warni untuk memantau pesanan yang terlambat',
      'Koki cukup ketuk layar untuk menandai masakan selesai disiapkan',
      'Mencegah salah baca pesanan atau tiket nota yang hilang di dapur',
    ],
    img: '/landing/dapur.webp',
    video: '/landing/video-dapur.webm',
    alt: 'Layar monitor dapur KDS dengan antrean tiket memasak',
  },
  {
    id: 'laporan',
    label: 'Dashboard & Laba',
    tag: 'Laporan & Finansial',
    title: 'Pantau omzet, laba kotor, dan HPP restoran kapan saja',
    text: 'Owner dapat mengakses data performa toko langsung dari HP di luar kota. Analisis hari ramai, menu terlaris, dan kas tekor tersaji akurat.',
    points: [
      'Perhitungan omzet kotor, omzet bersih, diskon, dan pajak restoran',
      'Laporan laba kotor (Gross Profit) dan rasio margin laba tiap produk',
      'Ekspor seluruh data transaksi dan inventori ke format CSV / Excel',
      'Riwayat tutup shift dan audit selisih kas tiap pergantian kasir',
    ],
    img: '/landing/dashboard.webp',
    video: '/landing/video-dashboard.webm',
    alt: 'Dashboard analitik penjualan dan grafik laba kotor',
  },
  {
    id: 'stok',
    label: 'Stok & Resep',
    tag: 'Inventori Otomatis',
    title: 'Stok bahan baku terpotong otomatis saat pesanan lunas',
    text: 'Cukup masukkan takaran resep sekali. Setiap porsi kopi atau makanan yang terjual otomatis memotong gramatur bahan di gudang dan dapur.',
    points: [
      'Peringatan otomatis saat persediaan bahan baku kritis atau menipis',
      'Sisa porsi yang bisa dibuat langsung terlihat di layar kasir',
      'Pencatatan barang masuk (restock), barang rusak (waste), dan opname',
      'Mencegah kebocoran bahan baku dan selisih stok dapur yang merugikan',
    ],
    img: '/landing/stok.webp',
    video: '/landing/video-stok.webm',
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
    legacy: 'Dikenakan potongan 1% - 2.5% dari total omzet transaksi',
    pos: '0% Komisi (100% uang penjualan masuk ke rekening Anda)',
  },
  {
    feature: 'Perangkat Keras (Hardware)',
    legacy: 'Terkunci hanya bisa di perangkat mesin kasir khusus mereka',
    pos: 'Bebas pakai HP, Tablet Android, iPad, atau Laptop yang sudah ada',
  },
  {
    feature: 'Printer Struk & Laci Kas',
    legacy: 'Wajib membeli printer mahal dengan konektor spesifik',
    pos: 'Kompatibel dengan semua printer Bluetooth thermal 58mm & 80mm standar',
  },
  {
    feature: 'Pembaruan Fitur (Update)',
    legacy: 'Bayar biaya upgrade mahal atau teknisi datang ke lokasi',
    pos: 'Update cloud otomatis gratis seumur masa sewa berlangsung',
  },
  {
    feature: 'Resiko Kerugian Bisnis',
    legacy: 'Rugi modal besar jika konsep restoran berganti arah',
    pos: 'Bisa berhenti sewa kapan saja tanpa biaya penalti atau denda',
  },
]

const PRICING_PLANS = [
  {
    id: 'starter',
    name: 'Starter Resto',
    badge: 'Kedai & Warung',
    desc: 'Pilihan hemat untuk usaha kuliner pemula, warung kopi, booth takeaway, atau cloud kitchen tunggal.',
    monthlyPrice: 99_000,
    annualPrice: 79_000,
    features: [
      '1 Outlet / Toko aktif',
      '1 Akun Kasir + 1 Akun Dapur',
      'Pemesanan QR Meja Mandiri tanpa batas',
      'Cetak struk thermal 58mm / 80mm',
      'Laporan omzet harian & bulanan',
      'Dukungan via WhatsApp Chat',
    ],
    ctaText: 'Pilih Paket Starter',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro Resto',
    badge: 'Paling Diminati',
    desc: 'Solusi lengkap untuk kafe, resto keluarga, dan bistro dengan kebutuhan kontrol stok bahan dan multi-staf.',
    monthlyPrice: 189_000,
    annualPrice: 149_000,
    features: [
      '1 Outlet Utama + Bebas Meja',
      'Kasir & Staf Pelayan tak terbatas',
      'Layar Dapur KDS real-time monitor',
      'Manajemen Resep & Potong Stok Otomatis',
      'Audit Shift Kasir & Deteksi Kas Tekor',
      'Fitur POS Intelligence AI (MCP Analysis)',
      'Program Member, Poin & Voucher Promo',
      'Prioritas Dukungan Teknis Fast Response',
    ],
    ctaText: 'Sewa Paket Pro (Rekomendasi)',
    popular: true,
  },
  {
    id: 'multi',
    name: 'Multi-Outlet',
    badge: 'Waralaba & Cabang',
    desc: 'Untuk pemilik bisnis dengan banyak cabang restoran yang membutuhkan laporan konsolidasi pusat terintegrasi.',
    monthlyPrice: 349_000,
    annualPrice: 279_000,
    features: [
      'Hingga 5 Outlet Resto (Bisa tambah)',
      'Seluruh Fitur Paket Pro di tiap outlet',
      'Laporan Konsolidasi Omzet Multi-Cabang',
      'Manajemen Transfer Stok Antar Gudang',
      'Audit log aktivitas & proteksi anti-fraud',
      'Akses API Webhook & Integrasi Khusus',
      'Pendampingan Onboarding & Setup Menu',
    ],
    ctaText: 'Hubungi Sales Multi-Cabang',
    popular: false,
  },
]

const RENTAL_STEPS = [
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
    q: 'Apakah saya harus membeli perangkat kasir khusus dari Anda?',
    a: 'Tidak sama sekali. Sistem kami berbasis web modern (PWA) yang fleksibel. Anda dapat menggunakan perangkat yang sudah Anda miliki: HP Android, iPhone, iPad, tablet, laptop, atau komputer kasir Windows. Anda bebas berhemat modal hingga belasan juta rupiah.',
  },
  {
    q: 'Apakah benar omzet saya 0% komisi tanpa potongan?',
    a: 'Benar 100%. Kami tidak memotong 1 rupiah pun dari nilai transaksi Anda. Seluruh hasil penjualan tunai, QRIS, maupun kartu EDC masuk utuh ke rekening bank restoran Anda. Anda hanya membayar biaya sewa software flat bulanan sesuai paket yang dipilih.',
  },
  {
    q: 'Printer apa saja yang didukung untuk mencetak struk?',
    a: 'Sistem mendukung semua printer thermal standar yang beredar di pasaran, baik ukuran 58mm maupun 80mm dengan koneksi Bluetooth, USB, maupun Ethernet/LAN (kompatibel dengan ESC/POS).',
  },
  {
    q: 'Bisakah saya mencoba dulu sebelum membayar biaya sewa?',
    a: 'Tentu saja! Kami memberikan masa uji coba gratis selama 14 hari dengan akses fitur lengkap. Tanpa perlu kartu kredit dan tanpa komitmen. Anda bisa mencoba langsung di outlet Anda untuk merasakan kemudahannya.',
  },
  {
    q: 'Bagaimana jika saya ingin membuka cabang restoran baru?',
    a: 'Anda cukup beralih ke paket Multi-Outlet atau menambahkan outlet baru di dashboard toko Anda. Seluruh data menu dan inventori dapat diduplikasi dalam hitungan menit, dan Anda dapat memantau omzet seluruh cabang dalam satu layar laporan konsolidasi.',
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

function BrowserFrame({ children, isLive = true }: { children: ReactNode; isLive?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-primary/10 ring-1 ring-black/5 dark:ring-white/10">
      <div className="flex items-center justify-between border-b bg-muted/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-rose-500/80" />
          <span className="size-3 rounded-full bg-amber-500/80" />
          <span className="size-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2 font-mono text-xs text-muted-foreground">pos.restonusantara.app</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sistem Aktual</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-72 overflow-hidden rounded-[2.5rem] border-[10px] border-foreground/90 bg-card shadow-2xl shadow-primary/15 ring-1 ring-black/10">
      <div className="h-6 w-full bg-foreground/90 flex items-center justify-center">
        <span className="h-3 w-16 rounded-full bg-background/20" />
      </div>
      {children}
    </div>
  )
}

/** Media Viewer: Berpindah mulus antara Video Demo Aktual & Tangkapan Layar HD */
function ShowcaseMedia({
  videoSrc,
  imgSrc,
  alt,
  phone = false,
  mode = 'video',
}: {
  videoSrc: string
  imgSrc: string
  alt: string
  phone?: boolean
  mode: 'video' | 'image'
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    if (videoRef.current) {
      if (mode === 'video') {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {})
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }, [mode, videoSrc])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const content = (
    <div className="relative group bg-muted/20">
      {mode === 'video' ? (
        <div className="relative">
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className={`block w-full object-cover ${phone ? 'h-[540px]' : 'h-auto max-h-[520px]'}`}
          />
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Jeda video' : 'Putar video'}
            className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md shadow-md transition-transform hover:scale-105"
          >
            {isPlaying ? (
              <>
                <Pause className="size-3.5 fill-current" /> Jeda
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" /> Putar
              </>
            )}
          </button>
        </div>
      ) : (
        <img
          src={imgSrc}
          alt={alt}
          width={phone ? 390 : 1280}
          height={phone ? 844 : 800}
          loading="lazy"
          className={`block w-full object-cover ${phone ? 'h-[540px]' : 'h-auto max-h-[520px]'}`}
        />
      )}
    </div>
  )

  if (phone) {
    return <PhoneFrame>{content}</PhoneFrame>
  }

  return <BrowserFrame>{content}</BrowserFrame>
}

/** Kalkulator Penghematan Biaya Sewa POS vs Sistem Berkomisi */
function SavingsCalculator() {
  const [revenue, setRevenue] = useState(60_000_000)
  const legacyRate = 0.02 // Rata-rata komisi kompetitor 2%
  const monthlyCostOther = Math.round(revenue * legacyRate)
  const ourRentalCost = 189_000 // Paket Pro Resto
  const monthlySavings = Math.max(0, monthlyCostOther - ourRentalCost)
  const annualSavings = monthlySavings * 12

  return (
    <div className="mx-auto mt-12 max-w-4xl rounded-3xl border border-primary/20 bg-gradient-to-b from-card to-card/60 p-6 shadow-xl shadow-primary/5 sm:p-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-center">
        <div className="flex-1 space-y-4 text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Calculator className="size-3.5" />
            <span>Kalkulator Efisiensi Biaya</span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hitung Berapa Uang yang Anda Hemat dengan Sewa POS 0% Komisi
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sistem POS lain memotong 1.5% hingga 2.5% dari setiap rupiah yang masuk ke restoran Anda. Dengan skema sewa flat tanpa komisi, omzet Anda 100% menjadi hak Anda.
          </p>

          <div className="pt-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Estimasi Omzet Resto Anda / Bulan:</span>
              <span className="text-lg font-extrabold text-primary">{formatRp(revenue)}</span>
            </div>
            <input
              type="range"
              min={15_000_000}
              max={250_000_000}
              step={5_000_000}
              value={revenue}
              onChange={(e) => setRevenue(Number(e.target.value))}
              aria-label="Estimasi Omzet Resto per Bulan"
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Rp 15 Juta</span>
              <span>Rp 120 Juta</span>
              <span>Rp 250 Juta</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 rounded-2xl border border-border/80 bg-background/80 p-6 text-left shadow-inner">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perbandingan Biaya Bulanan</span>

          <div className="mt-4 space-y-3 pb-4 border-b border-border/80 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">POS Lain (Komisi 2%):</span>
              <span className="font-semibold text-rose-500">{formatRp(monthlyCostOther)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Sewa POS Pro (0% Komisi):</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Rp 189.000</span>
            </div>
          </div>

          <div className="pt-4 space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Anda Menghemat Bersih:</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatRp(monthlySavings)}
              <span className="text-xs font-normal text-muted-foreground"> / bulan</span>
            </div>
            <p className="text-[11px] text-muted-foreground/90 pt-1">
              Atau <strong className="text-foreground">{formatRp(annualSavings)}/tahun</strong> yang bisa Anda alihkan untuk modal bahan baku atau bonus staf.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const [activeTab, setActiveTab] = useState('kasir')
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video')
  const [isAnnual, setIsAnnual] = useState(false)
  const [demoStores, setDemoStores] = useState<StoreLink[]>([])

  useEffect(() => {
    fetchStores()
      .then((stores) => {
        if (Array.isArray(stores) && stores.length > 0) {
          setDemoStores(stores)
        }
      })
      .catch(() => {})
  }, [])

  const currentShowcase = SHOWCASE_TABS.find((t) => t.id === activeTab) || SHOWCASE_TABS[0]

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <Store className="size-4" />
            </span>
            <span>{APP_NAME}</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex" aria-label="Menu navigasi">
            <a href="#fitur" className="transition-colors hover:text-foreground">Fitur Resto</a>
            <a href="#komparasi" className="transition-colors hover:text-foreground">Keunggulan Sewa</a>
            <a href="#kalkulator" className="transition-colors hover:text-foreground">Kalkulator Hemat</a>
            <a href="#paket" className="transition-colors hover:text-foreground">Paket Sewa</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Masuk
            </Link>
            <Link
              to="/register"
              className={buttonVariants({ size: 'sm', className: 'shadow-sm shadow-primary/25 font-semibold' })}
            >
              Coba 14 Hari Gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ─── HERO SECTION: VALUE PROPOSITION SEWA POS ─── */}
        <section className="relative overflow-hidden px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          {/* Subtle Ambient Glow */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-primary/15 to-amber-500/10 blur-3xl" />

          <div className="mx-auto max-w-5xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Sewa Sistem POS Resto & Kafe Modern · 0% Komisi Transaksi</span>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.15]">
                Sistem Kasir & Dapur Restoran Lengkap, <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-primary via-primary/90 to-amber-600 bg-clip-text text-transparent">
                  Tanpa Beban Modal Awal Jutaan Rupiah
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Solusi sewa bulanan all-in-one untuk kafe, resto, dan warung makan. Dilengkapi aplikasi kasir cepat, pemesanan QR meja mandiri, layar monitor dapur (KDS), kontrol resep bahan baku, dan asisten AI finansial.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
                <Link
                  to="/register"
                  className={buttonVariants({
                    size: 'lg',
                    className: 'h-13 w-full px-8 text-base font-semibold shadow-lg shadow-primary/25 sm:w-auto',
                  })}
                >
                  Coba Demo Gratis 14 Hari
                  <ArrowRight className="ml-2 size-4" />
                </Link>
                <a
                  href={WA_SALES_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'lg',
                    className: 'h-13 w-full border-2 px-8 text-base font-semibold sm:w-auto hover:bg-muted',
                  })}
                >
                  <MessageSquare className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                  Konsultasi Sewa via WhatsApp
                </a>
              </div>

              <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" /> Bebas Pakai Perangkat Sendiri</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" /> Tanpa Kontrak Penalti</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" /> Siap Pakai dalam 5 Menit</li>
              </ul>
            </Reveal>

            {/* ─── INTERACTIVE SHOWCASE TABS DENGAN VIDEO DEMO ─── */}
            <section id="fitur" className="scroll-mt-20">
              <Reveal delay={0.2} className="mt-14">
                {/* Tab Switcher & Video/Image Toggle */}
                <div className="flex flex-col items-center gap-4">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-border/80 bg-muted/60 p-1.5 backdrop-blur-sm">
                    {SHOWCASE_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                          activeTab === tab.id
                            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                            : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Mode Selector: Video Aktual vs Screenshot */}
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span>Tampilan Showcase:</span>
                    <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setMediaMode('video')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition-all ${
                          mediaMode === 'video'
                            ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                            : 'hover:text-foreground'
                        }`}
                      >
                        <Video className="size-3.5" />
                        <span>Video Demo Berjalan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaMode('image')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition-all ${
                          mediaMode === 'image'
                            ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                            : 'hover:text-foreground'
                        }`}
                      >
                        <TrendingUp className="size-3.5" />
                        <span>Tangkapan Layar HD</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Showcase Container */}
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

                    <div className="pt-3">
                      <a
                        href={WA_SALES_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        <span>Tanyakan implementasi fitur ini untuk resto Anda</span>
                        <ChevronRight className="size-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="lg:col-span-7 flex justify-center">
                    <ShowcaseMedia
                      videoSrc={currentShowcase.video}
                      imgSrc={currentShowcase.img}
                      alt={currentShowcase.alt}
                      phone={currentShowcase.phone}
                      mode={mediaMode}
                    />
                  </div>
                </div>
              </Reveal>
            </section>
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
              Bandingkan resiko modal, fleksibilitas perangkat keras, dan keuntungan jangka panjang bagi kelangsungan kas restoran Anda.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto rounded-3xl border border-border/80 bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-6 py-4">Kriteria Penilaian</th>
                  <th scope="col" className="px-6 py-4 text-rose-500">POS Konvensional / Beli Putus</th>
                  <th scope="col" className="px-6 py-4 text-primary bg-primary/5">Sewa Sistem {APP_NAME}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON.map(({ feature, legacy, pos }) => (
                  <tr key={feature} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4.5 font-semibold text-foreground">{feature}</td>
                    <td className="px-6 py-4.5 text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500/80" />
                        <span>{legacy}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 font-semibold text-foreground bg-primary/5">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{pos}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── KALKULATOR PENGHEMATAN BIAYA SEWA ─── */}
        <section id="kalkulator" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-8">
          <SavingsCalculator />
        </section>

        {/* ─── FITUR F&B RESTORAN LENGKAP ─── */}
        <section className="bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center max-w-2xl mx-auto">
              <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                Fitur Lengkap Industri Kuliner
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Semua Kebutuhan Restoran Anda Sudah Tersedia
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Didesain khusus untuk alur kerja operasional F&B Indonesia: dari kasir, dapur, manajemen resep, hingga asisten AI.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CARA MEMULAI SEWA (3 LANGKAH) ─── */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Onboarding Cepat
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Mulai Pakai dalam 3 Langkah Sederhana
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Tidak butuh instalasi rumit ataupun teknisi datang. Semua berjalan langsung di browser perangkat Anda.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {RENTAL_STEPS.map(({ step, title, text }) => (
              <div key={step} className="relative rounded-3xl border border-border bg-card p-8 shadow-xs">
                <span className="font-mono text-3xl font-black text-primary/30">{step}</span>
                <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── TABEL PAKET SEWA (PRICING) ─── */}
        <section id="paket" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Pilihan Paket Sewa Transparan
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Biaya Sewa Terjangkau, Tanpa Potongan Omzet
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Semua paket sudah termasuk server cloud berkecepatan tinggi, backup otomatis harian, dan gratis update fitur berkala.
            </p>

            {/* Billing Toggle: Bulanan vs Tahunan */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-muted/60 p-1.5">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all sm:text-sm ${
                  !isAnnual ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Bayar Bulanan
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all sm:text-sm ${
                  isAnnual ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Bayar Tahunan</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  Hemat 2 Bulan
                </span>
              </button>
            </div>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {PRICING_PLANS.map((plan) => {
              const price = isAnnual ? plan.annualPrice : plan.monthlyPrice
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-3xl border p-8 transition-all ${
                    plan.popular
                      ? 'border-primary bg-card shadow-2xl shadow-primary/10 ring-2 ring-primary'
                      : 'border-border bg-card/60 shadow-sm hover:border-primary/40'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-extrabold text-primary-foreground shadow-md shadow-primary/30 uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold tracking-tight text-foreground">{plan.name}</h3>
                      {!plan.popular && (
                        <span className="rounded-md bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{plan.desc}</p>

                    <div className="mt-6 border-y border-border/80 py-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                          {formatRp(price)}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">/ bulan</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {isAnnual ? 'Ditagih tahunan (hemat s.d 20%)' : 'Ditagih tiap bulan, batal kapan saja'}
                      </p>
                    </div>

                    <ul className="mt-6 space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-xs sm:text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-foreground/90">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-4">
                    <Link
                      to="/register"
                      className={buttonVariants({
                        variant: plan.popular ? 'default' : 'outline',
                        className: `w-full h-11 text-sm font-semibold ${
                          plan.popular ? 'shadow-md shadow-primary/25' : 'border-2'
                        }`,
                      })}
                    >
                      {plan.ctaText}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Butuh sewa khusus lebih dari 20 outlet waralaba atau fitur custom?{' '}
            <a href={WA_SALES_LINK} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
              Hubungi Tim Enterprise Sales via WhatsApp
            </a>
          </p>
        </section>

        {/* ─── KEAMANAN DATA & ISOLASI TENANT ─── */}
        <section id="keamanan" className="bg-muted/40 py-16 border-y border-border/60">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Keamanan Data & Privasi Terjamin
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Data Resep, Keuangan & Pelanggan Anda Sepenuhnya Terisolasi
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl mx-auto">
              Setiap tenant penyewa terlindungi dengan standar keamanan cloud perbankan dan enkripsi data tingkat enterprise.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-border bg-card p-5 text-left">
                <Lock className="size-6 text-primary" />
                <h4 className="mt-3 font-bold text-sm">Supabase Row-Level Security</h4>
                <p className="mt-1 text-xs text-muted-foreground">Tiap outlet memiliki partisi data sendiri. Staf atau toko lain tidak dapat mengakses resep atau laba toko Anda.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 text-left">
                <ShieldCheck className="size-6 text-primary" />
                <h4 className="mt-3 font-bold text-sm">Proteksi PIN Supervisor</h4>
                <p className="mt-1 text-xs text-muted-foreground">Fitur hapus item (void) dan diskon manual terkunci dengan PIN supervisor untuk mencegah kecurangan kasir.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 text-left">
                <Headphones className="size-6 text-primary" />
                <h4 className="mt-3 font-bold text-sm">Audit Trail Shift Kasir</h4>
                <p className="mt-1 text-xs text-muted-foreground">Setiap pembukaan laci, serah terima uang, dan selisih kas tercatat permanen di log audit toko Anda.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── LIVE OUTLET DEMO (DEMO TOKO AKTIF) ─── */}
        {demoStores.length > 0 && (
          <section className="mx-auto max-w-4xl px-4 py-16 text-center">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Coba Langsung Tanpa Daftar
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Kunjungi Toko Contoh di Bawah Ini
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rasakan pengalaman pelanggan memesan menu lewat QR meja secara langsung:
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {demoStores.map((st) => (
                <Link
                  key={st.slug}
                  to={`/s/${st.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-4 py-2.5 text-sm font-semibold shadow-xs transition-all hover:border-primary/50 hover:bg-muted"
                >
                  <Store className="size-4 text-primary" />
                  <span>{st.name}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ─── FAQ SIAP SEWA (LENGKAP) ─── */}
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-20 pt-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Tanya Jawab Sewa
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Pertanyaan Seputar Sewa POS
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
                  <span className="text-primary transition-transform duration-200 group-open:rotate-45 text-xl font-bold">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground border-t border-border/60 pt-3">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── FINAL CTA BANNER ─── */}
        <section className="border-t border-border bg-gradient-to-b from-primary/10 via-background to-background py-20">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <span className="rounded-full bg-primary/15 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Mulai Sekarang
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
              Siap Modernisasi Kasir & Dapur Resto Anda?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Daftar sekarang dan nikmati masa uji coba gratis 14 hari penuh. Tanpa kartu kredit, tanpa kontrak komitmen.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/register"
                className={buttonVariants({
                  size: 'lg',
                  className: 'h-13 w-full px-8 text-base font-semibold shadow-xl shadow-primary/30 sm:w-auto',
                })}
              >
                Coba 14 Hari Gratis Sekarang
                <ArrowRight className="ml-2 size-4" />
              </Link>
              <a
                href={WA_SALES_LINK}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                  className: 'h-13 w-full border-2 px-8 text-base font-semibold sm:w-auto',
                })}
              >
                <MessageSquare className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                Hubungi Konsultan Kami
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border bg-card py-12 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 md:flex-row">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-3.5" />
            </span>
            <span>{APP_NAME}</span>
            <span className="text-xs font-normal text-muted-foreground ml-2">
              · Sistem Sewa Kasir & Dapur Restoran 0% Komisi
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <a href="#fitur" className="hover:text-foreground">Fitur</a>
            <a href="#komparasi" className="hover:text-foreground">Komparasi Sewa</a>
            <a href="#kalkulator" className="hover:text-foreground">Kalkulator Hemat</a>
            <a href="#paket" className="hover:text-foreground">Paket Harga</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link to="/privasi" className="hover:text-foreground">Kebijakan Privasi</Link>
            <Link to="/syarat" className="hover:text-foreground">Ketentuan Layanan</Link>
          </div>

          <p className="text-xs">
            © {new Date().getFullYear()} {APP_NAME}. Hak cipta dilindungi undang-undang.
          </p>
        </div>
      </footer>
    </div>
  )
}
