import { getActiveUser } from "@/lib/user";
import { EmptyConnect } from "@/components/empty-connect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Composer } from "@/components/compose/composer";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const user = await getActiveUser().catch(() => null);
  if (!user) return <EmptyConnect />;

  const canPublish = user.scopes?.includes("threads_content_publish") ?? false;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Compose</h1>
        <p className="text-sm text-muted-foreground">
          Tulis post baru ke Threads. AI bisa bantu nyusun draft dari pola konten yang perform — kamu yang
          edit dan tekan publish.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Post baru</CardTitle>
          <CardDescription>
            Posting sebagai{" "}
            <strong>@{user.username ?? user.threads_user_id}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Composer canPublish={canPublish} />
        </CardContent>
      </Card>
    </div>
  );
}
