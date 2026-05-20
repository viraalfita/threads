"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CHAR_LIMIT = 500;

export function Composer({ canPublish }: { canPublish: boolean }) {
  const [brief, setBrief] = useState("");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const len = text.trim().length;
  const over = len > CHAR_LIMIT;

  async function suggest() {
    setSuggesting(true);
    setDrafts([]);
    try {
      const res = await fetch("/api/compose/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, count: 3 }),
      });
      const json = await res.json();
      if (!res.ok) toast.error(json.error ?? "Gagal bikin draft");
      else setDrafts(json.drafts ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSuggesting(false);
    }
  }

  async function publish() {
    const body = text.trim();
    if (!body) return toast.error("Tulis dulu isinya");
    if (over) return toast.error(`Lebih dari ${CHAR_LIMIT} karakter`);
    if (!confirm("Publish post ini ke Threads sekarang?")) return;

    setPublishing(true);
    try {
      const res = await fetch("/api/compose/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(
          json.error === "missing_publish_scope"
            ? "Akun belum punya izin publish — reconnect Threads di Settings."
            : json.error ?? "Gagal publish",
        );
        return;
      }
      toast.success("Terpublish ke Threads!", {
        action: json.permalink
          ? { label: "Lihat", onClick: () => window.open(json.permalink, "_blank") }
          : undefined,
      });
      setText("");
      setDrafts([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1 — AI suggestions (optional) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">1. Minta saran draft ke AI (opsional)</label>
        <p className="text-xs text-muted-foreground">
          AI menulis draft meniru gaya post kamu yang paling perform. Kamu tetap bisa edit sebelum publish.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            placeholder="Topik atau brief singkat… (kosongkan untuk ide bebas)"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="min-h-[60px]"
          />
          <Button onClick={suggest} disabled={suggesting} variant="outline" className="sm:self-start">
            <Sparkles className="h-4 w-4" />
            {suggesting ? "Membuat…" : "Saranin draft"}
          </Button>
        </div>

        {drafts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {drafts.map((d, i) => (
              <Card
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => setText(d)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setText(d)}
                className="cursor-pointer transition-colors hover:border-primary hover:bg-accent/40"
              >
                <CardContent className="p-3 text-sm whitespace-pre-wrap line-clamp-[10]">{d}</CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — edit + publish (always required, human-in-the-loop) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">2. Tulis / edit, lalu publish</label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Apa yang mau kamu post ke Threads?"
          className="min-h-[160px] text-base"
        />
        <div className="flex items-center justify-between">
          <span className={cn("text-xs", over ? "text-destructive font-medium" : "text-muted-foreground")}>
            {len} / {CHAR_LIMIT}
          </span>
          <Button onClick={publish} disabled={publishing || over || len === 0 || !canPublish}>
            <Send className="h-4 w-4" />
            {publishing ? "Mempublish…" : "Publish ke Threads"}
          </Button>
        </div>
        {!canPublish && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            Akun aktif belum punya izin publish.{" "}
            <a href="/api/auth/threads" className="inline-flex items-center gap-1 underline">
              Reconnect Threads <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
