import Link from "next/link";
import { AtSign } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — ThreadLens",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-3xl w-full flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <AtSign className="h-4 w-4" />
            </div>
            <span className="font-semibold">ThreadLens</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl w-full px-6 py-12 space-y-6 text-sm leading-relaxed">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Berlaku sejak: 20 April 2026
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">1. Tentang ThreadLens</h2>
            <p>
              ThreadLens (&quot;kami&quot;, &quot;layanan&quot;) adalah aplikasi analitik untuk akun
              Threads pribadi pengguna. Layanan ini menarik data publik dan insights dari akun
              Threads yang kamu hubungkan secara sukarela melalui OAuth resmi Meta, lalu
              menyajikannya dalam bentuk dashboard dan analisa berbasis AI.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">2. Data yang Kami Kumpulkan</h2>
            <p>Saat kamu register dan menghubungkan akun Threads, kami menyimpan:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Akun ThreadLens:</strong> alamat email dan password (di-hash dengan bcrypt
                — kami tidak menyimpan password dalam bentuk teks asli).
              </li>
              <li>
                <strong>Profil Threads:</strong> Threads user ID, username, nama tampilan, foto profil.
              </li>
              <li>
                <strong>Akses token Threads:</strong> di-enkripsi AES-256-GCM sebelum disimpan.
                Token hanya digunakan untuk memanggil API Threads atas nama kamu.
              </li>
              <li>
                <strong>Konten post:</strong> teks, media URL, permalink, timestamp, dan jenis
                media dari post di akun Threads kamu.
              </li>
              <li>
                <strong>Insights:</strong> jumlah views, likes, replies, reposts, quotes, shares
                per post dan total akun (followers, dll).
              </li>
              <li>
                <strong>Hasil analisa AI:</strong> output yang dihasilkan oleh model LLM saat
                kamu menjalankan analisa performa atau pola.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">3. Bagaimana Kami Menggunakan Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Menampilkan dashboard analitik Threads kamu.</li>
              <li>Mengirim prompt yang berisi metadata post kamu ke penyedia LLM (OpenRouter) untuk menghasilkan analisa.</li>
              <li>Menyimpan riwayat analisa supaya bisa kamu tinjau kembali.</li>
              <li>Memelihara koneksi (refresh access token) selama akun Threads masih terhubung.</li>
            </ul>
            <p>Kami <strong>tidak</strong> menjual data kamu, tidak menggunakannya untuk iklan, dan tidak membagikan ke pihak ketiga di luar pemrosesan teknis di bawah.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">4. Pihak Ketiga yang Memproses Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase</strong> — database tempat seluruh data tersimpan.</li>
              <li><strong>Vercel</strong> — hosting aplikasi web.</li>
              <li><strong>Meta / Threads Graph API</strong> — sumber data Threads (kamu menyetujui akses lewat OAuth).</li>
              <li><strong>OpenRouter + provider LLM yang dipilih</strong> — memproses prompt analisa. Konten post kamu (teks, metrik) dikirim ke provider LLM saat kamu memicu analisa.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">5. Penyimpanan dan Keamanan</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Akses token Threads di-enkripsi sebelum disimpan.</li>
              <li>Password admin di-hash dengan bcrypt cost 12.</li>
              <li>Akses ke database hanya melalui server kami menggunakan service role.</li>
              <li>Sesi login menggunakan cookie httpOnly dengan signed JWT.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">6. Hak Kamu &amp; Penghapusan Data</h2>
            <p>
              Kamu bisa menghapus data kapan saja:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Disconnect akun Threads</strong> dari halaman <Link href="/settings" className="underline">Settings</Link> — semua post, insights, dan riwayat analisa untuk akun tersebut akan terhapus permanen.
              </li>
              <li>
                <strong>Hapus akun ThreadLens</strong> — kirim email ke kami (di bawah) dengan subjek &quot;Delete account&quot;. Data akan dihapus dalam 7 hari.
              </li>
              <li>
                <strong>Permintaan dari Meta:</strong> jika kamu mencabut izin app dari pengaturan
                Threads, Meta mengirim signed request ke endpoint Data Deletion Callback kami,
                dan kami akan otomatis menghapus data terkait akun tersebut.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">7. Cookie</h2>
            <p>
              Kami menggunakan cookie esensial untuk:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><code>threadlens_session</code> — session login (httpOnly, signed JWT).</li>
              <li><code>threadlens_active_account</code> — akun Threads yang sedang aktif di switcher.</li>
              <li><code>threads_oauth_state</code> — sementara, untuk verifikasi OAuth state.</li>
            </ul>
            <p>Tidak ada cookie tracking atau iklan pihak ketiga.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">8. Anak-anak</h2>
            <p>Layanan ini ditujukan untuk pengguna ≥ 13 tahun, mengikuti syarat layanan Threads / Meta.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">9. Perubahan Kebijakan</h2>
            <p>
              Kebijakan ini dapat berubah sewaktu-waktu. Tanggal &quot;berlaku sejak&quot; di atas
              akan diperbarui. Perubahan signifikan akan kami komunikasikan via email.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">10. Kontak</h2>
            <p>
              Pertanyaan, permintaan akses/hapus data, atau keluhan privasi:
              <br />
              <a href="mailto:bhskindatabase@gmail.com" className="underline">bhskindatabase@gmail.com</a>
            </p>
          </section>
        </article>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-3xl w-full px-6 py-6 text-xs text-muted-foreground flex items-center justify-between">
          <Link href="/" className="hover:text-foreground">← Kembali ke beranda</Link>
          <span>© {new Date().getFullYear()} ThreadLens</span>
        </div>
      </footer>
    </div>
  );
}
