import { chat } from "../llm/gateway";
import {
  buildComposePrompt,
  buildWeeklyAnalysisPrompt,
  parseDrafts,
} from "../analysis/prompts";
import { THREADS_TEXT_LIMIT } from "../threads/api";
import { createSchedule, listSchedules } from "./client";
import { resolveReplizAccount } from "./accounts";
import { getAccountPersona } from "../mcp/personas";
import { getAccountSetting, isAccountUsable } from "./settings";
import {
  getLatestPerformance,
  getLearnings,
  saveLearning,
  type LearningRow,
} from "../analytics/store";

const DEFAULT_SLOTS_WIB = ["09:00", "13:00", "17:00"];

export interface DailyCycleResult {
  account: string;
  status: "ok" | "no_slots_available" | "generate_failed" | "account_not_active";
  posted: Array<{ scheduleId: string; slot_wib: string; scheduleAt_utc: string; preview: string }>;
  skipped: Array<{ slot_wib: string; reason: string }>;
  total_slots_targeted: number;
}

/**
 * One-shot daily cycle: figure out empty slots for today, generate drafts in
 * a single LLM call (count = empty slots), then schedule each. Designed to be
 * called from a thin agent prompt — the agent doesn't reason, this does.
 */
export async function runDailyCycle(input: {
  accountUsername?: string | null;
  count?: number;
  slotsWib?: string[];
  brief?: string;
}): Promise<DailyCycleResult> {
  const acct = await resolveReplizAccount(input.accountUsername);
  const setting = await getAccountSetting(acct.id);

  if (!(await isAccountUsable(acct.id))) {
    return {
      account: acct.username,
      status: "account_not_active",
      posted: [],
      skipped: [],
      total_slots_targeted: 0,
    };
  }

  const targetSlots = (input.slotsWib ?? DEFAULT_SLOTS_WIB).slice(0, input.count ?? 3);

  // Convert each WIB slot to an absolute UTC ISO for today (in WIB date).
  const now = Date.now();
  const slotUtcMap = new Map<string, string>(); // wib → utc iso
  for (const slot of targetSlots) {
    slotUtcMap.set(slot, wibSlotToUtcIso(now, slot));
  }

  // Drop slots already in the past.
  const future: Array<{ wib: string; utc: string }> = [];
  for (const [wib, utc] of slotUtcMap.entries()) {
    if (Date.parse(utc) > now) future.push({ wib, utc });
  }

  // Drop slots already filled (existing pending schedule at same UTC minute).
  let pending: Awaited<ReturnType<typeof listSchedules>> = [];
  try {
    pending = await listSchedules({ accountId: acct.id, status: "pending" });
  } catch {
    // tolerate; treat as no pending
  }
  const filledUtcMinutes = new Set(
    pending.map((s) => Math.floor(Date.parse(s.scheduleAt) / 60000)),
  );

  const empty = future.filter(
    (s) => !filledUtcMinutes.has(Math.floor(Date.parse(s.utc) / 60000)),
  );

  const skipped: DailyCycleResult["skipped"] = [];
  for (const wib of targetSlots) {
    if (!slotUtcMap.has(wib)) continue;
    if (!empty.find((e) => e.wib === wib)) {
      const inPast = !future.find((f) => f.wib === wib);
      skipped.push({ slot_wib: wib, reason: inPast ? "in_past" : "already_filled" });
    }
  }

  if (empty.length === 0) {
    return {
      account: acct.username,
      status: "no_slots_available",
      posted: [],
      skipped,
      total_slots_targeted: targetSlots.length,
    };
  }

  // Build brief: explicit override > niche+learnings-aware default.
  const learnings = await getLearnings(acct.id, 5).catch(() => [] as LearningRow[]);
  const learningContext = collectLearningContext(learnings);
  const niche = setting?.niche ?? null;
  const persona = getAccountPersona(acct.username);
  const brief = (input.brief?.trim() ?? "").length > 0
    ? input.brief!
    : defaultBrief({ niche, count: empty.length, context: learningContext, hasPersona: !!persona });

  const prompt = buildComposePrompt({
    brief,
    count: empty.length,
    thread: true,
    charLimit: THREADS_TEXT_LIMIT,
    topPosts: [], // grounding via learnings is in the brief itself
    persona: persona ?? undefined,
  });

  let drafts: string[][];
  try {
    const llm = await chat({
      messages: [
        {
          role: "system",
          content:
            "Kamu kreator Threads yang nulis santai dan natural, kayak ngobrol sama temen. Ikuti format draft dengan ketat.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 1800,
    });
    drafts = parseDrafts(llm.text).map((parts) => parts.map((p) => p.slice(0, THREADS_TEXT_LIMIT)));
  } catch (e) {
    return {
      account: acct.username,
      status: "generate_failed",
      posted: [],
      skipped: [
        ...skipped,
        ...empty.map((s) => ({
          slot_wib: s.wib,
          reason: `generate_failed: ${e instanceof Error ? e.message : String(e)}`,
        })),
      ],
      total_slots_targeted: targetSlots.length,
    };
  }

  if (drafts.length === 0) {
    return {
      account: acct.username,
      status: "generate_failed",
      posted: [],
      skipped: [
        ...skipped,
        ...empty.map((s) => ({ slot_wib: s.wib, reason: "no_drafts_parsed" })),
      ],
      total_slots_targeted: targetSlots.length,
    };
  }

  const posted: DailyCycleResult["posted"] = [];
  for (let i = 0; i < empty.length; i++) {
    const slot = empty[i];
    const draft = drafts[i];
    if (!draft || draft.length === 0) {
      skipped.push({ slot_wib: slot.wib, reason: "no_draft_for_slot" });
      continue;
    }
    try {
      const { scheduleId } = await createSchedule({
        accountId: acct.id,
        description: draft[0],
        replies: draft.slice(1),
        topic: deriveTopic(draft[0]),
        scheduleAt: slot.utc,
        isAiGenerated: true,
        isDraft: false,
      });
      posted.push({
        scheduleId,
        slot_wib: slot.wib,
        scheduleAt_utc: slot.utc,
        preview: draft[0].slice(0, 120),
      });
    } catch (e) {
      skipped.push({
        slot_wib: slot.wib,
        reason: `schedule_failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return {
    account: acct.username,
    status: "ok",
    posted,
    skipped,
    total_slots_targeted: targetSlots.length,
  };
}

export interface WeeklyLearningResult {
  account: string;
  week: string;
  saved: boolean;
  summary: string;
  patterns: Record<string, unknown>;
  data_points: number;
  status: "ok" | "save_failed" | "analysis_failed";
  error?: string;
}

/**
 * Weekly analysis: fetch perf + previous learnings, ask LLM to derive structured
 * patterns, persist via saveLearning. Server-side reasoning — agent just triggers.
 */
export async function analyzeAndSaveLearnings(input: {
  accountUsername?: string | null;
  week?: string;
  periodDays?: number;
}): Promise<WeeklyLearningResult> {
  const acct = await resolveReplizAccount(input.accountUsername);
  const setting = await getAccountSetting(acct.id);
  const periodDays = input.periodDays ?? 7;
  const week = (input.week ?? todayWibDate()).slice(0, 10);

  const [performance, previousLearnings] = await Promise.all([
    getLatestPerformance(acct.id, periodDays).catch(() => []),
    getLearnings(acct.id, 5).catch(() => [] as LearningRow[]),
  ]);

  const prompt = buildWeeklyAnalysisPrompt({
    accountUsername: acct.username,
    niche: setting?.niche ?? null,
    periodDays,
    posts: performance.map((p) => ({
      topic: p.topic,
      views: p.views,
      likes: p.likes,
      engagement_rate: p.engagement_rate,
      snapshot_at: p.snapshot_at,
    })),
    previousLearnings: previousLearnings.map((l) => ({ week: l.week, summary: l.summary })),
  });

  let summary = "";
  let patterns: Record<string, unknown> = {};

  try {
    const llm = await chat({
      messages: [
        {
          role: "system",
          content:
            "Kamu analis konten. Output JSON valid ketat — tanpa teks/markdown/backtick di luar JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 1000,
    });
    const parsed = extractJson(llm.text);
    summary = typeof parsed.summary === "string" ? parsed.summary : "";
    patterns = (parsed.patterns && typeof parsed.patterns === "object")
      ? (parsed.patterns as Record<string, unknown>)
      : {};
  } catch (e) {
    return {
      account: acct.username,
      week,
      saved: false,
      summary: "",
      patterns: {},
      data_points: performance.length,
      status: "analysis_failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  if (!summary) {
    summary = performance.length === 0
      ? "Baseline minggu pertama, belum cukup data."
      : "Belum ada insight kuat — sample masih kecil.";
  }

  try {
    await saveLearning({
      accountId: acct.id,
      username: acct.username,
      week,
      summary,
      patterns,
    });
  } catch (e) {
    return {
      account: acct.username,
      week,
      saved: false,
      summary,
      patterns,
      data_points: performance.length,
      status: "save_failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return {
    account: acct.username,
    week,
    saved: true,
    summary,
    patterns,
    data_points: performance.length,
    status: "ok",
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────

/** WIB slot ("HH:MM") for today's WIB date → UTC ISO. */
function wibSlotToUtcIso(nowMs: number, slot: string): string {
  // Today's date in WIB (UTC+7).
  const wib = new Date(nowMs + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wib.getUTCDate()).padStart(2, "0");
  // Construct with explicit +07:00 offset; Date parser will convert to UTC.
  const iso = `${y}-${m}-${d}T${slot}:00+07:00`;
  return new Date(iso).toISOString();
}

function todayWibDate(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wib.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function deriveTopic(text: string): string {
  // First 60 chars of first sentence, stripped — good enough as a label for
  // attribution + recent-topic dedup. Agent can override via param later.
  const firstLine = text.split(/[.\n]/)[0] ?? text;
  return firstLine.replace(/\s+/g, " ").trim().slice(0, 60);
}

interface LearningContext {
  latestSummary: string;
  bestHooks: string[];
  bestFormats: string[];
  bestTimesWib: string[];
  avoid: string[];
  recentTopics: string[];
}

function collectLearningContext(learnings: LearningRow[]): LearningContext {
  const dedupe = (arr: string[]) => [...new Set(arr.filter(Boolean))];
  const collectField = (field: string): string[] => {
    const all: string[] = [];
    for (const l of learnings) {
      const arr = (l.patterns as any)?.[field];
      if (Array.isArray(arr)) for (const t of arr) if (typeof t === "string") all.push(t);
    }
    return dedupe(all);
  };
  return {
    latestSummary: learnings[0]?.summary ?? "",
    bestHooks: collectField("best_hooks").slice(0, 10),
    bestFormats: collectField("best_formats").slice(0, 10),
    bestTimesWib: collectField("best_times_wib").slice(0, 10),
    avoid: collectField("avoid").slice(0, 15),
    recentTopics: collectField("recent_topics").slice(0, 20),
  };
}

function defaultBrief(opts: {
  niche: string | null;
  count: number;
  context: LearningContext;
  /** When the account has a voice persona, it owns claim/closing rules — skip the generic medical guard. */
  hasPersona?: boolean;
}): string {
  const { latestSummary, bestHooks, bestFormats, bestTimesWib, avoid, recentTopics } = opts.context;
  const nicheLine = opts.niche
    ? `Niche akun: ${opts.niche}.`
    : "Niche bebas, fokus storyteller berkualitas.";

  const lines: string[] = [
    `${opts.count} thread storyteller untuk akun ini.`,
    nicheLine,
  ];

  // Inject blok konteks hanya kalau ada minimal 1 sinyal (cold start tetep clean).
  const hasContext =
    !!latestSummary ||
    bestHooks.length > 0 ||
    bestFormats.length > 0 ||
    bestTimesWib.length > 0 ||
    avoid.length > 0 ||
    recentTopics.length > 0;

  if (hasContext) {
    lines.push("KONTEKS DARI PERFORMA SEBELUMNYA — pakai sebagai panduan, jangan diabaikan:");
    if (latestSummary) lines.push(`Insight terbaru: "${latestSummary}".`);
    if (bestHooks.length) lines.push(`Hook yang KONSISTEN MENANG (utamakan pola ini): ${bestHooks.join("; ")}.`);
    if (bestFormats.length) lines.push(`Format yang work: ${bestFormats.join("; ")}.`);
    if (avoid.length) lines.push(`HINDARI (terbukti gak work): ${avoid.join("; ")}.`);
    if (recentTopics.length) lines.push(`HINDARI topik yang BARU DIPAKAI (jangan diulang): ${recentTopics.join(", ")}.`);
  }

  lines.push(
    "Tiap thread beda angle (cerita pribadi, mitos vs fakta, fakta surprising, momen relate, Q&A reflektif, dll). Tone santai kayak ngobrol temen, vulnerable, relate. HINDARI listicle kaku & bahasa motivator.",
  );
  // Persona-driven accounts define their own claim/closing rules (incl. health
  // framing); the generic medical guard would fight them, so only add it otherwise.
  if (!opts.hasPersona) {
    lines.push(
      "Untuk niche medis/kesehatan: framing edukasi, sisipkan disclaimer halus \"kalau ragu konsul ke dokter\". JANGAN klaim sembuh, JANGAN diagnosis, JANGAN nyuruh skip dokter.",
    );
  }

  return lines.join("\n");
}

function extractJson(raw: string): { summary?: unknown; patterns?: unknown } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in analysis output");
  return JSON.parse(match[0]);
}
