import { env } from "../env";

// Thin client for the Repliz public API (https://api.repliz.com/public).
// Auth is HTTP Basic using REPLIZ_API_USER:REPLIZ_API_PASS.

export interface ReplizAccount {
  id: string;
  username: string;
  name: string | null;
  type: string; // "threads" | "instagram" | "tiktok" | ...
  isConnected: boolean;
  picture?: string | null;
}

export interface ReplizContent {
  id: string;
  title: string | null;
  description: string | null;
  type: string;
  url: string | null;
  createdAt: string;
}

export interface ReplizScheduleItem {
  id: string;
  description: string | null;
  topic: string | null;
  type: string;
  status: string; // "pending" | "success" | "failed" | ...
  scheduleAt: string;
  accountId: string;
  /** The published post id, set once status === "success". Used for attribution. */
  postId: string | null;
  replies?: Array<{ description: string | null }>;
}

interface Paginated<T> {
  docs: T[];
  totalDocs: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}

function authHeader(): string {
  const raw = `${env.replizApiUser()}:${env.replizApiPass()}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function replizFetch<T>(
  path: string,
  init?: {
    method?: string;
    query?: Record<string, string | number | string[] | undefined>;
    body?: unknown;
  },
): Promise<T> {
  const url = new URL(`${env.replizApiUrl()}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === "") continue;
      if (Array.isArray(v)) {
        // Repliz expects array params as `key[]=a&key[]=b`.
        for (const item of v) url.searchParams.append(`${k}[]`, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), {
    method: init?.method ?? "GET",
    headers: {
      authorization: authHeader(),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Repliz ${init?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  // Some endpoints (e.g. DELETE) may return empty bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : ({} as T)) as T;
}

/** List connected accounts, optionally filtered by platform type. */
export async function listReplizAccounts(type?: string): Promise<ReplizAccount[]> {
  const data = await replizFetch<Paginated<any>>("/account", {
    query: { page: 1, limit: 50, type },
  });
  return (data.docs ?? []).map((a) => ({
    id: a.id as string,
    username: a.username as string,
    name: (a.name as string) ?? null,
    type: a.type as string,
    isConnected: Boolean(a.isConnected),
    picture: a.picture ?? null,
  }));
}

export interface CreateScheduleInput {
  accountId: string;
  /** First post (root) text. */
  description: string;
  /** Subsequent thread parts; each becomes a reply in the chain. */
  replies?: string[];
  topic?: string;
  /** ISO timestamp for when to publish. */
  scheduleAt: string;
  /** Mark as AI-generated (honesty flag in Repliz). */
  isAiGenerated?: boolean;
  /** Keep as a draft in Repliz instead of scheduling live. */
  isDraft?: boolean;
}

/**
 * Create a scheduled (or immediate) text post / thread chain. Returns the
 * Repliz scheduleId. All DTO-required fields are sent even when empty.
 */
export async function createSchedule(input: CreateScheduleInput): Promise<{ scheduleId: string }> {
  const emptyMusic = { id: "", artist: "", name: "", thumbnail: "" };
  const body = {
    title: "",
    description: input.description,
    topic: input.topic ?? "",
    type: "text",
    medias: [],
    meta: { title: "", description: "", url: "" },
    additionalInfo: {
      isAiGenerated: input.isAiGenerated ?? true,
      isDraft: input.isDraft ?? false,
      collaborators: [],
      music: emptyMusic,
      products: [],
      tags: [],
    },
    replies: (input.replies ?? []).map((text) => ({
      title: "",
      description: text,
      topic: "",
      type: "text",
      medias: [],
    })),
    accountId: input.accountId,
    scheduleAt: input.scheduleAt,
  };
  return replizFetch<{ scheduleId: string }>("/schedule", { method: "POST", body });
}

export async function listSchedules(opts: {
  accountId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<ReplizScheduleItem[]> {
  const data = await replizFetch<Paginated<any>>("/schedule", {
    query: {
      page: 1,
      limit: 50,
      accountIds: opts.accountId ? [opts.accountId] : undefined,
      status: opts.status,
      fromDate: opts.fromDate,
      toDate: opts.toDate,
    },
  });
  return (data.docs ?? []).map((s) => ({
    id: s.id as string,
    description: s.description ?? null,
    topic: s.topic ?? null,
    type: s.type as string,
    status: s.status as string,
    scheduleAt: s.scheduleAt as string,
    accountId: s.accountId as string,
    postId: s.postId ?? null,
    replies: Array.isArray(s.replies)
      ? s.replies.map((r: any) => ({ description: r.description ?? null }))
      : [],
  }));
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  await replizFetch<unknown>(`/schedule/${scheduleId}`, { method: "DELETE" });
}

export interface ReplizStatistic {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

/**
 * Engagement statistics for a published post. The Repliz endpoint uses singular
 * field names (like/repost/share); we normalize to plurals. Threads accounts
 * are supported; some other platforms 403 (caller should handle gracefully).
 */
export async function getStatistic(contentId: string, accountId: string): Promise<ReplizStatistic> {
  const s = await replizFetch<any>(`/content/${contentId}/statistic`, {
    query: { accountId },
  });
  return {
    views: Number(s.views ?? 0),
    likes: Number(s.like ?? s.likes ?? 0),
    replies: Number(s.replies ?? 0),
    reposts: Number(s.repost ?? s.reposts ?? 0),
    quotes: Number(s.quotes ?? 0),
    shares: Number(s.share ?? s.shares ?? 0),
  };
}

/** Recent content for an account (no engagement metrics in this endpoint). */
export async function listReplizContent(
  accountId: string,
  nextToken?: string,
): Promise<{ items: ReplizContent[]; nextToken?: string }> {
  const data = await replizFetch<any>("/content", {
    query: { accountId, nextToken },
  });
  const items = (data.docs ?? []).map((c: any) => ({
    id: c.id as string,
    title: c.title ?? null,
    description: c.description ?? null,
    type: c.type as string,
    url: c.url ?? null,
    createdAt: c.createdAt as string,
  }));
  return { items, nextToken: data.nextToken };
}
