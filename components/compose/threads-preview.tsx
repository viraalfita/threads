"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Repeat2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewAuthor {
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * A fake Threads-style render of what the post / thread will look like once
 * published. Connected segments get the signature vertical connector line
 * between avatars (comment-in-comment layout).
 */
export function ThreadsPreview({
  segments,
  author,
}: {
  segments: string[];
  author: PreviewAuthor;
}) {
  const parts = segments.map((s) => s.trim());
  // Keep empty trailing parts out, but always show at least one row.
  const lastFilled = parts.reduce((acc, p, i) => (p ? i : acc), -1);
  const rows = parts.slice(0, Math.max(lastFilled + 1, 1));
  const handle = author.username ?? "username";
  const display = author.name ?? handle;
  const initials = (display || "?").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-xl border bg-background">
      <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Preview</div>
      <div className="px-4 py-3">
        {rows.map((text, i) => {
          const isLast = i === rows.length - 1;
          return (
            <div key={i} className="flex gap-3">
              {/* avatar column + connector line */}
              <div className="flex flex-col items-center">
                <Avatar className="h-9 w-9">
                  {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt={handle} />}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                {!isLast && <div className="my-1 w-0.5 flex-1 rounded bg-border" />}
              </div>

              {/* content column */}
              <div className={cn("min-w-0 flex-1", isLast ? "pb-1" : "pb-5")}>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-semibold">{display}</span>
                  <span className="text-muted-foreground">@{handle}</span>
                  <span className="text-muted-foreground">· now</span>
                </div>
                <div
                  className={cn(
                    "mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed",
                    !text && "italic text-muted-foreground",
                  )}
                >
                  {text || "Tulisan kamu akan muncul di sini…"}
                </div>
                <div className="mt-2 flex items-center gap-5 text-muted-foreground">
                  <Heart className="h-[18px] w-[18px]" />
                  <MessageCircle className="h-[18px] w-[18px]" />
                  <Repeat2 className="h-[18px] w-[18px]" />
                  <Send className="h-[18px] w-[18px]" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
