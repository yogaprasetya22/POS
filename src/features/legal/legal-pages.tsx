import { Link } from 'react-router'
import { lastMenu } from '@shared/lib/last-menu'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'POS'
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || ''

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link to={lastMenu()?.path ?? '/'} className="inline-flex min-h-11 items-center text-base text-muted-foreground hover:text-foreground">← {lastMenu() ? 'Kembali ke menu' : 'Beranda'}</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Berlaku sejak Januari 2026</p>
      <div className="mt-6 space-y-5 leading-7 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">{children}</div>
      <p className="mt-10 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Ini naskah standar untuk layanan {APP_NAME}. Minta penasihat hukum meninjaunya sebelum dipakai untuk usaha komersial.
      </p>
    </main>
  )
}

export function PrivacyPage() {
  return (
    <Page title="Kebijakan Privasi">
      <p>{APP_NAME} membantu usaha makanan dan minuman menerima pesanan, pembayaran, dan laporan. Halaman ini menjelaskan data apa yang kami simpan dan untuk apa.</p>
      <h2>Data yang kami simpan</h2>
      <ul>
        <li><strong>Akun staf:</strong> email, peran, dan toko tempat bekerja.</li>
        <li><strong>Pesanan:</strong> nama pemesan yang diketik pelanggan, nomor meja, isi pesanan, total, dan metode pembayaran.</li>
        <li><strong>Member (jika program poin aktif):</strong> nama, nomor HP, poin, dan riwayat belanja di toko tersebut.</li>
        <li><strong>Log audit:</strong> catatan tindakan sensitif seperti void, refund, dan perubahan pengaturan.</li>
      </ul>
      <h2>Siapa yang bisa melihat</h2>
      <p>Data tiap toko hanya bisa dibuka oleh staf toko itu sesuai perannya. Toko lain dan pelanggan lain tidak bisa melihatnya. Pelanggan tidak perlu membuat akun untuk memesan.</p>
      <h2>Penyimpanan dan keamanan</h2>
      <p>Data disimpan di penyedia basis data terkelola dan dikirim lewat koneksi terenkripsi. PIN supervisor disimpan dalam bentuk hash, bukan teks asli.</p>
      <h2>Hak Anda</h2>
      <p>Pelanggan dan member bisa meminta data pribadinya dikoreksi atau dihapus lewat pemilik toko tempat mereka bertransaksi.{CONTACT && <> Pertanyaan lain: <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</>}</p>
    </Page>
  )
}

export function TermsPage() {
  return (
    <Page title="Syarat & Ketentuan">
      <p>Dengan memakai {APP_NAME}, pemilik usaha dan stafnya menyetujui ketentuan berikut.</p>
      <h2>Penggunaan layanan</h2>
      <ul>
        <li>Pemilik usaha bertanggung jawab atas data menu, harga, pajak, dan pengaturan tokonya.</li>
        <li>Akun dan PIN supervisor bersifat pribadi; jangan dibagikan.</li>
        <li>Dilarang memakai layanan untuk kegiatan melanggar hukum atau mengganggu pengguna lain.</li>
      </ul>
      <h2>Langganan</h2>
      <p>Toko baru mendapat masa uji coba. Setelah masa berlaku berakhir, penerimaan pesanan dan pembayaran baru dihentikan sampai langganan diperpanjang. Data lama tetap tersimpan dan bisa dilihat pemilik.</p>
      <h2>Pembayaran pelanggan</h2>
      <p>Saat ini pembayaran QRIS dan kartu dicatat manual oleh kasir. {APP_NAME} tidak memproses uang pelanggan.</p>
      <h2>Batas tanggung jawab</h2>
      <p>Layanan diberikan apa adanya. Pemilik usaha disarankan mencocokkan laporan dengan kas dan catatan pajaknya sendiri.</p>
    </Page>
  )
}
