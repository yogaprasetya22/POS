import {
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Coins,
  Gift,
  Globe,
  Headphones,
  Lock,
  MessageSquare,
  Pause,
  Play,
  QrCode,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  UserCog,
  Users,
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
      'Tiket pesanan & nomor antrean instan terbit di layar HP pelanggan',
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

const SETTINGS_FEATURES = [
  {
    icon: Receipt,
    badge: 'Struk & Printer Thermal',
    title: 'Format Struk & Kustomisasi Logo Toko',
    text: 'Sesuaikan cetak struk kasir dan tiket dapur Anda. Dukung logo hitam-putih, nama outlet, alamat lengkap, info kontak/wifi, serta ukuran kertas 58mm atau 80mm standar.',
    points: [
      'Format otomatis logo hitam-putih presisi untuk printer thermal',
      'Pesan ucapan terima kasih & promosi akun medsos di footer struk',
      'Kompatibel printer Bluetooth, USB, dan Ethernet LAN (ESC/POS)',
      'Dukungan buka laci kas otomatis (auto-kick cash drawer RJ11)',
    ],
  },
  {
    icon: Coins,
    badge: 'Pajak & Biaya Layanan',
    title: 'Pajak Restoran (PB1) & Service Charge',
    text: 'Hitung kewajiban pajak restoran dan biaya layanan tanpa hitung manual. Sistem mendukung tarif per outlet dengan pembukuan bersih terpisah.',
    points: [
      'Tarif PB1 (10%) dan Service Charge (5%) dapat disesuaikan fleksibel',
      'Pilihan harga inklusif (sudah termasuk) atau eksklusif (ditambahkan di nota)',
      'Pembulatan total nominal otomatis ke Rp100 atau Rp500 terdekat',
      'Laporan rekapitulasi setoran pajak daerah otomatis per bulan',
    ],
  },
  {
    icon: QrCode,
    badge: 'Denah Meja & QR',
    title: 'Manajemen Meja & Generator QR Cetak',
    text: 'Atur denah tempat duduk restoran (indoor, outdoor, lantai 2) dan terbitkan kode QR meja permanen hanya dengan satu kali klik.',
    points: [
      'Bebas atur penomoran meja, area ruangan, dan kapasitas kursi tamu',
      'Ekspor lembar PDF kode QR tajam siap cetak untuk akrilik meja',
      'Tamu langsung diarahkan ke nomor meja tanpa risiko salah antar pesanan',
      'Fleksibilitas mode: pesan mandiri bayar di awal atau bayar di kasir',
    ],
  },
  {
    icon: UserCog,
    badge: 'Keamanan & Tim',
    title: 'Hak Akses Staf Berjenjang & Proteksi PIN',
    text: 'Bagi wewenang kerja antara Owner, Manager, Kasir, Waiter, dan Koki dapur. Mencegah kecurangan kas dan manipulasi transaksi.',
    points: [
      'Login kilat kasir & kru menggunakan PIN 4 digit yang praktis',
      'Proteksi pembatalan transaksi (void), refund, dan ubah pesanan',
      'Diskon manual dan buka laci kas wajib otorisasi PIN supervisor',
      'Catatan audit aktivitas staf tersimpan aman di log sistem',
    ],
  },
  {
    icon: Gift,
    badge: 'Diskon & Promosi',
    title: 'Voucher Promo, Diskon % & Buy 1 Get 1',
    text: 'Tingkatkan omzet dengan berbagai skema promo menarik: potongan harga nominal, diskon persentase, paket bundling, atau kode voucher.',
    points: [
      'Atur periode aktif promo dengan tanggal mulai dan kedaluwarsa otomatis',
      'Syarat minimal nilai transaksi belanja atau kategori menu tertentu',
      'Kupon voucher eksklusif dengan pembatasan kuota penukaran',
      'Diskon teraplikasi seketika di kasir dan menu pemesanan QR meja',
    ],
  },
  {
    icon: Users,
    badge: 'Pelanggan Setia',
    title: 'Program Member & Loyalitas Poin Belanja',
    text: 'Bangun basis pelanggan tetap restoran Anda. Kumpulkan nomor WhatsApp pelanggan dan berikan poin setiap kali mereka bersantap di outlet Anda.',
    points: [
      'Daftar member kilat cukup dengan nomor telepon saat pembayaran',
      'Atur rasio poin (contoh: belanja Rp10.000 dapat 1 poin bernilai Rp100)',
      'Poin langsung bisa dipotongkan pada pembayaran transaksi berikutnya',
      'Riwayat total pesanan dan akumulasi belanja tiap pelanggan loyal',
    ],
  },
  {
    icon: ChefHat,
    badge: 'Operasional Dapur',
    title: 'Auto-Routing Tiket Dapur & Notifikasi Suara',
    text: 'Pastikan koki dapur dan barista bar menerima pesanan tanpa jeda. Sistem memisahkan tiket makanan dan minuman secara terorganisir.',
    points: [
      'Pemisahan pesanan otomatis: tiket minuman ke bar, makanan ke dapur masak',
      'Alarm lonceng suara saat ada pesanan baru masuk dari kasir atau QR meja',
      'Pilihan cetak rangkap untuk dapur koki dan pelayan penyaji makanan',
      'Terhubung langsung dengan layar panggil antrean pesanan siap saji',
    ],
  },
  {
    icon: Globe,
    badge: 'Multi-Bahasa & Nada Brand',
    title: 'Pilihan Bahasa & Penyesuaian Gaya Komunikasi',
    text: 'Sesuaikan gaya bahasa antarmuka kasir dan menu pelanggan dengan konsep bisnis Anda: kafe santai gaul, resto formal, atau ramah wisatawan.',
    points: [
      'Tersedia 3 opsi: Bahasa Indonesia baku, Santai (Jaksel), & English',
      'Kustomisasi kata sapaan dan kalimat peringatan sesuai konsep outlet',
      'Tiap staf kasir atau koki bebas memilih bahasa di perangkat masing-masing',
      'Memberikan sentuhan personal yang lebih akrab bagi pelanggan Anda',
    ],
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
    pos: 'Sewa bulanan fleksibel terjangkau, tanpa modal beli lisensi jutaan',
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
  {
    q: 'Apakah saya bisa mengatur sendiri format struk, logo, dan tarif pajak restoran saya?',
    a: 'Bisa dan sangat mudah. Melalui menu Pengaturan Toko, Anda dapat mengunggah logo monokrom untuk struk kasir, memasukkan alamat dan kontak outlet, mengatur persentase pajak PB1 (10%) atau service charge (inklusif/eksklusif), serta memilih ukuran kertas printer 58mm atau 80mm tanpa perlu bantuan teknisi.',
  },
  {
    q: 'Bagaimana cara mengatur hak akses staf agar kasir tidak sembarangan void atau beri diskon?',
    a: 'Sistem dilengkapi Role-Based Access Control (Owner, Manager, Kasir, Dapur, Waiter) dan proteksi PIN supervisor. Tindakan sensitif seperti void pesanan, refund, ubah harga, buka laci kas tunai manual, atau diskon manual terkunci dan wajib memasukkan PIN otorisasi manajer/owner.',
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

export function LandingPage() {
  const [activeTab, setActiveTab] = useState('kasir')
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video')
  const [settingsMediaMode, setSettingsMediaMode] = useState<'video' | 'image'>('video')
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
            <a href="#pengaturan" className="transition-colors hover:text-foreground">Pengaturan Toko</a>
            <a href="#komparasi" className="transition-colors hover:text-foreground">Keunggulan Sewa</a>
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

        {/* ─── PUSAT KENDALI & PENGATURAN OPERASIONAL RESTO (BACKOFFICE SUITE) ─── */}
        <section id="pengaturan" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Pusat Kendali & Konfigurasi Toko
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Pengaturan Operasional Lengkap, Kendalikan Seluruh Aturan Resto Anda
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Bukan sekadar mesin kasir biasa. Nikmati fleksibilitas penuh mengatur format struk thermal, pajak PB1, denah meja QR, hak akses tim, hingga program loyalitas member tanpa perlu bantuan teknisi.
            </p>
          </div>

          {/* Media Showcase: Foto HD & Video Demo Berjalan Pengaturan Toko */}
          <div className="mt-12">
            <div className="mx-auto max-w-4xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Pratinjau Layar Pengaturan Toko
                  </span>
                </div>

                <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSettingsMediaMode('video')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-all ${
                      settingsMediaMode === 'video'
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Video className="size-3.5" />
                    <span>Video Demo Berjalan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsMediaMode('image')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-all ${
                      settingsMediaMode === 'image'
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <TrendingUp className="size-3.5" />
                    <span>Tangkapan Layar HD</span>
                  </button>
                </div>
              </div>

              <ShowcaseMedia
                videoSrc="/landing/video-pengaturan.webm"
                imgSrc="/landing/pengaturan.webp"
                alt="Antarmuka workstation pengaturan toko, struk thermal, pajak PB1, dan meja"
                mode={settingsMediaMode}
              />
            </div>
          </div>

          {/* Grid Fitur Pengaturan Toko Lengkap (8 Kartu Berkarakter) */}
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SETTINGS_FEATURES.map(({ icon: Icon, badge, title, text, points }) => (
              <div
                key={title}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {badge}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold tracking-tight text-foreground">{title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </div>

                <ul className="mt-4 space-y-2 border-t border-border/60 pt-3">
                  {points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-xs text-foreground/85">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Banner Bantuan Setup Pengaturan */}
          <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <h4 className="text-sm font-bold text-foreground">Butuh Bantuan Menyesuaikan Pengaturan Toko Anda?</h4>
              <p className="text-xs text-muted-foreground">Tim kami siap membantu setup menu, desain logo struk, dan denah meja saat onboarding awal.</p>
            </div>
            <a
              href={WA_SALES_LINK}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({
                variant: 'outline',
                size: 'sm',
                className: 'mt-3 sm:mt-0 font-semibold border-primary/30 hover:bg-primary/10',
              })}
            >
              <MessageSquare className="mr-2 size-3.5 text-emerald-600 dark:text-emerald-400" />
              Konsultasi Setup via WhatsApp
            </a>
          </div>
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
            <a href="#pengaturan" className="hover:text-foreground">Pengaturan</a>
            <a href="#komparasi" className="hover:text-foreground">Komparasi Sewa</a>
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
