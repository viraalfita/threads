import { getActiveUser } from "@/lib/user";
import { getDashboardSummary, getSyncState } from "@/lib/queries";
import { EmptyConnect } from "@/components/empty-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Heart, MessageCircle, Repeat2, Users, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PerfChart } from "@/components/dashboard/perf-chart";
import { PeriodSelect } from "@/components/dashboard/period-select";
import { SyncButton } from "@/components/dashboard/sync-button";
import { formatDateTime, formatNumber, formatPercent, truncate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const user = await getActiveUser().catch(() => null);
  if (!user) return <EmptyConnect />;

  const period = Math.max(7, Math.min(90, Number(searchParams.period) || 30));
  const [summary, sync] = await Promise.all([
    getDashboardSummary(user.id, period),
    getSyncState(user.id),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Last sync: {formatDateTime(sync?.last_succeeded_at)}{" "}
            {sync?.status === "running" && <span className="text-amber-500">(running…)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelect value={String(period)} />
          <SyncButton />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total post" value={formatNumber(summary.totalPosts)} icon={TrendingUp} />
        <KpiCard label="Total views" value={formatNumber(summary.totalViews)} icon={Eye} />
        <KpiCard
          label="Avg engagement"
          value={formatPercent(summary.avgEngagementRate)}
          icon={Heart}
          hint={`${formatNumber(summary.totalLikes)} likes`}
        />
        <KpiCard
          label="Followers"
          value={summary.followers != null ? formatNumber(summary.followers) : "—"}
          icon={Users}
          hint={`${formatNumber(summary.totalReplies)} replies, ${formatNumber(summary.totalReposts)} reposts`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performa {period} hari terakhir</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.byDay.some((d) => d.views > 0) ? (
            <PerfChart data={summary.byDay} />
          ) : (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              Belum ada data. Klik &quot;Sync now&quot; untuk menarik data dari Threads.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Top by engagement rate" rows={summary.topByEngagement} mode="er" />
        <TopList title="Top by views" rows={summary.topByViews} mode="views" />
      </div>
    </div>
  );
}

function TopList({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof getDashboardSummary>>["topByEngagement"];
  mode: "er" | "views";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Tidak ada data.</div>}
        {rows.map((p, i) => (
          <Link
            key={p.id}
            href={`/posts/${p.id}`}
            className="flex items-start gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors"
          >
            <div className="text-xs font-mono text-muted-foreground pt-0.5 w-6">#{i + 1}</div>
            <div className="flex-1 text-sm">{truncate(p.text, 120) || "(tanpa teks)"}</div>
            <div className="text-right text-xs">
              <div className="font-medium">
                {mode === "er"
                  ? formatPercent(p.insights?.engagement_rate)
                  : formatNumber(p.insights?.views)}
              </div>
              <div className="text-muted-foreground flex gap-2">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {formatNumber(p.insights?.views)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {formatNumber(p.insights?.likes)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {formatNumber(p.insights?.replies)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Repeat2 className="h-3 w-3" />
                  {formatNumber(p.insights?.reposts)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
