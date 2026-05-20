"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, ExternalLink, Plus, X, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ThreadsPreview } from "@/components/compose/threads-preview";

const CHAR_LIMIT = 500;

interface ComposerAuthor {
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function Composer({ canPublish, author }: { canPublish: boolean; author: ComposerAuthor }) {
  const [brief, setBrief] = useState("");
  const [threadMode, setThreadMode] = useState(false);
  const [drafts, setDrafts] = useState<string[][]>([]);
  const [segments, setSegments] = useState<string[]>([""]);
  const [suggesting, setSuggesting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const filled = segments.map((s) => s.trim()).filter(Boolean);
  const anyOver = segments.some((s) => s.trim().length > CHAR_LIMIT);
  const canSend = filled.length > 0 && !anyOver && canPublish && !publishing;

  function setSegment(i: number, value: string) {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }
  function addSegment() {
    setSegments((prev) => [...prev, ""]);
  }
  function removeSegment(i: number) {
    setSegments((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  function loadDraft(parts: string[]) {
    setSegments(parts.length > 0 ? parts : [""]);
  }

  async function suggest() {
    setSuggesting(true);
    setDrafts([]);
    try {
      const res = await fetch("/api/compose/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, thread: threadMode }),
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
    if (filled.length === 0) return toast.error("Tulis dulu isinya");
    if (anyOver) return toast.error(`Ada bagian lebih dari ${CHAR_LIMIT} karakter`);
    const label = filled.length > 1 ? `thread ${filled.length} bagian` : "post ini";
    if (!confirm(`Publish ${label} ke Threads sekarang?`)) return;

    setPublishing(true);
    try {
      const res = await fetch("/api/compose/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: filled }),
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
      toast.success(
        json.count > 1 ? `Thread ${json.count} bagian terpublish!` : "Terpublish ke Threads!",
        {
          action: json.permalink
            ? { label: "Lihat", onClick: () => window.open(json.permalink, "_blank") }
            : undefined,
        },
      );
      setSegments([""]);
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
          AI nulis draft niru gaya post kamu yang paling perform. Kamu tetap bisa edit sebelum publish.
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
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={threadMode}
            onChange={(e) => setThreadMode(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Bikin thread panjang (beberapa bagian nyambung)
        </label>

        {drafts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {drafts.map((parts, i) => (
              <Card
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => loadDraft(parts)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && loadDraft(parts)}
                className="cursor-pointer transition-colors hover:border-primary hover:bg-accent/40"
              >
                <CardContent className="space-y-1 p-3">
                  {parts.length > 1 && (
                    <div className="text-xs font-medium text-muted-foreground">
                      Thread · {parts.length} bagian
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm line-clamp-[8]">{parts.join("\n\n— ")}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — edit + publish (always required, human-in-the-loop) */}
      <div className="space-y-3">
        <label className="text-sm font-medium">
          2. Tulis / edit, lalu publish
          {filled.length > 1 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · thread {filled.length} bagian
            </span>
          )}
        </label>

        {segments.map((seg, i) => {
          const over = seg.trim().length > CHAR_LIMIT;
          return (
            <div key={i} className="space-y-1">
              {i > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CornerDownRight className="h-3 w-3" /> balasan bagian {i + 1}
                </div>
              )}
              <div className="relative">
                <Textarea
                  value={seg}
                  onChange={(e) => setSegment(i, e.target.value)}
                  placeholder={i === 0 ? "Apa yang mau kamu post ke Threads?" : "Lanjutan thread…"}
                  className="min-h-[120px] text-base"
                />
                {segments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSegment(i)}
                    aria-label="Hapus bagian"
                    className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <span className={cn("text-xs", over ? "font-medium text-destructive" : "text-muted-foreground")}>
                {seg.trim().length} / {CHAR_LIMIT}
              </span>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={addSegment}>
            <Plus className="h-4 w-4" /> Tambah bagian
          </Button>
          <Button onClick={publish} disabled={!canSend}>
            <Send className="h-4 w-4" />
            {publishing ? "Mempublish…" : filled.length > 1 ? "Publish thread" : "Publish ke Threads"}
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

      {/* Live preview — how it will look on Threads */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Preview di Threads</label>
        <ThreadsPreview segments={segments} author={author} />
      </div>
    </div>
  );
}
