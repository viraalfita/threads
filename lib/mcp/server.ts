import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chat } from "../llm/gateway";
import { buildComposePrompt, buildIdeaTextPrompt, parseDrafts } from "../analysis/prompts";
import { THREADS_TEXT_LIMIT } from "../threads/api";
import {
  createSchedule,
  deleteSchedule,
  getStatistic,
  listReplizAccounts,
  listReplizContent,
  listSchedules,
} from "../repliz/client";
import { resolveReplizAccount } from "../repliz/accounts";
import { getLatestPerformance, getLearnings, saveLearning } from "../analytics/store";
import { isAccountUsable, loadActiveMap, setAccountActive } from "../repliz/settings";
import { analyzeAndSaveLearnings, runDailyCycle } from "../repliz/cycle";

// Buffer before a "publish now" goes live; Repliz is a scheduler, so immediate
// posts are scheduled a minute out and processed by Repliz's pipeline.
const PUBLISH_NOW_BUFFER_MS = 60 * 1000;

/**
 * Build an MCP server. The Threads backend is Repliz (api.repliz.com/public):
 * accounts, scheduling, publishing, and content all flow through it. `adminId`
 * is the authenticated MCP caller; Repliz access uses server-side Basic creds,
 * so adminId only gates access to the MCP itself.
 */
export function buildMcpServer(_adminId: string): McpServer {
  const server = new McpServer(
    { name: "threadlens", version: "0.3.0" },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        "ThreadLens connector — manages Threads accounts via Repliz, for an " +
        "autonomous weekly content loop.\n\n" +
        "Weekly cycle: get_learnings (read what worked) → account_summary " +
        "(review last week) → save_learnings (record insights) → generate_draft " +
        "(write, grounded in learnings) → schedule_post (queue for the week). " +
        "list_scheduled/delete_schedule manage the queue; publish_thread posts now; " +
        "generate_idea is a plain-text brainstorm that touches nothing.\n\n" +
        "Post performance is synced by a daily cron; account_summary " +
        "and get_post_stats read it. The `account` param selects a Threads account " +
        "by username; omit to use the default.",
    },
  );

  // -------------------- Tools --------------------

  server.registerTool(
    "list_accounts",
    {
      title: "List connected Threads accounts",
      description:
        "Return the Threads accounts connected in Repliz, each annotated with " +
        "`is_active` (only active accounts may be scheduled/published — toggle via " +
        "set_account_active). Use this first if the user references an account by " +
        "name. Set only_active=true to return just the accounts the autonomous loop " +
        "should operate on.",
      inputSchema: {
        only_active: z
          .boolean()
          .optional()
          .describe("Return only accounts marked active. Default false (show all)."),
      },
    },
    async ({ only_active }) => {
      const accounts = (await listReplizAccounts("threads")).filter((a) => a.isConnected);
      const activeMap = await loadActiveMap();
      let summary = accounts.map((a, i) => ({
        username: a.username,
        name: a.name,
        account_id: a.id,
        is_default: i === 0,
        // null map = gating not enabled yet (migration pending)
        is_active: activeMap === null ? null : activeMap.get(a.id) === true,
      }));
      if (only_active) summary = summary.filter((a) => a.is_active === true);
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.registerTool(
    "set_account_active",
    {
      title: "Activate / deactivate an account",
      description:
        "Mark a Threads account active or inactive for the autonomous engine. Only " +
        "active accounts can be scheduled/published and get stats synced. Use this to " +
        "opt specific accounts in (the rest stay untouched).",
      inputSchema: {
        account: z.string().describe("Threads username (without @)."),
        active: z.boolean().describe("true = enable for scheduling/publishing; false = disable."),
      },
    },
    async ({ account, active }) => {
      const acct = await resolveReplizAccount(account);
      try {
        await setAccountActive(acct.id, acct.username, active);
        return {
          content: [
            { type: "text", text: JSON.stringify({ ok: true, account: acct.username, is_active: active }) },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to set active (did you run the repliz_accounts migration?): ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  server.registerTool(
    "generate_draft",
    {
      title: "Generate Threads draft(s)",
      description:
        "Generate draft Threads content for the selected account, grounded in its " +
        "recent posts so voice matches. Default is multi-part thread mode. Returns " +
        "drafts as an array of arrays-of-parts; each part respects the 500-char limit. " +
        "Drafts are NOT published — call `schedule_post` or `publish_thread` after the " +
        "content is chosen.",
      inputSchema: {
        brief: z.string().min(1).max(1000).describe("Topic / brief, e.g. 'tanda PCOS'"),
        account: z
          .string()
          .optional()
          .describe("Threads username (without @). Omit to use the default account."),
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
          .describe("How many draft variants. Defaults: 2 for thread, 3 for single."),
      },
    },
    async ({ brief, account, thread = true, count }) => {
      const acct = await resolveReplizAccount(account);
      const effectiveCount = count ?? (thread ? 2 : 3);

      // Voice grounding: recent Repliz content text (no engagement metrics here).
      let topPosts: Array<{ text: string | null; views: number; engagementRate: number }> = [];
      try {
        const { items } = await listReplizContent(acct.id);
        topPosts = items
          .filter((c) => (c.description ?? "").trim().length > 0)
          .slice(0, 8)
          .map((c) => ({ text: c.description, views: 0, engagementRate: 0 }));
      } catch {
        // Grounding is best-effort; fall back to no examples.
      }

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
          content: [{ type: "text", text: "No drafts could be parsed from the model output." }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { account: acct.username, thread, model: llm.model, drafts },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "generate_idea",
    {
      title: "Brainstorm thread idea (plain text, no publish)",
      description:
        "Generate publish-quality Threads content as PLAIN TEXT — for reading/copying, " +
        "NOT for the publish pipeline. Output is human-readable text with 'Part 1:' " +
        "markers (no XML). Does NOT touch any account, does NOT schedule/publish, does " +
        "NOT persist, and ignores account voice grounding. Use when the user wants to " +
        "*read* an idea. Use `generate_draft` then `schedule_post`/`publish_thread` to act.",
      inputSchema: {
        brief: z.string().min(1).max(1000).describe("Topic / brief, e.g. 'keputihan'."),
        thread: z
          .boolean()
          .optional()
          .default(true)
          .describe("True = multi-part thread chain (default). False = single post."),
        count: z.number().int().min(1).max(5).optional().describe("How many idea variants. Default 1."),
      },
    },
    async ({ brief, thread = true, count }) => {
      const effectiveCount = count ?? 1;
      const prompt = buildIdeaTextPrompt({
        brief: brief.trim(),
        count: effectiveCount,
        thread,
        charLimit: THREADS_TEXT_LIMIT,
      });
      const llm = await chat({
        messages: [
          {
            role: "system",
            content:
              "Kamu kreator Threads yang nulis santai dan natural, kayak ngobrol sama temen. Output plain text aja, JANGAN pakai tag XML.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: thread ? 1600 : 1000,
      });
      return { content: [{ type: "text", text: llm.text }] };
    },
  );

  // Shared validation + critic gate for anything that puts content on Threads.
  async function prepareForPublish(
    segments: string[],
    accountUsername: string | undefined,
  ): Promise<
    | { ok: true; acct: Awaited<ReturnType<typeof resolveReplizAccount>>; cleaned: string[] }
    | { ok: false; error: string }
  > {
    const acct = await resolveReplizAccount(accountUsername);

    // Opt-in gate: only accounts explicitly marked active can be posted to.
    if (!(await isAccountUsable(acct.id))) {
      return {
        ok: false,
        error: `Account "${acct.username}" is not active. Enable it with set_account_active before scheduling/publishing.`,
      };
    }

    const cleaned = segments.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) return { ok: false, error: "All segments were empty after trimming." };
    const tooLong = cleaned.find((s) => s.length > THREADS_TEXT_LIMIT);
    if (tooLong) {
      return { ok: false, error: `Segment exceeds ${THREADS_TEXT_LIMIT} chars (got ${tooLong.length}).` };
    }
    return { ok: true, acct, cleaned };
  }

  server.registerTool(
    "schedule_post",
    {
      title: "Schedule a Threads post/thread for later",
      description:
        "Schedule a post or multi-part thread to publish at a future time via Repliz. " +
        "Each segment must be ≤ 500 chars. `scheduleAt` must be a future ISO-8601 timestamp. " +
        "Account must be marked active (set_account_active).",
      inputSchema: {
        segments: z
          .array(z.string().min(1).max(THREADS_TEXT_LIMIT))
          .min(1)
          .max(20)
          .describe("Ordered thread parts. One element = single post; multiple = chain."),
        scheduleAt: z
          .string()
          .describe("Future ISO-8601 timestamp, e.g. '2026-06-02T11:00:00.000Z'."),
        account: z.string().optional().describe("Threads username (without @). Omit for default."),
        topic: z.string().optional().describe("Optional topic label stored on the post."),
      },
    },
    async ({ segments, scheduleAt, account, topic }) => {
      const when = Date.parse(scheduleAt);
      if (Number.isNaN(when)) {
        return { isError: true, content: [{ type: "text", text: `Invalid scheduleAt: ${scheduleAt}` }] };
      }
      if (when <= Date.now()) {
        return {
          isError: true,
          content: [{ type: "text", text: "scheduleAt must be in the future. Use publish_thread to post now." }],
        };
      }

      const prep = await prepareForPublish(segments, account);
      if (!prep.ok) return { isError: true, content: [{ type: "text", text: prep.error }] };

      try {
        const { scheduleId } = await createSchedule({
          accountId: prep.acct.id,
          description: prep.cleaned[0],
          replies: prep.cleaned.slice(1),
          topic,
          scheduleAt: new Date(when).toISOString(),
          isAiGenerated: true,
          isDraft: false,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { ok: true, scheduleId, account: prep.acct.username, scheduleAt: new Date(when).toISOString(), parts: prep.cleaned.length },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: `Schedule failed: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  server.registerTool(
    "publish_thread",
    {
      title: "Publish to Threads now",
      description:
        "Publish a post or multi-part thread immediately (scheduled ~1 minute out via " +
        "Repliz). Each segment must be ≤ 500 chars. Account must be marked active.",
      inputSchema: {
        segments: z
          .array(z.string().min(1).max(THREADS_TEXT_LIMIT))
          .min(1)
          .max(20)
          .describe("Ordered thread parts. One element = single post; multiple = chain."),
        account: z.string().optional().describe("Threads username (without @). Omit for default."),
        topic: z.string().optional().describe("Optional topic label stored on the post."),
      },
    },
    async ({ segments, account, topic }) => {
      const prep = await prepareForPublish(segments, account);
      if (!prep.ok) return { isError: true, content: [{ type: "text", text: prep.error }] };

      const scheduleAt = new Date(Date.now() + PUBLISH_NOW_BUFFER_MS).toISOString();
      try {
        const { scheduleId } = await createSchedule({
          accountId: prep.acct.id,
          description: prep.cleaned[0],
          replies: prep.cleaned.slice(1),
          topic,
          scheduleAt,
          isAiGenerated: true,
          isDraft: false,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { ok: true, scheduleId, account: prep.acct.username, willPublishAt: scheduleAt, parts: prep.cleaned.length, note: "Repliz processes the post within ~1-2 minutes." },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: `Publish failed: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  server.registerTool(
    "list_scheduled",
    {
      title: "List scheduled/queued posts",
      description:
        "List scheduled posts for an account (or all). Useful to review the queue " +
        "before/after auto-scheduling, or to find a scheduleId to delete.",
      inputSchema: {
        account: z.string().optional().describe("Threads username (without @). Omit for all accounts."),
        status: z
          .string()
          .optional()
          .describe("Filter by status, e.g. 'pending', 'published', 'failed'."),
      },
    },
    async ({ account, status }) => {
      const accountId = account ? (await resolveReplizAccount(account)).id : undefined;
      const items = await listSchedules({ accountId, status });
      const summary = items.map((s) => ({
        scheduleId: s.id,
        status: s.status,
        scheduleAt: s.scheduleAt,
        topic: s.topic,
        preview: (s.description ?? "").slice(0, 120),
        parts: 1 + (s.replies?.length ?? 0),
      }));
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    },
  );

  server.registerTool(
    "delete_schedule",
    {
      title: "Delete a scheduled post",
      description:
        "Remove a scheduled post from the Repliz queue by its scheduleId (get it from " +
        "`list_scheduled`). Use to cancel auto-scheduled content that isn't suitable.",
      inputSchema: {
        scheduleId: z.string().min(1).describe("The Repliz scheduleId to delete."),
      },
    },
    async ({ scheduleId }) => {
      try {
        await deleteSchedule(scheduleId);
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, deleted: scheduleId }) }] };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: `Delete failed: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  // -------------------- Analytics + Learning --------------------

  server.registerTool(
    "account_summary",
    {
      title: "Account performance summary",
      description:
        "Read synced post performance for an account (latest snapshot per post, " +
        "sorted by engagement rate). Data is filled by the daily stats cron, so " +
        "this is a cheap read — use it to see what's working before generating. " +
        "Returns top + bottom performers and totals over the lookback window.",
      inputSchema: {
        account: z.string().optional().describe("Threads username (without @). Omit for default."),
        period_days: z.number().int().min(1).max(365).optional().describe("Lookback window. Default 30."),
      },
    },
    async ({ account, period_days }) => {
      const acct = await resolveReplizAccount(account);
      const rows = await getLatestPerformance(acct.id, period_days ?? 30);
      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { account: acct.username, note: "No synced performance yet (cron may not have run, or no published posts).", posts: [] },
                null,
                2,
              ),
            },
          ],
        };
      }
      const totals = rows.reduce(
        (acc, r) => ({
          views: acc.views + r.views,
          likes: acc.likes + r.likes,
          replies: acc.replies + r.replies,
        }),
        { views: 0, likes: 0, replies: 0 },
      );
      const payload = {
        account: acct.username,
        period_days: period_days ?? 30,
        post_count: rows.length,
        totals,
        top: rows.slice(0, 5),
        bottom: rows.slice(-3).reverse(),
      };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    },
  );

  server.registerTool(
    "get_post_stats",
    {
      title: "Get stats for one post",
      description:
        "Fetch live engagement stats for a single published post by its postId " +
        "(get postId from list_scheduled on succeeded items). Hits Repliz directly " +
        "for freshness. For a whole-account overview, use account_summary instead.",
      inputSchema: {
        post_id: z.string().min(1).describe("The published post id (schedule.postId)."),
        account: z.string().optional().describe("Threads username (without @). Omit for default."),
      },
    },
    async ({ post_id, account }) => {
      const acct = await resolveReplizAccount(account);
      try {
        const stat = await getStatistic(post_id, acct.id);
        const er = stat.views > 0
          ? (stat.likes + stat.replies + stat.reposts + stat.quotes + stat.shares) / stat.views
          : 0;
        return {
          content: [
            { type: "text", text: JSON.stringify({ account: acct.username, post_id, ...stat, engagement_rate: Number(er.toFixed(4)) }, null, 2) },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: `Stats unavailable: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );

  server.registerTool(
    "get_learnings",
    {
      title: "Read accumulated learnings",
      description:
        "Read the most recent learning entries for an account — the loop's memory " +
        "of what worked. Call this BEFORE generating a new batch so drafts build on " +
        "past performance.",
      inputSchema: {
        account: z.string().optional().describe("Threads username (without @). Omit for default."),
        limit: z.number().int().min(1).max(20).optional().describe("How many recent entries. Default 8."),
      },
    },
    async ({ account, limit }) => {
      const acct = await resolveReplizAccount(account);
      const learnings = await getLearnings(acct.id, limit ?? 8);
      return {
        content: [{ type: "text", text: JSON.stringify({ account: acct.username, learnings }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "save_learnings",
    {
      title: "Save a learning entry",
      description:
        "Persist insights after analyzing a week's performance — what topics/hooks/" +
        "formats worked or didn't. Stored as the loop's memory; read back via " +
        "get_learnings next cycle. `patterns` is free-form JSON (e.g. " +
        "{best_hook:'story', best_time:'19:00', avoid:['listicle']}).",
      inputSchema: {
        summary: z.string().min(1).max(4000).describe("Plain-language summary of what was learned this cycle."),
        week: z.string().describe("ISO date for the cycle, e.g. '2026-05-25'."),
        account: z.string().optional().describe("Threads username (without @). Omit for default."),
        patterns: z.record(z.string(), z.any()).optional().describe("Structured patterns as JSON (optional)."),
      },
    },
    async ({ summary, week, account, patterns }) => {
      const acct = await resolveReplizAccount(account);
      const day = week.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return { isError: true, content: [{ type: "text", text: `Invalid week date: ${week}` }] };
      }
      await saveLearning({
        accountId: acct.id,
        username: acct.username,
        week: day,
        summary,
        patterns: patterns ?? {},
      });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, account: acct.username, week: day }) }] };
    },
  );

  // -------------------- All-in-one orchestrators --------------------

  server.registerTool(
    "run_daily_cycle",
    {
      title: "Run the whole daily content cycle",
      description:
        "One-shot daily orchestrator: figures out empty slots for today (skips " +
        "past + already-filled), generates N drafts in a SINGLE LLM call (count = " +
        "empty slots), then schedules each via Repliz. The agent doesn't need to " +
        "reason — just call this once per active account per day. Uses the account's " +
        "configured niche + recent learnings (recent_topics) as grounding.",
      inputSchema: {
        account: z
          .string()
          .optional()
          .describe("Threads username (without @). Omit for default."),
        count: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Target number of posts for today. Default 3."),
        slots_wib: z
          .array(z.string().regex(/^\d{2}:\d{2}$/))
          .optional()
          .describe(
            "Slot times in WIB as 'HH:MM'. Default ['09:00','13:00','17:00']. " +
              "First N slots are used (N = count).",
          ),
        brief: z
          .string()
          .optional()
          .describe(
            "Optional override for the generation brief. If omitted, a niche-aware " +
              "default is built from the account's niche + recent learnings.",
          ),
      },
    },
    async ({ account, count, slots_wib, brief }) => {
      const result = await runDailyCycle({
        accountUsername: account,
        count,
        slotsWib: slots_wib,
        brief,
      });
      return {
        isError: result.status === "account_not_active" || result.status === "generate_failed",
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "analyze_and_save_learnings",
    {
      title: "Run the weekly learning analysis",
      description:
        "One-shot weekly orchestrator: fetches the account's last 7 days of " +
        "performance + previous learnings, runs LLM analysis SERVER-SIDE to derive " +
        "patterns (best_hooks, best_formats, best_times_wib, avoid, recent_topics), " +
        "and persists to repliz_learnings. The agent doesn't need to reason — just " +
        "call this once per active account per week.",
      inputSchema: {
        account: z
          .string()
          .optional()
          .describe("Threads username (without @). Omit for default."),
        week: z
          .string()
          .optional()
          .describe("ISO date YYYY-MM-DD for the week. Defaults to today (WIB)."),
        period_days: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe("Performance window in days. Default 7."),
      },
    },
    async ({ account, week, period_days }) => {
      const result = await analyzeAndSaveLearnings({
        accountUsername: account,
        week,
        periodDays: period_days,
      });
      return {
        isError: result.status !== "ok",
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // -------------------- Resources --------------------

  const recentTemplate = new ResourceTemplate("threadlens://{username}/content/recent", {
    list: async () => {
      const accounts = (await listReplizAccounts("threads")).filter((a) => a.isConnected);
      return {
        resources: accounts.map((a) => ({
          uri: `threadlens://${a.username}/content/recent`,
          name: `Recent content — @${a.username}`,
          mimeType: "application/json",
        })),
      };
    },
  });

  server.registerResource(
    "recent_content",
    recentTemplate,
    {
      title: "Recent content",
      description: "Most recent posts of an account from Repliz (text + link, no metrics).",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const acct = await resolveReplizAccount(String(variables.username));
      const { items } = await listReplizContent(acct.id);
      const rows = items.slice(0, 20).map((c) => ({
        id: c.id,
        text: c.description,
        url: c.url,
        type: c.type,
        created_at: c.createdAt,
      }));
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify({ account: acct.username, content: rows }, null, 2),
          },
        ],
      };
    },
  );

  return server;
}
