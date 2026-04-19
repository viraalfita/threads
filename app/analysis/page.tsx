import { getCurrentUser } from "@/lib/user";
import { EmptyConnect } from "@/components/empty-connect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatternRunner } from "@/components/analysis/pattern-runner";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Markdown } from "@/lib/markdown";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return <EmptyConnect />;

  const db = supabaseAdmin();
  const { data: history } = await db
    .from("llm_analysis")
    .select("id, type, output, model_used, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">AI Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Analisa kualitatif dengan LLM. Performance untuk 1 post (jalankan dari halaman post detail), Pattern untuk lintas post.
        </p>
      </div>

      <Tabs defaultValue="pattern">
        <TabsList>
          <TabsTrigger value="pattern">Pattern Detection</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
          <TabsTrigger value="performance">Performance (per post)</TabsTrigger>
        </TabsList>

        <TabsContent value="pattern">
          <Card>
            <CardHeader>
              <CardTitle>Pattern Detection</CardTitle>
              <CardDescription>
                Bandingkan top vs bottom post pada periode tertentu untuk menemukan pola yang konsisten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatternRunner />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {(history ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada analisa. Jalankan dari tab lain.</p>
          )}
          {(history ?? []).map((h: any) => (
            <Card key={h.id}>
              <CardHeader>
                <CardTitle className="text-base capitalize">{h.type}</CardTitle>
                <CardDescription>
                  {formatDateTime(h.created_at)} • {h.model_used}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Markdown source={h.output} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Buka halaman <strong>Posts</strong> → klik post → tombol &quot;Analisa dengan AI&quot;.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
