import Link from "next/link";
import { AtSign, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Data Deletion Status — ThreadLens",
};

export default function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-2xl w-full flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <AtSign className="h-4 w-4" />
            </div>
            <span className="font-semibold">ThreadLens</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="mx-auto max-w-2xl w-full px-6 py-12 space-y-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-500 mt-1" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Data Deletion Diproses</h1>
              <p className="text-sm text-muted-foreground">
                Permintaan penghapusan data dari Meta sudah kami terima dan jalankan. Semua post,
                insights, riwayat analisa, dan token akses yang terkait dengan akun Threads kamu
                telah dihapus dari database kami.
              </p>
              {searchParams.code && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Confirmation code</div>
                  <code className="font-mono break-all">{searchParams.code}</code>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Kalau kamu mau menghubungkan ulang akun Threads, kamu bisa mendaftar dan connect
                lagi kapan saja lewat halaman utama.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Link
              href="/"
              className="text-sm underline text-muted-foreground hover:text-foreground"
            >
              ← Kembali ke beranda
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
