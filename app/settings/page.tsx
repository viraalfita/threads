import Link from "next/link";
import { getActiveUser, listMyAccounts } from "@/lib/user";
import { getSyncState } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DisconnectButton } from "@/components/settings/disconnect-button";
import { SyncButton } from "@/components/dashboard/sync-button";
import { formatDateTime } from "@/lib/utils";
import { Plug, ShieldCheck, AlertTriangle, Plus } from "lucide-react";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; connected?: string };
}) {
  const session = await getSession();
  const accounts = await listMyAccounts();
  const active = await getActiveUser();
  const sync = active ? await getSyncState(active.id) : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Kelola akun Threads yang terhubung dan sync data.
          </p>
        </div>
        {session && (
          <div className="text-xs text-muted-foreground text-right">
            Login sebagai<br />
            <span className="font-medium text-foreground">{session.email}</span>
          </div>
        )}
      </div>

      {searchParams.error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div>
              <div className="font-medium">Error</div>
              <div className="text-muted-foreground">{decodeURIComponent(searchParams.error)}</div>
            </div>
          </CardContent>
        </Card>
      )}
      {searchParams.connected && (
        <Card className="border-emerald-500/50">
          <CardContent className="pt-6 flex items-start gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div className="font-medium">Akun terhubung. Silakan klik &quot;Sync now&quot; untuk tarik data pertama.</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Akun Threads</CardTitle>
            <CardDescription>
              {accounts.length === 0
                ? "Belum ada akun Threads. Connect untuk mulai."
                : `${accounts.length} akun terhubung. Pindah akun dari switcher di topbar.`}
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/api/auth/threads">
              <Plus className="h-4 w-4" /> Tambah akun
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <Button asChild>
              <Link href="/api/auth/threads">
                <Plug className="h-4 w-4" /> Connect Threads
              </Link>
            </Button>
          ) : (
            accounts.map((user) => (
              <div
                key={user.id}
                className={`flex items-center gap-4 rounded-md border p-3 ${
                  user.id === active?.id ? "border-primary/50 bg-primary/5" : ""
                }`}
              >
                <Avatar className="h-10 w-10">
                  {user.threads_profile_picture_url && (
                    <AvatarImage src={user.threads_profile_picture_url} alt={user.username ?? ""} />
                  )}
                  <AvatarFallback>{(user.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{user.name ?? user.username ?? "—"}</div>
                    {user.id === active?.id && (
                      <Badge variant="default" className="text-[10px]">active</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    @{user.username ?? user.threads_user_id}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Token expires: {formatDateTime(user.token_expires_at)}
                  </div>
                </div>
                <DisconnectButton userId={user.id} label="Hapus" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle>Sync — @{active.username ?? active.threads_user_id}</CardTitle>
            <CardDescription>Status sync untuk akun yang lagi aktif.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Status" value={sync?.status ?? "idle"} />
              <Stat label="Posts synced" value={String(sync?.posts_synced ?? 0)} />
              <Stat label="Last started" value={formatDateTime(sync?.last_started_at)} />
              <Stat label="Last succeeded" value={formatDateTime(sync?.last_succeeded_at)} />
              <Stat label="Next scheduled" value={formatDateTime(sync?.next_scheduled_at)} />
              <Stat label="Last error" value={sync?.last_error ?? "—"} />
            </div>
            <div className="flex gap-2 pt-2">
              <SyncButton />
              <SyncButton full />
            </div>
            <p className="text-xs text-muted-foreground">
              Sync incremental berhenti setelah ketemu 20 post yang sudah dikenal. Full sync mengulang semua post + refresh insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
