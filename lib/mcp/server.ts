import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/server";
import { chat } from "../llm/gateway";
import { buildComposePrompt, parseDrafts } from "../analysis/prompts";
import { publishThreadChain, THREADS_TEXT_LIMIT } from "../threads/api";
import { listAccountsForAdmin, resolveAccount, resolveAccountWithToken } from "./accounts";

/**
 * Build an MCP server scoped to one authenticated admin. Tools and resources
 * are bound at construction so handlers never need to re-authenticate.
 */
export function buildMcpServer(adminId: string): McpServer {
  const server = new McpServer(
    { name: "threadlens", version: "0.1.0" },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        "ThreadLens connector for managing the user's Threads accounts. " +
        "Use `list_accounts` first to learn which accounts are connected, then " +
        "`generate_draft` to draft content (grounded in the account's top posts) " +
        "and `publish_thread` to publish. The `account` parameter selects which " +
        "Threads account to act on by username; omit it to use the default.",
    },
  );

  // -------------------- Tools --------------------

  server.registerTool(
    "list_accounts",
    {
      title: "List connected Threads accounts",
      description:
        "Return the Threads accounts connected to ThreadLens. Use this first " +
        "if the user references an account by name, to confirm the username is " +
        "valid. The first account in the list is the default if `account` is omitted.",
      inputSchema: {},
    },
    async () => {
      const accounts = await listAccountsForAdmin(adminId);
      const summary = accounts.map((a, i) => ({
        username: a.username,
        name: a.name,
        threads_user_id: a.threads_user_id,
        scopes: a.scopes ?? [],
        is_default: i === 0,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  server.registerTool(
    "generate_draft",
    {
      title: "Generate Threads draft(s)",
      description:
        "Generate draft Threads content for the selected account, grounded in " +
        "its top-performing past posts so voice matches. Default is multi-part " +
        "thread mode. Returns drafts as an array of arrays-of-parts; each part " +
        "respects the 500-char Threads limit. Drafts are NOT published — the " +
        "user must approve and call `publish_thread` separately.",
      inputSchema: {
        brief: z
          .string()
          .min(1)
          .max(1000)
          .describe("Topic / brief for the post, e.g. 'bahaya pcos'"),
        account: z
          .string()
          .optional()
          .describe(
            "Threads username (without @) of the account to draft for. " +
              "Omit to use the default account.",
          ),
        thread: z
          .boolean()
          .optional()
          .default(true)
          .describe("True = multi-part thread chain (default). False = single 500-char post."),
        count: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("How many draft variants to produce. Defaults: 2 for thread, 3 for single."),
      },
    },
    async ({ brief, account, thread = true, count }) => {
      const user = await resolveAccount(adminId, account);
      const effectiveCount = count ?? (thread ? 2 : 3);

      const db = supabaseAdmin();
      const { data: posts } = await db
        .from("posts")
        .select("text, post_insights ( views, engagement_rate )")
        .eq("user_id", user.id);

      const topPosts = (posts ?? [])
        .map((p: any) => ({
          text: p.text as string | null,
          views: Number(p.post_insights?.views ?? 0),
          engagementRate: Number(p.post_insights?.engagement_rate ?? 0),
        }))
        .filter((p) => p.views > 0)
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 8);

      const prompt = buildComposePrompt({
        brief: brief.trim(),
        count: effectiveCount,
        thread,
        charLimit: THREADS_TEXT_LIMIT,
        topPosts,
      });

      const llm = await chat({
        messages: [
          {
            role: "system",
            content:
              "Kamu kreator Threads yang nulis santai dan natural, kayak ngobrol sama temen — bukan copywriter korporat. Tiru voice si creator dari contoh, dan ikuti aturan format dengan ketat.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: thread ? 1600 : 1200,
      });

      const drafts = parseDrafts(llm.text).map((parts) =>
        parts.map((p) => p.slice(0, THREADS_TEXT_LIMIT)),
      );

      if (drafts.length === 0) {
        return {
          isError: true,
          content: [
            { type: "text", text: "No drafts could be parsed from the model output." },
          ],
        };
      }

      // Persist for the analysis history, same as the web compose flow.
      await db.from("llm_analysis").insert({
        user_id: user.id,
        type: "ideas",
        input_context: {
          brief,
          count: effectiveCount,
          thread,
          groundedOn: topPosts.length,
          source: "mcp",
        },
        output: llm.text,
        model_used: llm.model,
        prompt_tokens: llm.usage.prompt_tokens,
        completion_tokens: llm.usage.completion_tokens,
      });

      const payload = {
        account: user.username,
        thread,
        model: llm.model,
        drafts,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    },
  );

  server.registerTool(
    "publish_thread",
    {
      title: "Publish to Threads",
      description:
        "Publish a post or multi-part thread chain to Threads on behalf of the " +
        "selected account. Each segment must be ≤ 500 characters. This is a " +
        "side-effecting action — the user should have approved the exact " +
        "content before this is called.",
      inputSchema: {
        segments: z
          .array(z.string().min(1).max(THREADS_TEXT_LIMIT))
          .min(1)
          .max(20)
          .describe(
            "Ordered parts of the thread. One element = single post; multiple = chain.",
          ),
        account: z
          .string()
          .optional()
          .describe(
            "Threads username (without @) to publish from. Omit to use default.",
          ),
      },
    },
    async ({ segments, account }) => {
      const { user, token } = await resolveAccountWithToken(adminId, account);

      if (!user.scopes?.includes("threads_content_publish")) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Account "${user.username}" is missing the threads_content_publish scope. Reconnect at /settings.`,
            },
          ],
        };
      }

      const cleaned = segments.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        return {
          isError: true,
          content: [{ type: "text", text: "All segments were empty after trimming." }],
        };
      }
      const tooLong = cleaned.find((s) => s.length > THREADS_TEXT_LIMIT);
      if (tooLong) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Segment exceeds ${THREADS_TEXT_LIMIT} chars (got ${tooLong.length}).`,
            },
          ],
        };
      }

      try {
        const result = await publishThreadChain(user.threads_user_id, token, cleaned);
        const payload = {
          ok: true,
          account: user.username,
          ids: result.ids,
          total: result.total,
          permalink: result.permalink,
          partial: result.failedAt !== undefined,
          failedAt: result.failedAt,
          partialError: result.error,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Publish failed: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
        };
      }
    },
  );

  // -------------------- Resources --------------------

  // Inspect resources are URI-templated by account username so each account's
  // data lives at a stable, addressable URI.
  const topTemplate = new ResourceTemplate("threadlens://{username}/posts/top", {
    list: async () => {
      const accounts = await listAccountsForAdmin(adminId);
      return {
        resources: accounts.map((a) => ({
          uri: `threadlens://${a.username ?? a.threads_user_id}/posts/top`,
          name: `Top posts — @${a.username ?? a.threads_user_id}`,
          mimeType: "application/json",
        })),
      };
    },
  });

  server.registerResource(
    "top_posts",
    topTemplate,
    {
      title: "Top posts (by engagement rate)",
      description:
        "Top 10 posts of an account, ordered by engagement rate descending. " +
        "Read-only — use for inspection or discussion, not to feed `generate_draft` " +
        "(that tool already pulls top posts internally).",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const username = String(variables.username);
      const user = await resolveAccount(adminId, username);
      const db = supabaseAdmin();
      const { data, error } = await db
        .from("posts")
        .select(
          "threads_post_id, text, permalink, published_at, post_insights ( views, likes, replies, reposts, quotes, shares, engagement_rate )",
        )
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);

      const rows = (data ?? [])
        .map((p: any) => ({
          id: p.threads_post_id as string,
          text: p.text as string | null,
          permalink: p.permalink as string | null,
          published_at: p.published_at as string,
          views: Number(p.post_insights?.views ?? 0),
          likes: Number(p.post_insights?.likes ?? 0),
          replies: Number(p.post_insights?.replies ?? 0),
          reposts: Number(p.post_insights?.reposts ?? 0),
          quotes: Number(p.post_insights?.quotes ?? 0),
          shares: Number(p.post_insights?.shares ?? 0),
          engagement_rate: Number(p.post_insights?.engagement_rate ?? 0),
        }))
        .filter((p) => p.views > 0)
        .sort((a, b) => b.engagement_rate - a.engagement_rate)
        .slice(0, 10);

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify({ account: user.username, posts: rows }, null, 2),
          },
        ],
      };
    },
  );

  const recentTemplate = new ResourceTemplate("threadlens://{username}/posts/recent", {
    list: async () => {
      const accounts = await listAccountsForAdmin(adminId);
      return {
        resources: accounts.map((a) => ({
          uri: `threadlens://${a.username ?? a.threads_user_id}/posts/recent`,
          name: `Recent posts — @${a.username ?? a.threads_user_id}`,
          mimeType: "application/json",
        })),
      };
    },
  });

  server.registerResource(
    "recent_posts",
    recentTemplate,
    {
      title: "Recent posts",
      description: "20 most-recently-published posts of an account with basic metrics.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const username = String(variables.username);
      const user = await resolveAccount(adminId, username);
      const db = supabaseAdmin();
      const { data, error } = await db
        .from("posts")
        .select(
          "threads_post_id, text, permalink, published_at, post_insights ( views, likes, replies, engagement_rate )",
        )
        .eq("user_id", user.id)
        .order("published_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);

      const rows = (data ?? []).map((p: any) => ({
        id: p.threads_post_id as string,
        text: p.text as string | null,
        permalink: p.permalink as string | null,
        published_at: p.published_at as string,
        views: Number(p.post_insights?.views ?? 0),
        likes: Number(p.post_insights?.likes ?? 0),
        replies: Number(p.post_insights?.replies ?? 0),
        engagement_rate: Number(p.post_insights?.engagement_rate ?? 0),
      }));

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify({ account: user.username, posts: rows }, null, 2),
          },
        ],
      };
    },
  );

  return server;
}
