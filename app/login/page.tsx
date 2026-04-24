import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">ThreadLens</h1>
          <p className="text-sm text-muted-foreground">Masuk untuk melanjutkan.</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="underline">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}
