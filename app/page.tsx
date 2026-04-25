import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AtSign, BarChart3, Sparkles, RefreshCw, LogIn } from "lucide-react";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-6xl w-full flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <AtSign className="h-4 w-4" />
            </div>
            <span className="font-semibold">ThreadLens</span>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild>
                <Link href="/dashboard">
                  <BarChart3 className="h-4 w-4" /> Buka Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">
                    <LogIn className="h-4 w-4" /> Masuk
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Daftar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl w-full px-6 py-16 md:py-24">
          <div className="max-w-2xl space-y-5">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Analisa performa Threads. Dengan bantuan AI.
            </h1>
            <p className="text-lg text-muted-foreground">
              Tarik semua post + insights dari akun Threads kamu, pantau engagement rate,
              dan dapatkan analisa pola dengan LLM — semua dari satu dashboard.
            </p>
            <div className="flex items-center gap-3 pt-2">
              {session ? (
                <Button size="lg" asChild>
                  <Link href="/dashboard">Buka Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link href="/register">Mulai gratis</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/login">Saya sudah punya akun</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-6xl w-full px-6 py-16 grid gap-8 md:grid-cols-3">
            <Feature
              icon={RefreshCw}
              title="Sync otomatis"
              body="Tarik semua post + insights (views, likes, replies, reposts, quotes, shares) lewat Threads Graph API resmi."
            />
            <Feature
              icon={BarChart3}
              title="Metrics lengkap"
              body="Dashboard dengan breakdown per hari, top posts by engagement rate / views, dan tabel post yang sortable + exportable ke CSV."
            />
            <Feature
              icon={Sparkles}
              title="AI insights"
              body="Analisa performa per post atau deteksi pola antara top vs bottom performer — dapat rekomendasi konkret yang actionable."
            />
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl w-full px-6 py-16">
            <h2 className="text-2xl font-semibold mb-6">Cara kerja</h2>
            <ol className="space-y-4 text-sm max-w-xl">
              <Step num={1} text="Daftar akun ThreadLens (gratis)." />
              <Step num={2} text="Connect akun Threads lewat OAuth — aman, nggak perlu bagikan password." />
              <Step num={3} text="Sync data pertama, lalu refresh kapan aja buat update insights." />
              <Step num={4} text="Mulai analisa: dashboard visual + AI explanation sesuai konten kamu." />
            </ol>
            <div className="pt-8">
              {session ? (
                <Button asChild>
                  <Link href="/dashboard">Buka Dashboard</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/register">Mulai sekarang</Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl w-full px-6 py-6 text-xs text-muted-foreground flex items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} ThreadLens</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link>
            <span>v0.1 MVP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {num}
      </div>
      <span className="pt-0.5">{text}</span>
    </li>
  );
}
