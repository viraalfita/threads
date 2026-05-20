import { env } from "../env";
import {
  ThreadsListResponse,
  ThreadsPost,
  ThreadsUser,
  ThreadsInsightsResponse,
} from "./types";

const GRAPH_BASE = "https://graph.threads.net/v1.0";
const AUTH_BASE = "https://threads.net/oauth";

export const THREADS_SCOPES = [
  "threads_basic",
  "threads_manage_insights",
  "threads_content_publish",
];

/** Threads enforces a 500-character limit on a single text post. */
export const THREADS_TEXT_LIMIT = 500;

// ---- OAuth helpers ------------------------------------------------------

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.metaAppId(),
    redirect_uri: env.metaRedirectUri(),
    scope: THREADS_SCOPES.join(","),
    response_type: "code",
    state,
  });
  return `https://threads.net/oauth/authorize?${params.toString()}`;
}

export interface ShortLivedTokenResponse {
  access_token: string;
  user_id: string;
}

export async function exchangeCodeForShortToken(code: string): Promise<ShortLivedTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.metaAppId(),
    client_secret: env.metaAppSecret(),
    grant_type: "authorization_code",
    redirect_uri: env.metaRedirectUri(),
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: env.metaAppSecret(),
    access_token: shortToken,
  });
  const res = await fetch(`${GRAPH_BASE}/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`long-lived exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshLongLivedToken(token: string): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/refresh_access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---- Data fetchers ------------------------------------------------------

const USER_FIELDS = "id,username,name,threads_profile_picture_url,threads_biography";
const POST_FIELDS =
  "id,text,media_type,media_url,thumbnail_url,permalink,timestamp,username,is_quote_post";

async function gget<T>(path: string, token: string, query: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Threads API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getMe(token: string): Promise<ThreadsUser> {
  return gget<ThreadsUser>(`/me`, token, { fields: USER_FIELDS });
}

export async function listMyPosts(
  token: string,
  opts: { limit?: number; after?: string; since?: string; until?: string } = {},
): Promise<ThreadsListResponse<ThreadsPost>> {
  const q: Record<string, string> = { fields: POST_FIELDS, limit: String(opts.limit ?? 25) };
  if (opts.after) q.after = opts.after;
  if (opts.since) q.since = opts.since;
  if (opts.until) q.until = opts.until;
  return gget<ThreadsListResponse<ThreadsPost>>(`/me/threads`, token, q);
}

export async function* iterateMyPosts(
  token: string,
  opts: { pageSize?: number; max?: number } = {},
): AsyncGenerator<ThreadsPost, void, unknown> {
  let after: string | undefined = undefined;
  let count = 0;
  const max = opts.max ?? Infinity;
  while (true) {
    const res: ThreadsListResponse<ThreadsPost> = await listMyPosts(token, {
      limit: opts.pageSize ?? 25,
      after,
    });
    for (const p of res.data ?? []) {
      yield p;
      count++;
      if (count >= max) return;
    }
    after = res.paging?.cursors?.after;
    if (!after || !res.data?.length) return;
  }
}

const POST_INSIGHT_METRICS = ["views", "likes", "replies", "reposts", "quotes", "shares"];

export interface FlatPostInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export async function getPostInsights(postId: string, token: string): Promise<FlatPostInsights> {
  const res = await gget<ThreadsInsightsResponse>(`/${postId}/insights`, token, {
    metric: POST_INSIGHT_METRICS.join(","),
  });
  return flattenInsights(res, POST_INSIGHT_METRICS) as unknown as FlatPostInsights;
}

const ACCOUNT_INSIGHT_METRICS = [
  "views",
  "likes",
  "replies",
  "reposts",
  "quotes",
  "followers_count",
];

export interface FlatAccountInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followers_count: number;
}

export async function getAccountInsights(
  threadsUserId: string,
  token: string,
  opts: { since?: number; until?: number } = {},
): Promise<FlatAccountInsights> {
  const q: Record<string, string> = { metric: ACCOUNT_INSIGHT_METRICS.join(",") };
  if (opts.since) q.since = String(opts.since);
  if (opts.until) q.until = String(opts.until);
  const res = await gget<ThreadsInsightsResponse>(`/${threadsUserId}/threads_insights`, token, q);
  return flattenInsights(res, ACCOUNT_INSIGHT_METRICS) as unknown as FlatAccountInsights;
}

// ---- Publishing ---------------------------------------------------------

async function gpost<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Threads API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

interface ThreadsCreationId {
  id: string;
}

/**
 * Publish a single text-only thread. Threads publishing is a two-step flow:
 *   1. create a media container (`/{user}/threads`)
 *   2. publish that container (`/{user}/threads_publish`)
 * Pass `replyToId` to publish this post as a reply (used to build a thread chain).
 * Requires the `threads_content_publish` scope.
 */
export async function publishTextPost(
  threadsUserId: string,
  token: string,
  text: string,
  replyToId?: string,
): Promise<{ id: string; permalink?: string }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot publish an empty post.");
  if (trimmed.length > THREADS_TEXT_LIMIT) {
    throw new Error(`Post exceeds the ${THREADS_TEXT_LIMIT}-character limit.`);
  }

  const container = await gpost<ThreadsCreationId>(`/${threadsUserId}/threads`, token, {
    media_type: "TEXT",
    text: trimmed,
    ...(replyToId ? { reply_to_id: replyToId } : {}),
  });

  const published = await gpost<ThreadsCreationId>(`/${threadsUserId}/threads_publish`, token, {
    creation_id: container.id,
  });

  // Best-effort: fetch the permalink so the UI can link to the live post.
  let permalink: string | undefined;
  try {
    const detail = await gget<ThreadsPost>(`/${published.id}`, token, { fields: "permalink" });
    permalink = detail.permalink;
  } catch {
    // permalink is non-essential; ignore failures
  }

  return { id: published.id, permalink };
}

/**
 * Publish a chain of connected posts ("thread"). The first segment is the root
 * post; each following segment is published as a reply to the previous one,
 * producing the comment-in-comment layout. Returns every published id plus the
 * root post's permalink.
 */
export async function publishThreadChain(
  threadsUserId: string,
  token: string,
  segments: string[],
): Promise<{ ids: string[]; permalink?: string }> {
  const parts = segments.map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("Cannot publish an empty thread.");

  const ids: string[] = [];
  let permalink: string | undefined;
  let replyTo: string | undefined;

  for (const part of parts) {
    const res = await publishTextPost(threadsUserId, token, part, replyTo);
    ids.push(res.id);
    if (replyTo === undefined) permalink = res.permalink; // root permalink only
    replyTo = res.id;
  }

  return { ids, permalink };
}

function flattenInsights(res: ThreadsInsightsResponse, names: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of names) out[n] = 0;
  for (const m of res.data ?? []) {
    const v = m.total_value?.value ?? m.values?.[0]?.value ?? 0;
    out[m.name] = v;
  }
  return out;
}
