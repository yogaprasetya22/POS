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
  Volume2,
  VolumeX,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Reveal } from '@shared/components/reveal'
import { PosLogo } from '@shared/components/pos-logo'
import { buttonVariants } from '@shared/components/ui/button'
import { fetchStores } from '@shared/lib/api'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'POS Resto'
const WA_SALES_LINK = 'https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20tertarik%20konsultasi%20sewa%20sistem%20POS%20untuk%20restoran%2Fkafe%20saya.'

const QUICK = [
  { icon: Smartphone, text: 'Bisa pakai HP, tablet, atau laptop yang ada' },
  { icon: Coins, text: '0% komisi — 100% omzet masuk ke rekening Anda' },
  { icon: Receipt, text: 'Cetak struk 58/80mm & tiket dapur otomatis' },
  { icon: Sparkles, text: 'Tanya omzet & sisa stok lewat chat AI' },
]

const SHOWCASE_TABS = [
  {
    id: 'kasir',
    label: 'Layar Kasir',
    tag: 'Kasir & Pembayaran',
    title: 'Kasir cepat dengan kontrol laci kas anti-tekor',
    text: 'Pesanan makan di tempat atau bungkus, split bill, cetak struk thermal, dan tutup shift dengan hitungan modal awal vs setoran yang rapi.',
    points: [
      'Pemisahan otomatis modal kembalian di laci vs uang setoran owner',
      'Pembayaran lengkap: Tunai, QRIS dinamis, dan Kartu Debit/Kredit',
      'Cari menu cepat berdasarkan nama, kategori, atau status stok',
      'Hapus item (void) dan diskon manual terkunci PIN supervisor',
    ],
    img: '/landing/kasir.webp',
    video: '/landing/video-kasir.webm',
    alt: 'Antarmuka layar kasir dengan keranjang dan katalog menu',
  },
  {
    id: 'qr',
    label: 'Pesan Mandiri QR',
    tag: 'Menu QR Meja',
    title: 'Pelanggan pesan dari meja, antrean kasir berkurang',
    text: 'Tamu memindai stiker QR di meja pakai kamera HP, memilih menu beserta catatan rasa, dan pesanan langsung masuk ke dapur tanpa unduh aplikasi.',
    points: [
      'Buka langsung di browser HP tamu tanpa perlu download aplikasi',
      'Stok otomatis sinkron: menu yang habis tidak bisa dipesan',
      'Nomor antrean dan ringkasan pesanan muncul di HP pelanggan',
      'Mengurangi antrean di meja kasir saat jam makan siang dan malam',
    ],
    img: '/landing/pelanggan.webp',
    video: '/landing/video-qr.webm',
    alt: 'Tampilan menu pelanggan responsif di layar smartphone',
    phone: true,
  },
  {
    id: 'dapur',
    label: 'Layar Dapur (KDS)',
    tag: 'Monitor Dapur',
    title: 'Pesanan masuk ke koki tanpa nota kertas hilang',
    text: 'Pesanan lunas seketika tampil di monitor dapur lengkap dengan penanda waktu. Koki tahu persis urutan mana yang harus dimasak lebih dulu.',
    points: [
      'Tiket terurut otomatis sesuai jam masuk pesanan ke kasir',
      'Penanda warna visual jika ada masakan yang melebihi estimasi waktu',
      'Koki cukup ketuk tombol saat masakan siap diantar pramusaji',
      'Menghilangkan masalah salah baca tulisan tangan atau nota tercecer',
    ],
    img: '/landing/dapur.webp',
    video: '/landing/video-dapur.webm',
    alt: 'Layar monitor dapur KDS dengan antrean tiket memasak',
  },
  {
    id: 'laporan',
    label: 'Dashboard & Laba',
    tag: 'Laporan Keuangan',
    title: 'Pantau omzet dan laba bersih dari HP di mana saja',
    text: 'Owner bisa cek omzet hari ini, menu terlaris, dan riwayat tutup kasir langsung dari HP tanpa harus standby seharian di outlet.',
    points: [
      'Rekap otomatis omzet kotor, omzet bersih, diskon, dan pajak PB1',
      'Laporan laba kotor dan margin keuntungan tiap item menu',
      'Unduh rekapan penjualan harian dan bulanan ke format Excel / CSV',
      'Catatan selisih kas tiap kasir membuka dan menutup shift',
    ],
    img: '/landing/dashboard.webp',
    video: '/landing/video-dashboard.webm',
    alt: 'Dashboard analitik penjualan dan grafik laba kotor',
  },
  {
    id: 'stok',
    label: 'Bahan & Resep',
    tag: 'Inventori Otomatis',
    title: 'Stok bahan baku terpotong otomatis saat menu laku',
    text: 'Cukup masukkan resep menu sekali. Setiap porsi makanan atau minuman yang dibayar kasir otomatis memotong takaran bahan baku di gudang.',
    points: [
      'Peringatan otomatis saat persediaan bahan baku mulai menipis',
      'Kasir langsung tahu sisa porsi yang bisa dibuat hari ini',
      'Pencatatan bahan masuk belanjaan, bahan basi/rusak, dan stok opname',
      'Mencegah kecurangan atau kebocoran bahan baku dapur',
    ],
    img: '/landing/stok.webp',
    video: '/landing/video-stok.webm',
    alt: 'Manajemen resep dan bahan baku stok inventori',
  },
]

const SETTINGS_FEATURES = [
  {
    icon: Receipt,
    badge: 'Struk Thermal',
    title: 'Format Struk & Logo Outlet',
    text: 'Sesuaikan cetakan struk kasir dan tiket dapur. Pasang logo toko, nama cabang, alamat, catatan footer, serta ukuran kertas 58mm atau 80mm.',
    points: [
      'Logo hitam-putih otomatis disesuaikan untuk hasil print kontras tinggi',
      'Pesan terima kasih & promo akun Instagram di bagian bawah struk',
      'Mendukung printer Bluetooth, USB, dan kabel LAN (ESC/POS)',
      'Otomatis membuka laci kas kasir (kick cash drawer) saat print struk',
    ],
  },
  {
    icon: Coins,
    badge: 'Pajak & Layanan',
    title: 'Pajak PB1 (10%) & Service Charge',
    text: 'Hitung kewajiban pajak restoran dan biaya layanan tanpa hitung manual. Nilai pajak dan servis terpisah rapi di laporan bulanan.',
    points: [
      'Tarif PB1 dan service charge bisa diatur sesuai peraturan daerah',
      'Pilihan harga menu inklusif (sudah nett) atau ditambah di nota',
      'Pembulatan total akhir otomatis ke Rp100 atau Rp500 terdekat',
      'Rekap setoran pajak daerah siap unduh per bulan',
    ],
  },
  {
    icon: QrCode,
    badge: 'Meja & QR',
    title: 'Atur Meja & Cetak QR Meja',
    text: 'Bagi area tempat duduk (indoor, outdoor, lantai 2) dan cetak kode QR meja sekali klik tanpa repot buat manual.',
    points: [
      'Bebas atur nomor meja, kapasitas kursi, dan pembagian area ruangan',
      'Unduh lembar PDF kode QR tajam siap cetak untuk akrilik meja',
      'Tamu langsung diarahkan ke nomor meja tanpa risiko salah antar',
      'Fleksibel: tamu bisa bayar langsung atau bayar di kasir setelah makan',
    ],
  },
  {
    icon: UserCog,
    badge: 'Keamanan Kas',
    title: 'Hak Akses Staf & Kunci PIN',
    text: 'Batasi wewenang antara Owner, Kasir, dan Koki dapur agar uang kasir aman dan terhindar dari manipulasi nota.',
    points: [
      'Login kilat tiap kru cukup menggunakan PIN 4 digit',
      'Batalkan nota (void), refund, dan edit pesanan butuh PIN supervisor',
      'Staf kasir tidak bisa mengintip laba bersih atau HPP bahan rahasia',
      'Setiap pembukaan laci kas dan pembatalan transaksi tercatat di log',
    ],
  },
  {
    icon: Gift,
    badge: 'Diskon & Promo',
    title: 'Voucher, Diskon %, & Bundling',
    text: 'Bikin promo untuk jam-jam sepi: potongan nominal, diskon persentase, paket bundling hemat, atau kupon voucher belanja.',
    points: [
      'Atur masa berlaku promo dengan tanggal mulai dan selesai otomatis',
      'Atur syarat minimal belanja atau khusus kategori menu tertentu',
      'Kupon voucher dengan batas maksimal jumlah penukaran',
      'Promo langsung terpotong otomatis di kasir dan menu QR meja',
    ],
  },
  {
    icon: Users,
    badge: 'Member Toko',
    title: 'Program Member & Poin Belanja',
    text: 'Bangun pelanggan tetap toko Anda. Simpan nomor WhatsApp pelanggan dan berikan poin setiap kali mereka jajan.',
    points: [
      'Daftar member dalam 5 detik hanya dengan nomor HP pembeli',
      'Tentukan nilai poin (misal tiap belanja Rp10.000 dapat 1 poin Rp100)',
      'Poin bisa langsung dipotongkan untuk belanja berikutnya',
      'Pantau riwayat pelanggan yang paling sering datang ke outlet',
    ],
  },
  {
    icon: ChefHat,
    badge: 'Alur Dapur',
    title: 'Pisah Tiket Makanan & Minuman',
    text: 'Pesanan minuman otomatis dikirim ke barista bar, sedangkan makanan masuk ke koki dapur tanpa tercampur.',
    points: [
      'Pemisahan tiket otomatis: minuman ke bar, makanan ke koki dapur',
      'Bunyi lonceng notifikasi saat ada pesanan baru masuk',
      'Bisa cetak rangkap untuk dapur masak dan pelayan pengantar',
      'Sinkron dengan monitor status antrean siap saji',
    ],
  },
  {
    icon: Globe,
    badge: 'Pilihan Bahasa',
    title: 'Bahasa Indonesia, Jaksel, & English',
    text: 'Sesuaikan bahasa kasir dan menu tamu dengan konsep resto Anda: kafe santai kekinian, warkop akrab, atau resto turis.',
    points: [
      'Tersedia 3 bahasa: Bahasa Indonesia baku, Santai (Jaksel), & English',
      'Kalimat sapaan kasir dan nota mengikuti gaya bahasa yang dipilih',
      'Tiap staf bisa memilih bahasa sendiri di layar perangkat masing-masing',
      'Tampilan ramah wisatawan asing tanpa perlu terjemahan manual',
    ],
  },
]

const FEATURES = [
  { icon: Receipt, title: 'Kasir Cepat & Praktis', text: 'Makan di tempat atau bungkus, bayar belakangan, pisah tagihan (split bill), dan gabung meja dalam hitungan detik.' },
  { icon: ChefHat, title: 'Layar Dapur (KDS)', text: 'Pesanan lunas seketika tampil di monitor dapur koki dengan hitungan waktu masak dan opsi cetak tiket.' },
  { icon: Wallet, title: 'Hitung Laci Kasir Anti-Tekor', text: 'Serah terima shift tercatat. Modal awal laci terpisah dari omzet, selisih uang langsung ketahuan.' },
  { icon: Gift, title: 'Member, Poin & Promo', text: 'Kumpulkan nomor WhatsApp pembeli untuk program poin loyalitas dan berikan diskon otomatis.' },
  { icon: QrCode, title: 'Semua Metode Pembayaran', text: 'Mendukung tunai uang pas/pecahan cepat, QRIS dinamis, kartu debit/kredit, dan transfer bank.' },
  { icon: ClipboardList, title: 'Pajak PB1 & Service Charge', text: 'Hitungan pajak resto 10% dan servis otomatis tercatat di struk dan rekap bulanan.' },
  { icon: UserCog, title: 'Kunci Akses PIN Karyawan', text: 'Owner, Kasir, dan Koki memiliki wewenang berbeda. Hapus item nota terkunci PIN supervisor.' },
  { icon: Boxes, title: 'Multi-Outlet Satu Layar', text: 'Pantau dan kelola banyak cabang resto Anda dari satu akun pusat tanpa data tertukar.' },
  { icon: Sparkles, title: 'Tanya Jawab Data via AI', text: 'Tanyakan omzet hari ini, menu paling laku, atau stok bahan yang menipis langsung lewat chat.' },
]

const COMPARISON = [
  {
    feature: 'Biaya Awal',
    legacy: 'Beli lisensi putus jutaan rupiah + sewa server sendiri',
    pos: 'Sewa bulanan terjangkau, tanpa modal beli lisensi jutaan',
  },
  {
    feature: 'Potongan Komisi',
    legacy: 'Dipotong 1% - 2.5% dari total omzet transaksi Anda',
    pos: '0% Komisi — 100% uang penjualan masuk utuh ke rekening Anda',
  },
  {
    feature: 'Perangkat Keras (Hardware)',
    legacy: 'Wajib beli mesin kasir proprietary khusus mereka',
    pos: 'Bebas pakai HP Android, iPhone, iPad, atau laptop Anda',
  },
  {
    feature: 'Printer Thermal & Laci',
    legacy: 'Wajib beli printer khusus dengan konektor spesifik',
    pos: 'Cocok untuk semua printer Bluetooth thermal 58mm & 80mm',
  },
  {
    feature: 'Pembaruan Fitur',
    legacy: 'Bayar biaya upgrade mahal atau panggil teknisi ke toko',
    pos: 'Update cloud otomatis gratis selama masa sewa aktif',
  },
  {
    feature: 'Fleksibilitas Kontrak',
    legacy: 'Terkunci kontrak tahunan dan denda berhenti',
    pos: 'Bisa berhenti sewa kapan saja tanpa biaya penalti',
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
      <div className="flex items-center justify-between border-b bg-muted/70 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="size-2.5 sm:size-3 rounded-full bg-rose-500/80" />
          <span className="size-2.5 sm:size-3 rounded-full bg-amber-500/80" />
          <span className="size-2.5 sm:size-3 rounded-full bg-emerald-500/80" />
          <span className="ml-1 sm:ml-2 font-mono text-[10px] sm:text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-none">
            pos.restonusantara.app
          </span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 sm:size-2 rounded-full bg-emerald-500 animate-pulse" />
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
    <div className="relative mx-auto w-[275px] xs:w-[290px] sm:w-[315px] max-w-full overflow-hidden rounded-[2.6rem] sm:rounded-[2.8rem] border-[8px] sm:border-[10px] border-slate-900 bg-slate-900 shadow-2xl shadow-primary/20 ring-1 ring-slate-800">
      {/* Dynamic Island / Speaker */}
      <div className="relative z-20 flex h-6 sm:h-7 w-full items-center justify-center bg-slate-900">
        <span className="h-3 sm:h-3.5 w-16 sm:w-20 rounded-full bg-slate-800 ring-1 ring-slate-700/50" />
      </div>

      {/* Screen container with exact mobile aspect ratio */}
      <div className="relative w-full overflow-hidden bg-background">
        {children}
      </div>

      {/* Bottom Home Indicator Bar */}
      <div className="flex h-4 sm:h-5 w-full items-center justify-center bg-slate-900">
        <span className="h-1 w-20 sm:w-24 rounded-full bg-slate-700/70" />
      </div>
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
  const [isMuted, setIsMuted] = useState(true)

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

  const toggleMute = () => {
    if (!videoRef.current) return
    const nextMuted = !videoRef.current.muted
    videoRef.current.muted = nextMuted
    setIsMuted(nextMuted)
  }

  const controls = (
    <>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? 'Bunyikan audio narasi' : 'Bisukan suara'}
        className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md shadow-md transition-all hover:scale-105 active:scale-95 hover:border-primary/40"
      >
        {isMuted ? (
          <>
            <VolumeX className="size-3.5 text-muted-foreground" />
            <span>Suara Mati</span>
          </>
        ) : (
          <>
            <Volume2 className="size-3.5 text-emerald-500 animate-pulse" />
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Bersuara</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Jeda video' : 'Putar video'}
        className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md shadow-md transition-all hover:scale-105 active:scale-95 hover:border-primary/40"
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
    </>
  )

  const content = (
    <div className="relative group bg-muted/20">
      {mode === 'video' ? (
        <div className="relative">
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className={`block w-full ${
              phone
                ? 'aspect-[390/844] object-contain bg-background'
                : 'h-auto max-h-[520px] object-cover'
            }`}
          />
          {!phone && (
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
              {controls}
            </div>
          )}
        </div>
      ) : (
        <img
          src={imgSrc}
          alt={alt}
          width={phone ? 390 : 1280}
          height={phone ? 844 : 800}
          loading="lazy"
          className={`block w-full ${
            phone
              ? 'aspect-[390/844] object-contain bg-background'
              : 'h-auto max-h-[520px] object-cover'
          }`}
        />
      )}
    </div>
  )

  if (phone) {
    return (
      <div className="flex flex-col items-center">
        <PhoneFrame>{content}</PhoneFrame>
        {mode === 'video' && (
          <div className="mt-3.5 flex items-center justify-center gap-2">
            {controls}
          </div>
        )}
      </div>
    )
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
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary overflow-x-clip">
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5">
          <Link to="/" className="group flex items-center transition-opacity hover:opacity-90">
            <PosLogo size="md" subtitle={true} />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex" aria-label="Menu navigasi">
            <a href="#fitur" className="transition-colors hover:text-foreground">Fitur Resto</a>
            <a href="#pengaturan" className="transition-colors hover:text-foreground">Pengaturan Toko</a>
            <a href="#komparasi" className="transition-colors hover:text-foreground">Keunggulan Sewa</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-xs sm:text-sm px-2.5 sm:px-3' })}>
              Masuk
            </Link>
            <Link
              to="/register"
              className={buttonVariants({ size: 'sm', className: 'shadow-sm shadow-primary/25 font-semibold text-xs sm:text-sm px-3 sm:px-4' })}
            >
              <span className="hidden sm:inline">Coba 14 Hari Gratis</span>
              <span className="sm:hidden">Coba Gratis</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ─── HERO SECTION: VALUE PROPOSITION SEWA POS ─── */}
        <section className="relative overflow-hidden px-4 pt-10 pb-16 sm:pt-16 sm:pb-20 md:pt-24 md:pb-28">
          {/* Subtle Ambient Glow */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-80 sm:h-96 w-[320px] sm:w-[600px] md:w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-primary/15 to-amber-500/10 blur-3xl" />

          <div className="mx-auto max-w-5xl text-center">
            <Reveal delay={0.05}>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.15]">
                Kasir Cepat, Dapur Rapi, Laporan Jelas. <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-primary via-primary/90 to-amber-600 bg-clip-text text-transparent">
                  Tanpa Beban Modal Mesin Jutaan.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mx-auto mt-4 sm:mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
                Satu sistem untuk kasir, pesan mandiri QR meja, monitor dapur (KDS), dan resep bahan baku. Cukup sewa bulanan dan pakai HP atau tablet yang sudah ada, tanpa ikatan kontrak.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-7 sm:mt-8 flex flex-col items-center justify-center gap-3 sm:gap-3.5 sm:flex-row">
                <Link
                  to="/register"
                  className={buttonVariants({
                    size: 'lg',
                    className: 'h-12 sm:h-13 w-full px-6 sm:px-8 text-sm sm:text-base font-semibold shadow-lg shadow-primary/25 sm:w-auto',
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
                    className: 'h-12 sm:h-13 w-full border-2 px-6 sm:px-8 text-sm sm:text-base font-semibold sm:w-auto hover:bg-muted',
                  })}
                >
                  <MessageSquare className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                  Konsultasi Sewa via WhatsApp
                </a>
              </div>

              <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 sm:size-4 text-emerald-600" /> Bebas Pakai Perangkat Sendiri</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 sm:size-4 text-emerald-600" /> Tanpa Kontrak Penalti</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 sm:size-4 text-emerald-600" /> Siap Pakai dalam 5 Menit</li>
              </ul>
            </Reveal>

            {/* ─── INTERACTIVE SHOWCASE TABS DENGAN VIDEO DEMO ─── */}
            <section id="fitur" className="scroll-mt-20">
              <Reveal delay={0.2} className="mt-10 sm:mt-14">
                {/* Tab Switcher & Video/Image Toggle */}
                <div className="flex flex-col items-center gap-3 sm:gap-4 max-w-full">
                  <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl sm:rounded-full border border-border/80 bg-muted/60 p-1.5 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {SHOWCASE_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold transition-all sm:text-sm ${
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
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="hidden xs:inline">Tampilan Showcase:</span>
                    <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setMediaMode('video')}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1 text-xs transition-all ${
                          mediaMode === 'video'
                            ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                            : 'hover:text-foreground'
                        }`}
                      >
                        <Video className="size-3.5" />
                        <span className="hidden sm:inline">Video Demo Berjalan</span>
                        <span className="sm:hidden">Video Demo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaMode('image')}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1 text-xs transition-all ${
                          mediaMode === 'image'
                            ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                            : 'hover:text-foreground'
                        }`}
                      >
                        <TrendingUp className="size-3.5" />
                        <span className="hidden sm:inline">Tangkapan Layar HD</span>
                        <span className="sm:hidden">Foto HD</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Showcase Container */}
                <div className="mx-auto mt-6 sm:mt-8 grid max-w-5xl items-center gap-6 sm:gap-8 rounded-2xl sm:rounded-3xl border border-border/80 bg-card/60 p-4 sm:p-8 text-left backdrop-blur-sm lg:grid-cols-12 lg:p-10">
                  <div className="lg:col-span-5 space-y-3 sm:space-y-4">
                    <span className="inline-block rounded-md bg-primary/10 px-3 py-1 text-xs font-bold text-primary tracking-wide uppercase">
                      {currentShowcase.tag}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                      {currentShowcase.title}
                    </h2>
                    <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                      {currentShowcase.text}
                    </p>
                    <ul className="space-y-2 sm:space-y-2.5 pt-1 sm:pt-2">
                      {currentShowcase.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2.5 text-xs sm:text-sm">
                          <span className="mt-0.5 grid size-4.5 sm:size-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3" />
                          </span>
                          <span className="text-foreground/90">{pt}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2 sm:pt-3">
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

                  <div className="lg:col-span-7 flex justify-center w-full">
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

        {/* ─── KOMPARASI SEWA VS BELI KONVENSIONAL ─── */}
        <section id="komparasi" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Bandingkan Biaya
            </span>
            <h2 className="mt-3 sm:mt-4 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Kenapa Menyewa Lebih Menguntungkan Dibanding Beli Mesin Kasir?
            </h2>
            <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-muted-foreground">
              Bandingkan modal awal, potongan komisi transaksi, dan kebebasan menggunakan perangkat yang sudah Anda miliki.
            </p>
          </div>

          {/* Tampilan Mobile: Kartu Komparasi Vertikal Tanpa Geser Horizontal */}
          <div className="mt-8 space-y-3.5 sm:hidden">
            {COMPARISON.map(({ feature, legacy, pos }) => (
              <div key={feature} className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
                <h3 className="font-bold text-sm text-foreground mb-3">{feature}</h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2 text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/50">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                    <div>
                      <span className="block font-semibold text-[11px] text-rose-500 uppercase tracking-wider mb-0.5">Konvensional</span>
                      <span>{legacy}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 font-medium text-foreground bg-primary/5 p-2.5 rounded-xl border border-primary/15">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="block font-bold text-[11px] text-primary uppercase tracking-wider mb-0.5">Sewa {APP_NAME}</span>
                      <span>{pos}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tampilan Desktop: Tabel Komparasi 3 Kolom */}
          <div className="mt-12 hidden overflow-x-auto rounded-3xl border border-border/80 bg-card shadow-sm sm:block">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-6 py-4">Perbandingan</th>
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

        {/* ─── PENGATURAN TOKO & BACKOFFICE ─── */}
        <section id="pengaturan" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Pengaturan Toko
            </span>
            <h2 className="mt-3 sm:mt-4 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Semua Pengaturan Outlet Bisa Anda Atur Sendiri
            </h2>
            <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-muted-foreground">
              Atur format struk thermal, pajak PB1, denah meja QR, pembagian tugas kasir dan koki, hingga poin member langsung dari dashboard tanpa perlu panggil teknisi.
            </p>
          </div>

          {/* Media Showcase: Foto HD & Video Demo Berjalan Pengaturan Toko */}
          <div className="mt-8 sm:mt-12">
            <div className="mx-auto max-w-4xl">
              <div className="mb-3.5 sm:mb-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Pratinjau Layar Pengaturan
                  </span>
                </div>

                <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSettingsMediaMode('video')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1 text-xs transition-all ${
                      settingsMediaMode === 'video'
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Video className="size-3.5" />
                    <span className="hidden sm:inline">Video Demo Berjalan</span>
                    <span className="sm:hidden">Video Demo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsMediaMode('image')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1 text-xs transition-all ${
                      settingsMediaMode === 'image'
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <TrendingUp className="size-3.5" />
                    <span className="hidden sm:inline">Tangkapan Layar HD</span>
                    <span className="sm:hidden">Foto HD</span>
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
          <div className="mt-12 sm:mt-16 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SETTINGS_FEATURES.map(({ icon: Icon, badge, title, text, points }) => (
              <div
                key={title}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid size-9 sm:size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4.5 sm:size-5" />
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {badge}
                    </span>
                  </div>

                  <h3 className="mt-3.5 sm:mt-4 text-sm sm:text-base font-bold tracking-tight text-foreground">{title}</h3>
                  <p className="mt-1.5 sm:mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </div>

                <ul className="mt-3.5 sm:mt-4 space-y-1.5 sm:space-y-2 border-t border-border/60 pt-3">
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
          <div className="mx-auto mt-8 sm:mt-12 max-w-4xl rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
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
                className: 'mt-3 sm:mt-0 font-semibold border-primary/30 hover:bg-primary/10 w-full sm:w-auto',
              })}
            >
              <MessageSquare className="mr-2 size-3.5 text-emerald-600 dark:text-emerald-400" />
              Konsultasi Setup via WhatsApp
            </a>
          </div>
        </section>

        {/* ─── FITUR OPERASIONAL RESTO ─── */}
        <section className="bg-muted/30 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center max-w-2xl mx-auto">
              <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                Alur Kerja Resto
              </span>
              <h2 className="mt-3 sm:mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                Dibuat Khusus untuk Kafe &amp; Rumah Makan
              </h2>
              <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-muted-foreground">
                Mencakup kebutuhan nyata operasional harian: kasir laci anti-tekor, tiket dapur otomatis, resep bahan baku, dan laporan laba bersih.
              </p>
            </div>

            <div className="mt-8 sm:mt-12 lg:mt-14 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <span className="grid size-10 sm:size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-3.5 sm:mt-4 text-base sm:text-lg font-bold tracking-tight text-foreground">{title}</h3>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CARA MULAI SEWA (3 LANGKAH) ─── */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Cara Mulai
            </span>
            <h2 className="mt-3 sm:mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
              Siap Pakai dalam 3 Langkah Mudah
            </h2>
            <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-muted-foreground">
              Tidak butuh instalasi rumit ataupun teknisi datang. Semua berjalan langsung di browser perangkat Anda.
            </p>
          </div>

          <div className="mt-8 sm:mt-12 lg:mt-14 grid gap-4 sm:gap-6 md:grid-cols-3">
            {RENTAL_STEPS.map(({ step, title, text }) => (
              <div key={step} className="relative rounded-2xl sm:rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
                <span className="font-mono text-2xl sm:text-3xl font-black text-primary/30">{step}</span>
                <h3 className="mt-3 sm:mt-4 text-lg sm:text-xl font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── KEAMANAN DATA ─── */}
        <section id="keamanan" className="bg-muted/40 py-12 sm:py-16 border-y border-border/60">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Keamanan Data
            </span>
            <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
              Data Resep dan Laporan Keuangan Anda Aman
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto">
              Data transaksi dan inventori terisolasi penuh di database. Staf kasir tidak bisa melihat laba bersih atau HPP resep rahasia Anda.
            </p>

            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 text-left">
                <Lock className="size-5 sm:size-6 text-primary" />
                <h4 className="mt-2.5 sm:mt-3 font-bold text-sm">Supabase Row-Level Security</h4>
                <p className="mt-1 text-xs text-muted-foreground">Tiap outlet memiliki partisi data sendiri. Staf atau toko lain tidak dapat mengakses resep atau laba toko Anda.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 text-left">
                <ShieldCheck className="size-5 sm:size-6 text-primary" />
                <h4 className="mt-2.5 sm:mt-3 font-bold text-sm">Proteksi PIN Supervisor</h4>
                <p className="mt-1 text-xs text-muted-foreground">Fitur hapus item (void) dan diskon manual terkunci dengan PIN supervisor untuk mencegah kecurangan kasir.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 text-left">
                <Headphones className="size-5 sm:size-6 text-primary" />
                <h4 className="mt-2.5 sm:mt-3 font-bold text-sm">Audit Trail Shift Kasir</h4>
                <p className="mt-1 text-xs text-muted-foreground">Setiap pembukaan laci, serah terima uang, dan selisih kas tercatat permanen di log audit toko Anda.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── LIVE OUTLET DEMO (DEMO TOKO AKTIF) ─── */}
        {demoStores.length > 0 && (
          <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16 text-center">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Coba Langsung Tanpa Daftar
            </span>
            <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight">
              Kunjungi Toko Contoh di Bawah Ini
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Rasakan pengalaman pelanggan memesan menu lewat QR meja secara langsung:
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {demoStores.map((st) => (
                <Link
                  key={st.slug}
                  to={`/s/${st.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-all hover:border-primary/50 hover:bg-muted"
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
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-16 pt-6 sm:pb-20 sm:pt-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Tanya Jawab Sewa
            </span>
            <h2 className="mt-3 sm:mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
              Pertanyaan Seputar Sewa POS
            </h2>
            <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-muted-foreground">
              Semua hal penting mengenai biaya sewa, perangkat keras, keamanan data, dan dukungan teknis.
            </p>
          </div>

          <div className="mt-8 sm:mt-12 space-y-3 sm:space-y-3.5">
            {RENTAL_FAQ.map(({ q, a }, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-border bg-card px-4 py-3.5 sm:px-6 sm:py-4.5 transition-all duration-200 open:shadow-md open:border-primary/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 sm:gap-4 font-semibold text-foreground text-sm sm:text-base">
                  <span>{q}</span>
                  <span className="text-primary transition-transform duration-200 group-open:rotate-45 text-lg sm:text-xl font-bold shrink-0">
                    +
                  </span>
                </summary>
                <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground border-t border-border/60 pt-2.5 sm:pt-3">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── FINAL CTA BANNER ─── */}
        <section className="border-t border-border bg-gradient-to-b from-primary/10 via-background to-background py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <span className="rounded-full bg-primary/15 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              Mulai Sekarang
            </span>
            <h2 className="mt-3 sm:mt-4 text-2xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Siap Bikin Kasir &amp; Dapur Resto Lebih Rapi?
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-sm sm:text-base text-muted-foreground">
              Coba gratis 14 hari langsung di outlet Anda. Tanpa kartu kredit, tanpa kontrak mengikat, dan bisa berhenti sewa kapan saja.
            </p>

            <div className="mt-7 sm:mt-8 flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row">
              <Link
                to="/register"
                className={buttonVariants({
                  size: 'lg',
                  className: 'h-12 sm:h-13 w-full px-6 sm:px-8 text-sm sm:text-base font-semibold shadow-xl shadow-primary/30 sm:w-auto',
                })}
              >
                Coba 14 Hari Gratis
                <ArrowRight className="ml-2 size-4" />
              </Link>
              <a
                href={WA_SALES_LINK}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                  className: 'h-12 sm:h-13 w-full border-2 px-6 sm:px-8 text-sm sm:text-base font-semibold sm:w-auto',
                })}
              >
                <MessageSquare className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                Tanya-Tanya via WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border bg-card py-8 sm:py-12 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 md:flex-row">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 font-bold text-foreground text-center md:text-left">
            <PosLogo size="sm" showText={true} />
            <span className="text-xs font-normal text-muted-foreground ml-1">
              · Sistem Sewa Kasir &amp; Dapur Restoran 0% Komisi
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs">
            <a href="#fitur" className="hover:text-foreground">Fitur</a>
            <a href="#pengaturan" className="hover:text-foreground">Pengaturan</a>
            <a href="#komparasi" className="hover:text-foreground">Komparasi Sewa</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link to="/privasi" className="hover:text-foreground">Kebijakan Privasi</Link>
            <Link to="/syarat" className="hover:text-foreground">Ketentuan Layanan</Link>
          </div>

          <p className="text-xs text-center md:text-right">
            © {new Date().getFullYear()} {APP_NAME}. Hak cipta dilindungi undang-undang.
          </p>
        </div>
      </footer>
    </div>
  )
}
