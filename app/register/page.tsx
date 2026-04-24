import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { RegisterForm } from "@/components/auth/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Daftar ThreadLens</h1>
          <p className="text-sm text-muted-foreground">
            Buat akun untuk mulai analisa akun Threads kamu.
          </p>
        </div>
        <RegisterForm />
        <p className="text-center text-xs text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
