import { getActiveUser } from "@/lib/user";
import { listPosts } from "@/lib/queries";
import { EmptyConnect } from "@/components/empty-connect";
import { PostTable } from "@/components/posts/post-table";
import { SyncButton } from "@/components/dashboard/sync-button";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const user = await getActiveUser().catch(() => null);
  if (!user) return <EmptyConnect />;
  const rows = await listPosts(user.id, { limit: 500 });
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Posts</h1>
          <p className="text-sm text-muted-foreground">Semua post dari akun Threads kamu.</p>
        </div>
        <SyncButton />
      </div>
      <PostTable rows={rows} />
    </div>
  );
}
