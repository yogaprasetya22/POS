import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Coffee,
  ExternalLink,
  Layers,
  Play,
  QrCode,
  Receipt,
  ShieldCheck,
  Star,
  Store,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@shared/components/ui/badge'
import { Button, buttonVariants } from '@shared/components/ui/button'
import { Card } from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { rupiah } from '@shared/lib/utils'

/**
 * Landing Page Utama (http://localhost:5173/)
 * // ponytail: tablet mockup dan grafik analitik diimplementasikan murni menggunakan SVG & CSS Tailwind,
 * tanpa 3D bundle (Three.js), video canvas berat, atau framework animasi eksternal.
 */
export function LandingPage() {
  const [emailSub, setEmailSub] = useState('')
  const [subSuccess, setSubSuccess] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailSub.trim()) return
    setSubSuccess(true)
    setTimeout(() => {
      setEmailSub('')
      setSubSuccess(false)
    }, 3000)
  }

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.pushState(null, '', `#${id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-amber-500 selection:text-white scroll-smooth">
      {/* 1. Top Announcement Bar */}
      <aside aria-label="Pengumuman" className="bg-slate-950 px-4 py-2 text-center text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-[10px] px-2 py-0.5">
            PROMO 2026
          </Badge>
          <span className="hidden sm:inline">
            Sistem Kasir Pintar & Self-Order QR WhatsApp Generasi Terbaru telah hadir!
          </span>
          <span className="sm:hidden">Sistem POS Pintar Generasi Baru!</span>
          <Link
            to="/register"
            className="font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 underline underline-offset-2 ml-1"
          >
            Coba Gratis 14 Hari <ArrowRight className="size-3" />
          </Link>
        </div>
      </aside>

      {/* 2. Main Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-md shadow-amber-500/20">
              <Store className="size-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-foreground flex items-center gap-1">
                Tumbas <span className="text-amber-600 font-extrabold text-sm">POS</span>
              </span>
              <span className="text-[10px] text-muted-foreground block -mt-1 font-medium">Smart Dining System</span>
            </div>
          </Link>

          <nav aria-label="Navigasi Utama" className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a
              href="#fitur"
              onClick={(e) => scrollToSection(e, 'fitur')}
              className="hover:text-foreground transition-colors"
            >
              Fitur Unggulan
            </a>
            <a
              href="#cara-kerja"
              onClick={(e) => scrollToSection(e, 'cara-kerja')}
              className="hover:text-foreground transition-colors"
            >
              Cara Kerja
            </a>
            <a
              href="#solusi"
              onClick={(e) => scrollToSection(e, 'solusi')}
              className="hover:text-foreground transition-colors"
            >
              Solusi Bisnis
            </a>
            <a
              href="#testimoni"
              onClick={(e) => scrollToSection(e, 'testimoni')}
              className="hover:text-foreground transition-colors"
            >
              Testimoni
            </a>
            <Link to="/s/warkop-nusantara" className="hover:text-amber-600 transition-colors flex items-center gap-1 text-primary font-semibold">
              <QrCode className="size-4" /> Live Demo QR
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-sm font-semibold' })}
            >
              Masuk
            </Link>
            <Link
              to="/register"
              className={buttonVariants({
                size: 'sm',
                className: 'rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/25 font-bold px-4 h-9',
              })}
            >
              Daftar Gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
      {/* 3. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-500/10 via-primary/5 to-transparent blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-6 shadow-xs animate-in fade-in slide-in-from-bottom-2">
            <Store className="size-3.5 text-amber-500" />
            <span>The smart way to grow your business</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.15]">
            Optimize Your Business <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-primary bg-clip-text text-transparent">
              With Advanced POS
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Platform all-in-one kasir pintar, pemesanan mandiri pelanggan via scan QR meja, integrasi notifikasi WhatsApp, layar dapur KDS, dan laporan analitik real-time.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className={buttonVariants({
                size: 'lg',
                className: 'rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-7 h-12 shadow-lg shadow-amber-600/30 transition-transform hover:scale-[1.02]',
              })}
            >
              Mulai Uji Coba Gratis <ArrowRight className="size-4 ml-1.5" />
            </Link>
            <Link
              to="/s/warkop-nusantara"
              className={buttonVariants({
                size: 'lg',
                variant: 'outline',
                className: 'rounded-xl font-semibold h-12 px-6',
              })}
            >
              <ExternalLink className="size-4 mr-2 text-muted-foreground" /> Lihat Demo Pelanggan
            </Link>
          </div>

          {/* 4. Realistic Tablet POS Mockup (CSS & SVG Pure) */}
          <div className="relative mx-auto mt-12 md:mt-16 max-w-5xl">
            {/* Tablet Hardware Frame */}
            <div className="relative rounded-[2.5rem] p-3 sm:p-4 bg-slate-900 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-950/20">
              {/* Front Camera dot */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 size-2 rounded-full bg-slate-700" />

              {/* Tablet Screen Container */}
              <div className="overflow-hidden rounded-2xl bg-background border border-border shadow-inner aspect-[16/10] sm:aspect-[16/9.5] text-left flex flex-col">
                {/* Mockup App Header */}
                <div className="flex items-center justify-between border-b px-4 py-2.5 bg-card/60 backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-lg bg-amber-600 text-white grid place-items-center font-bold text-[10px]">
                      T
                    </div>
                    <span className="font-bold text-xs">Warkop Nusantara · Kasir Meja #04</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/40 text-emerald-600 bg-emerald-500/5">
                      Online · Dapur Terhubung
                    </Badge>
                    <span className="font-mono">14:20 WIB</span>
                  </div>
                </div>

                {/* Mockup Main Screen Area (Catalog Left + Order Cart Right) */}
                <div className="flex-1 grid grid-cols-12 min-h-0">
                  {/* Left: Product Catalog (8 cols) */}
                  <div className="col-span-8 p-3 sm:p-4 border-r flex flex-col gap-3 overflow-hidden bg-muted/10">
                    {/* Category tabs */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold">
                      <span className="rounded-full bg-primary text-primary-foreground px-3 py-1">Semua Menu</span>
                      <span className="rounded-full bg-card border px-3 py-1 text-muted-foreground">Kopi & Susu</span>
                      <span className="rounded-full bg-card border px-3 py-1 text-muted-foreground">Makanan Utama</span>
                      <span className="rounded-full bg-card border px-3 py-1 text-muted-foreground">Camilan</span>
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-3 gap-2.5 flex-1 overflow-hidden">
                      {[
                        { name: 'Kopi Susu Gula Aren', price: 18000, cat: 'Kopi', isDrink: true },
                        { name: 'Nasi Goreng Spesial', price: 28000, cat: 'Makanan', isDrink: false },
                        { name: 'Roti Bakar Cokelat Keju', price: 22000, cat: 'Snack', isDrink: false },
                        { name: 'Es Teh Manis Melati', price: 8000, cat: 'Minuman', isDrink: true },
                        { name: 'Mie Goreng Seafood', price: 32000, cat: 'Makanan', isDrink: false },
                        { name: 'Pisang Goreng Madu', price: 16000, cat: 'Snack', isDrink: false },
                      ].map((item, idx) => (
                        <div key={idx} className="rounded-xl border bg-card p-2 shadow-xs flex flex-col justify-between">
                          <div className="aspect-4/3 rounded-lg bg-muted/60 border grid place-items-center mb-1.5 text-muted-foreground">
                            {item.isDrink ? <Coffee className="size-5" /> : <UtensilsCrossed className="size-5" />}
                          </div>
                          <div>
                            <div className="font-semibold text-[11px] leading-tight truncate">{item.name}</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-extrabold text-[11px] text-foreground">{rupiah(item.price)}</span>
                              <div className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold">
                                +
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Order Cart Ticket (4 cols) */}
                  <div className="col-span-4 p-3 sm:p-4 flex flex-col justify-between bg-card">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-bold text-xs">Pesanan Aktif</span>
                        <Badge variant="secondary" className="text-[10px]">3 Item</Badge>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-[11px]">2x Kopi Susu Aren</div>
                            <div className="text-[10px] text-muted-foreground">+ Less Sugar</div>
                          </div>
                          <span className="font-mono font-bold text-[11px]">{rupiah(36000)}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-[11px]">1x Nasi Goreng Spesial</div>
                            <div className="text-[10px] text-muted-foreground">+ Telur Ceplok</div>
                          </div>
                          <span className="font-mono font-bold text-[11px]">{rupiah(28000)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-2 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Tagihan</span>
                        <span className="font-extrabold text-sm text-primary">{rupiah(64000)}</span>
                      </div>
                      <div className="rounded-xl bg-amber-600 text-white py-2 text-center text-xs font-bold shadow-xs">
                        Bayar Sekarang (QRIS / Tunai)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup Stand base shadow */}
            <div className="mx-auto h-4 w-48 rounded-b-xl bg-slate-800/80 shadow-xl" />
          </div>
        </div>
      </section>

      {/* 5. Social Proof / Ratings & Trusted Partners */}
      <section className="border-y border-border/60 bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="size-4 fill-amber-500" />
            ))}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Providing Digital Solutions To Over 150,000 Businesses
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Telah dipercaya oleh berbagai jaringan coffee shop, restoran kasual, bistro, dan cloud kitchen di seluruh Indonesia.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-75 grayscale hover:grayscale-0 transition-all text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5"><Coffee className="size-4 text-amber-600" /> Kopi Nusantara</span>
            <span className="flex items-center gap-1.5"><UtensilsCrossed className="size-4 text-primary" /> Savory Bistro</span>
            <span className="flex items-center gap-1.5"><ChefHat className="size-4 text-emerald-600" /> Appetito Kitchen</span>
            <span className="flex items-center gap-1.5"><Store className="size-4 text-blue-600" /> Gusto Coffee Roasters</span>
            <span className="flex items-center gap-1.5"><Layers className="size-4 text-rose-600" /> Urban Dining Hub</span>
          </div>
        </div>
      </section>

      {/* 6. Feature Bento Grid: Maximize Hospitality Potential */}
      <section id="fitur" className="py-20 lg:py-28 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 text-xs">
              FITUR UTAMA
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Maximize Your Hospitality Potential With Our Guidance
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Semua yang Anda butuhkan untuk mempercepat alur pelayanan restoran, memangkas waktu antre kasir, dan mencegah kehilangan stok.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Bento Card 1: Inventory Management (4 cols) */}
            <Card className="rounded-3xl border p-6 lg:col-span-5 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-600 grid place-items-center font-bold">
                  <Layers className="size-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Katalog & Manajemen Stok</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Atur menu, varian rasa, tingkat kepedasan, dan nonaktifkan menu yang habis dalam satu sakelar instan tanpa reload.
                  </p>
                </div>
              </div>

              {/* Mini visual mockup */}
              <div className="mt-6 rounded-2xl border bg-muted/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Status Ketersediaan</span>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">42 Menu Aktif</Badge>
                </div>
                <div className="rounded-xl border bg-card p-2.5 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <Coffee className="size-4 text-muted-foreground" />
                    <span className="font-medium">Espresso Single</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600">Tersedia</span>
                </div>
                <div className="rounded-xl border bg-card p-2.5 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="size-4 text-muted-foreground" />
                    <span className="font-medium">Croissant Butter</span>
                  </div>
                  <span className="text-[11px] font-bold text-destructive">Habis (Re-stock)</span>
                </div>
              </div>
            </Card>

            {/* Bento Card 2: Sales & Table Management (7 cols) */}
            <Card className="rounded-3xl border p-6 lg:col-span-7 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-600 grid place-items-center font-bold">
                  <QrCode className="size-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Self-Order QR Meja & Kasir POS Cepat</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Pelanggan cukup memindai stiker QR di meja untuk memesan langsung lewat ponsel. Pesanan otomatis terkirim via WhatsApp kasir dan layar dapur.
                  </p>
                </div>
              </div>

              {/* Visual flow chart mini */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border bg-card p-3 space-y-1 shadow-xs text-center">
                  <div className="size-8 mx-auto rounded-full bg-amber-500/10 text-amber-600 grid place-items-center text-xs font-bold">1</div>
                  <div className="font-bold text-xs">Scan QR Meja</div>
                  <p className="text-[11px] text-muted-foreground">Tanpa perlu instal aplikasi apapun</p>
                </div>
                <div className="rounded-2xl border bg-card p-3 space-y-1 shadow-xs text-center">
                  <div className="size-8 mx-auto rounded-full bg-blue-500/10 text-blue-600 grid place-items-center text-xs font-bold">2</div>
                  <div className="font-bold text-xs">Kirim ke WA Kasir</div>
                  <p className="text-[11px] text-muted-foreground">Format pesanan rapi & terstruktur</p>
                </div>
                <div className="rounded-2xl border bg-card p-3 space-y-1 shadow-xs text-center">
                  <div className="size-8 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center text-xs font-bold">3</div>
                  <div className="font-bold text-xs">Dapur Langsung Masak</div>
                  <p className="text-[11px] text-muted-foreground">Sinkronisasi otomatis real-time</p>
                </div>
              </div>
            </Card>

            {/* Bento Card 3: Analytics & Reporting (12 cols) */}
            <Card className="rounded-3xl border p-6 lg:col-span-12 hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 max-w-xl">
                  <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center font-bold">
                    <TrendingUp className="size-6" />
                  </div>
                  <h3 className="text-xl font-bold">Laporan Keuangan & Analitik Otomatis</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Pantau omzet harian, transaksi per metode pembayaran (Tunai, QRIS, EDC), dan rata-rata belanja pembeli (AOV) dari mana saja.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border bg-muted/40 p-3 sm:px-6 text-center">
                    <span className="text-[11px] text-muted-foreground block font-semibold">Pertumbuhan Omzet</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-600">+34.8%</span>
                  </div>
                  <div className="rounded-2xl border bg-muted/40 p-3 sm:px-6 text-center">
                    <span className="text-[11px] text-muted-foreground block font-semibold">Efisiensi Kasir</span>
                    <span className="text-xl sm:text-2xl font-black text-primary">2.5x Lebih Cepat</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 7. How It Works Section */}
      <section id="cara-kerja" className="border-y border-border/60 bg-muted/20 py-20 lg:py-28 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">
              LANGKAH MUDAH
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              What Our POS System Does And How It Works
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Mulai operasikan sistem kasir pintar Anda hanya dalam hitungan menit tanpa perangkat mahal.
            </p>
          </div>

          {/* Workflow Showcase Card with Play Indicator */}
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-xl">
            <div className="relative aspect-16/9 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center text-white p-6">
              <div className="text-center space-y-4 max-w-md z-10">
                <div className="size-16 sm:size-20 rounded-full bg-white/20 backdrop-blur-md grid place-items-center mx-auto shadow-2xl transition-transform hover:scale-110 cursor-pointer border border-white/30">
                  <Play className="size-7 sm:size-9 text-white fill-white translate-x-0.5" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-white">Lihat Cara Kerja Sistem Restoran Kami</h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Tonton bagaimana pelanggan memesan di meja dan pesanan langsung tersaji di layar dapur secara mulus.
                </p>
              </div>
            </div>

            {/* 3 Steps underneath */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x border-t bg-card">
              <div className="p-6 space-y-2">
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <span className="size-6 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center">1</span>
                  Setup Menu & Meja
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Masukkan daftar menu makanan/minuman dan cetak stiker QR untuk ditempel di meja pelanggan.
                </p>
              </div>
              <div className="p-6 space-y-2">
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <span className="size-6 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center">2</span>
                  Self-Order Pelanggan
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pelanggan scan QR menggunakan kamera HP untuk memilih menu dan menyelesaikan pesanan via WA.
                </p>
              </div>
              <div className="p-6 space-y-2">
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <span className="size-6 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center">3</span>
                  Kasir & Dapur Terhubung
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kasir memverifikasi pembayaran dan koki dapur melihat tiket antrean pesanan secara langsung.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Solutions & Mosaic Section */}
      <section id="solusi" className="py-20 lg:py-28 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-5 space-y-6">
              <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 text-xs">
                SOLUSI BISNIS F&B
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
                Empowering Over 150,000 Businesses To Thrive In The Digital Age.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Kami merancang sistem point of sale yang fleksibel untuk berbagai model bisnis: mulai dari kedai kopi estetik, warung makan lokal, restoran fine dining, hingga gerai waralaba dengan banyak cabang.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Sinkronisasi Realtime Multi-Device</h4>
                    <p className="text-xs text-muted-foreground">Kasir, layar koki dapur, dan admin backoffice selalu terhubung seketika.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Pesanan WhatsApp Tanpa Aplikasi Tambahan</h4>
                    <p className="text-xs text-muted-foreground">Pelanggan tidak perlu repot install aplikasi untuk melakukan pemesanan meja.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Analisis Penjualan & Margin Akurat</h4>
                    <p className="text-xs text-muted-foreground">Pantau produk terlaris, jam ramai kunjungan, dan omzet bersih kapan saja.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Mosaic Grid */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
                <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center">
                  <Coffee className="size-5" />
                </div>
                <h4 className="font-bold text-sm">Coffee Shop & Kafe</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Penyajian cepat dengan dukungan varian gula, es, dan topping.</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
                <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <UtensilsCrossed className="size-5" />
                </div>
                <h4 className="font-bold text-sm">Restoran Dine-in</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Manajemen meja fleksibel dan integrasi tiket antrean dapur.</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
                  <Store className="size-5" />
                </div>
                <h4 className="font-bold text-sm">Gerai Waralaba</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Kelola multi-cabang terpusat dari satu dashboard super admin.</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
                <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center">
                  <Users className="size-5" />
                </div>
                <h4 className="font-bold text-sm">Manajemen Staf</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Hak akses bertingkat: Kasir, Kitchen, Admin Toko, dan Owner.</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
                <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center">
                  <Receipt className="size-5" />
                </div>
                <h4 className="font-bold text-sm">Cetak Struk 58mm</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Kompatibel printer thermal bluetooth & browser print standar.</p>
              </div>
              <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
                <div className="size-10 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center">
                  <ShieldCheck className="size-5" />
                </div>
                <h4 className="font-bold text-sm">Aman & Terenkripsi</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Didukung Supabase PostgreSQL dengan Row-Level Security.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Testimonials Section */}
      <section id="testimoni" className="border-t border-border/60 py-20 lg:py-28 scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8 space-y-8">
          <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto">
            <CheckCircle2 className="size-6" />
          </div>

          <blockquote className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-snug">
            “Managing transactions and tracking inventory has never been easier since integrating Tumbas POS.”
          </blockquote>

          <div className="space-y-1">
            <div className="size-12 rounded-full bg-muted border mx-auto grid place-items-center font-bold text-sm text-primary">
              RH
            </div>
            <div className="font-bold text-sm text-foreground">Rian Hendrawan</div>
            <div className="text-xs text-muted-foreground">Owner · Warkop Nusantara Group</div>
          </div>
        </div>
      </section>

      {/* 9. Bottom Call to Action Banner */}
      <section className="py-12 pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-8 sm:p-14 text-white shadow-2xl">
            <div className="relative z-10 max-w-xl space-y-5">
              <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-xs">
                UJI COBA TANPA RISIKO
              </Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Maximize Efficiency - Boost Your Sales Today
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Tingkatkan kepuasan pelanggan dan percepat perputaran meja kafe Anda sekarang juga.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className={buttonVariants({
                    size: 'lg',
                    className: 'rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold px-8 h-12 shadow-lg shadow-amber-600/30',
                  })}
                >
                  Daftar Sekarang Gratis
                </Link>
                <Link
                  to="/login"
                  className={buttonVariants({
                    size: 'lg',
                    variant: 'outline',
                    className: 'rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 h-12 px-6',
                  })}
                >
                  Masuk ke POS
                </Link>
              </div>
            </div>

            {/* Decorative background shape */}
            <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-10 pointer-events-none hidden lg:block">
              <div className="size-full bg-radial from-amber-500 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* 10. Pre-Footer Contact Form */}
      <section className="border-t border-border/60 bg-muted/10 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-1 max-w-md">
              <h3 className="text-xl sm:text-2xl font-bold">Optimize Your Hospitality Business</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Dapatkan panduan setup sistem restoran dan konsultasi gratis langsung dari tim spesialis kami.
              </p>
            </div>

            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2.5 max-w-md w-full">
              <Input
                type="email"
                required
                value={emailSub}
                onChange={(e) => setEmailSub(e.target.value)}
                placeholder="Masukkan email bisnis Anda..."
                className="h-11 rounded-xl bg-background"
              />
              <Button type="submit" className="h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 shrink-0">
                {subSuccess ? 'Terkirim!' : 'Konsultasi Gratis'}
              </Button>
            </form>
          </div>
        </div>
      </section>
      </main>

      {/* 11. Footer */}
      <footer className="border-t border-border/60 bg-background py-12 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-amber-600 text-white grid place-items-center font-bold text-xs">
                  T
                </div>
                <span className="font-extrabold text-foreground text-sm">Tumbas POS</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                Platform all-in-one kasir pintar dan self-order QR restoran masa kini. Membantu bisnis kuliner berkembang lebih cepat.
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-foreground">Produk</div>
              <ul className="space-y-1.5">
                <li><Link to="/cashier" className="hover:text-foreground">Kasir POS</Link></li>
                <li><Link to="/kitchen" className="hover:text-foreground">Layar Dapur KDS</Link></li>
                <li><Link to="/s/warkop-nusantara" className="hover:text-foreground">Katalog QR Meja</Link></li>
                <li><Link to="/admin" className="hover:text-foreground">Dashboard Admin</Link></li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-foreground">Solusi</div>
              <ul className="space-y-1.5">
                <li><span className="hover:text-foreground cursor-pointer">Coffee Shop</span></li>
                <li><span className="hover:text-foreground cursor-pointer">Restoran Kasual</span></li>
                <li><span className="hover:text-foreground cursor-pointer">Bistro & Kafe</span></li>
                <li><span className="hover:text-foreground cursor-pointer">Cloud Kitchen</span></li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-foreground">Perusahaan</div>
              <ul className="space-y-1.5">
                <li><Link to="/login" className="hover:text-foreground">Masuk Akun</Link></li>
                <li><Link to="/register" className="hover:text-foreground">Daftar Akun Baru</Link></li>
                <li><Link to="/super" className="hover:text-foreground">Super Admin</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-8 text-[11px]">
            <p>© 2026 Tumbas POS. All rights reserved.</p>
            <div className="flex gap-4">
              <span className="hover:text-foreground cursor-pointer">Kebijakan Privasi</span>
              <span className="hover:text-foreground cursor-pointer">Syarat & Ketentuan</span>
              <span className="hover:text-foreground cursor-pointer">Bantuan</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
