import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Eye, Heart, CalendarClock, TrendingUp, Sparkles } from "lucide-react";
import { listReplizAccounts, listSchedules, type ReplizScheduleItem } from "@/lib/repliz/client";
import { loadActiveMap } from "@/lib/repliz/settings";
import { getLatestPerformance, getLearnings } from "@/lib/analytics/store";
import { formatDate, formatDateTime, formatNumber, formatPercent, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AutopilotPage({
  searchParams,
}: {
  searchParams: { account?: string };
}) {
  let accounts: Awaited<ReturnType<typeof listReplizAccounts>> = [];
  let activeMap: Map<string, boolean> | null = null;
  let loadError: string | null = null;
  try {
    [accounts, activeMap] = await Promise.all([listReplizAccounts("threads"), loadActiveMap()]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const active = accounts.filter(
    (a) => a.isConnected && (activeMap === null || activeMap.get(a.id) === true),
  );

  if (loadError) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Gagal memuat data Repliz: {loadError}
            <div className="mt-2">Pastikan REPLIZ_API_USER / REPLIZ_API_PASS sudah di-set.</div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (active.length === 0) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada akun yang aktif. Aktifkan lewat tool{" "}
            <code className="rounded bg-muted px-1">set_account_active</code> dulu.
            {accounts.length > 0 && (
              <div className="mt-2">
                Terhubung: {accounts.map((a) => a.username).join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const selected =
    active.find((a) => a.username.toLowerCase() === (searchParams.account ?? "").toLowerCase()) ??
    active[0];

  let scheduled: ReplizScheduleItem[] = [];
  try {
    scheduled = (await listSchedules({ accountId: selected.id, status: "pending" })).sort(
      (a, b) => Date.parse(a.scheduleAt) - Date.parse(b.scheduleAt),
    );
  } catch {
    // tolerate Repliz hiccup
  }
  const [performance, learnings] = await Promise.all([
    getLatestPerformance(selected.id, 30).catch(() => []),
    getLearnings(selected.id, 5).catch(() => []),
  ]);

  const totals = performance.reduce(
    (acc, p) => ({ views: acc.views + p.views, likes: acc.likes + p.likes }),
    { views: 0, likes: 0 },
  );
  const avgEr =
    performance.length > 0
      ? performance.reduce((s, p) => s + p.engagement_rate, 0) / performance.length
      : 0;

  return (
    <Shell>
      {/* account switcher */}
      <div className="flex flex-wrap gap-2">
        {active.map((a) => (
          <Link key={a.id} href={`/autopilot?account=${encodeURIComponent(a.username)}`}>
            <Badge variant={a.id === selected.id ? "default" : "outline"}>@{a.username}</Badge>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Post tertrack" value={formatNumber(performance.length)} icon={TrendingUp} />
        <KpiCard label="Total views" value={formatNumber(totals.views)} icon={Eye} />
        <KpiCard label="Avg engagement" value={formatPercent(avgEr)} icon={Heart} hint={`${formatNumber(totals.likes)} likes`} />
        <KpiCard label="Antrian" value={formatNumber(scheduled.length)} icon={CalendarClock} hint="pending" />
      </div>

      {/* scheduled queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Terjadwal (pending)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduled.length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada post terjadwal.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Tayang</TableHead>
                  <TableHead className="w-40">Topik</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="w-16 text-right">Part</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduled.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{formatDateTime(s.scheduleAt)}</TableCell>
                    <TableCell className="text-sm">{s.topic || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {truncate(s.description, 90) || "(tanpa teks)"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{1 + (s.replies?.length ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* top performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Performa (top by ER)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {performance.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Belum ada data performa. Cron stats akan mengisinya setelah ada post terbit.
              </div>
            ) : (
              performance.slice(0, 8).map((p, i) => (
                <div key={p.post_id} className="flex items-start gap-3 rounded-md p-2">
                  <div className="text-xs font-mono text-muted-foreground pt-0.5 w-6">#{i + 1}</div>
                  <div className="flex-1 text-sm">{p.topic || "(tanpa topik)"}</div>
                  <div className="text-right text-xs">
                    <div className="font-medium">{formatPercent(p.engagement_rate)}</div>
                    <div className="text-muted-foreground flex gap-2 justify-end">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(p.views)}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{formatNumber(p.likes)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* learnings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Learnings terbaru
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {learnings.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Belum ada learning. Akan terisi setelah loop mingguan jalan.
              </div>
            ) : (
              learnings.map((l, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground mb-1">{formatDate(l.week)}</div>
                  <div className="text-sm">{l.summary}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Autopilot</h1>
        <p className="text-sm text-muted-foreground">
          Mesin konten otonom (Repliz) — akun, jadwal, performa, dan learnings.
        </p>
      </div>
      {children}
    </div>
  );
}
