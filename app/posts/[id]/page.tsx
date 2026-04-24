import { getActiveUser } from "@/lib/user";
import { getPost } from "@/lib/queries";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils";
import { ExternalLink, Eye, Heart, MessageCircle, Repeat2, Quote, Share2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PerformanceButton } from "@/components/analysis/performance-button";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const user = await getActiveUser().catch(() => null);
  if (!user) return notFound();
  const post = await getPost(user.id, params.id);
  if (!post) return notFound();
  const i = post.insights;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <Link href="/posts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to posts
        </Link>
        <PerformanceButton postId={post.id} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Post detail</CardTitle>
            <div className="flex items-center gap-2">
              {post.is_quote_post && <Badge variant="secondary">Quote post</Badge>}
              {post.media_type && post.media_type !== "TEXT" && (
                <Badge variant="outline">{post.media_type}</Badge>
              )}
              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Buka di Threads <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Dipublish {formatDateTime(post.published_at)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {post.text && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{post.text}</div>
          )}
          {post.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.thumbnail_url}
              alt=""
              className="rounded-md max-h-96 object-cover border"
            />
          )}

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2 border-t">
            <Metric icon={Eye} label="Views" value={formatNumber(i?.views)} />
            <Metric icon={Heart} label="Likes" value={formatNumber(i?.likes)} />
            <Metric icon={MessageCircle} label="Replies" value={formatNumber(i?.replies)} />
            <Metric icon={Repeat2} label="Reposts" value={formatNumber(i?.reposts)} />
            <Metric icon={Quote} label="Quotes" value={formatNumber(i?.quotes)} />
            <Metric icon={Share2} label="Shares" value={formatNumber(i?.shares)} />
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Engagement rate:</span>{" "}
            <span className="font-semibold">{formatPercent(i?.engagement_rate)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
