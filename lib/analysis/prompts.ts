export interface PerformanceContext {
  avgViews: number;
  avgEngagementRate: number; // 0..1
  dominantTopics?: string;
  post: {
    text: string | null;
    publishedAt: string;
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    shares: number;
    engagementRate: number;
  };
}

export function buildPerformancePrompt(ctx: PerformanceContext): string {
  const pctVsAvg = ctx.avgViews > 0 ? ((ctx.post.views / ctx.avgViews) * 100 - 100).toFixed(1) : "0";
  return `Kamu adalah content strategist yang menganalisa performa post Threads.

KONTEKS AKUN (30 hari):
- Rata-rata views per post: ${ctx.avgViews}
- Rata-rata engagement rate: ${(ctx.avgEngagementRate * 100).toFixed(2)}%
${ctx.dominantTopics ? `- Topik dominan: ${ctx.dominantTopics}\n` : ""}
POST YANG DIANALISA:
Konten: """
${ctx.post.text ?? "(tanpa teks)"}
"""
Dipublish: ${ctx.post.publishedAt}
Views: ${ctx.post.views} (${pctVsAvg}% vs rata-rata)
Engagement rate: ${(ctx.post.engagementRate * 100).toFixed(2)}%
Likes: ${ctx.post.likes} | Replies: ${ctx.post.replies} | Reposts: ${ctx.post.reposts} | Quotes: ${ctx.post.quotes} | Shares: ${ctx.post.shares}

TASK:
Analisa dalam Bahasa Indonesia natural, ringkas tapi spesifik:
1. Apakah post ini over- atau under-performed? Seberapa signifikan?
2. Faktor spesifik dari KONTEN (hook, tone, topik, struktur, panjang, CTA, timing) yang kemungkinan mempengaruhi performa.
3. 2–3 rekomendasi konkret kalau mau bikin post serupa.

Hindari generic advice. Fokus pada observasi yang spesifik untuk post ini. Format output dalam markdown dengan heading singkat.

PENTING — FORMAT OUTPUT:
- JANGAN pakai tabel markdown (\`| kolom | kolom |\`) — renderer kita tidak support tabel.
- Pakai heading (## atau ###), paragraf biasa, dan bullet list (\`-\`) atau numbered list (\`1.\`).
- Kalau perlu banding-bandingin aspek, tulis sebagai bullet list: "**Hook:** observasi..." bukan tabel.`;
}

export interface ComposeContext {
  /** Optional brief/topic from the user; empty means "free idea based on what works". */
  brief: string;
  /** How many draft variants to produce. */
  count: number;
  /** Hard character ceiling per post/part (Threads limit). */
  charLimit: number;
  /** When true, produce connected multi-part threads instead of standalone posts. */
  thread: boolean;
  /** A few of the user's best-performing posts, for voice + topic grounding. */
  topPosts: Array<{ text: string | null; views: number; engagementRate: number }>;
  /**
   * Per-account voice/persona override. When set, it REPLACES the generic
   * VOICE_RULES and relaxes the hardcoded CTA closing (so personas that forbid
   * CTAs — e.g. soft-close affiliate POV — aren't overridden).
   */
  persona?: string;
  /** When true, ask the model to emit a <topic> label per draft (parsed by parseDraftsWithTopics). */
  withTopic?: boolean;
}

/** Shared tone guidance so generated posts don't read stiff/corporate. */
const VOICE_RULES = `GAYA NULIS (WAJIB):
- Santai, kayak ngobrol sama temen — bukan bahasa korporat, press release, atau caption brand.
- Boleh pakai bahasa sehari-hari, kalimat pendek, dan sedikit slang yang wajar. Boleh mulai kalimat dengan "Jadi", "Nah", "Btw".
- Hindari kata kaku/klise: "mari", "yuk simak", "di era digital ini", "tak dapat dipungkiri", "sahabat", emoji berlebihan.
- Hook di kalimat pertama harus bikin orang berhenti scroll. Tulis kayak manusia, bukan AI.
- Tanpa hashtag berlebihan (maks 1-2 kalau beneran relevan).`;

export function buildComposePrompt(ctx: ComposeContext): string {
  const examples = ctx.topPosts
    .map(
      (p, i) =>
        `${i + 1}. [views=${p.views}, ER=${(p.engagementRate * 100).toFixed(2)}%] ${(p.text ?? "(no text)")
          .replace(/\s+/g, " ")
          .slice(0, 240)}`,
    )
    .join("\n");

  const grounding = `${
    examples
      ? `POST TERBAIK CREATOR INI (tiru voice & topiknya):\n${examples}\n`
      : "Belum ada data post yang cukup; tulis dengan gaya percakapan yang natural.\n"
  }
${ctx.brief ? `BRIEF DARI USER:\n"""\n${ctx.brief}\n"""` : "Tidak ada brief spesifik — usulkan ide post baru yang sejalan dengan topik & gaya yang sudah perform."}`;

  const voiceBlock = ctx.persona?.trim() ? ctx.persona.trim() : VOICE_RULES;
  const closingLine = ctx.persona?.trim()
    ? "- Bagian terakhir = penutup sesuai GAYA NULIS di atas. Kalau gaya itu melarang CTA/ajakan, pakai soft close reflektif — JANGAN maksa CTA atau pertanyaan engagement."
    : "- Bagian terakhir = penutup/CTA/pertanyaan biar orang reply.";
  // Optional <topic> label per draft, emitted only when withTopic is set.
  // Topic must be a GENERAL theme/category, not a headline or summary of the post —
  // so it's usable for grouping & recent-topic dedup across many posts.
  const topicNote = ctx.withTopic
    ? " Awali tiap <draft> dengan <topic> berisi KATEGORI UMUM / tema besar konten — 1-3 kata, general (mis. \"siklus haid\", \"kesuburan\", \"herbal\", \"PCOS\"). JANGAN judul spesifik atau ringkasan isi post; cukup temanya aja."
    : "";
  const topicTag = ctx.withTopic ? "<topic>kategori umum</topic>" : "";
  const topicTagShort = ctx.withTopic ? "<topic>...</topic>" : "";

  if (ctx.thread) {
    return `Kamu kreator Threads yang nulis thread panjang (beberapa post nyambung, kayak utas/komen-dalam-komen) dengan suara si creator.

${grounding}

${voiceBlock}

TASK:
Tulis ${ctx.count} usulan thread yang berbeda. Tiap thread terdiri dari beberapa BAGIAN nyambung (3-6 bagian):
- Bagian pertama = hook kuat yang berdiri sendiri dan bikin penasaran.
- Tiap bagian maksimal ${ctx.charLimit} karakter. Hitung ketat.
- Antar-bagian harus ngalir/nyambung, satu ide per bagian, jangan diulang-ulang.
${closingLine}

FORMAT OUTPUT (WAJIB), tanpa teks lain di luar tag.${topicNote}
<draft>${topicTag}<part>hook bagian 1</part><part>isi bagian 2</part><part>penutup bagian 3</part></draft>
${ctx.count > 1 ? `<draft>${topicTagShort}<part>...</part><part>...</part></draft>\n...sebanyak ${ctx.count} draft thread.` : ""}`;
  }

  return `Kamu kreator Threads yang nulis draft post buat dirinya sendiri, dengan suara yang udah kebukti perform.

${grounding}

${voiceBlock}

TASK:
Tulis ${ctx.count} draft post Threads yang beda-beda. Aturan:
- Tiap draft maksimal ${ctx.charLimit} karakter (Threads limit). Hitung ketat.
- Variasikan angle antar-draft (hook beda, format beda: opini / cerita / list / pertanyaan).
- JANGAN tambahkan penjelasan, nomor, atau komentar apa pun di luar isi post.

FORMAT OUTPUT (WAJIB), tanpa teks lain di luar tag.${topicNote}
<draft>${topicTag}isi post draft pertama</draft>
<draft>${topicTag}isi post draft kedua</draft>
...sebanyak ${ctx.count} draft.`;
}

/** A parsed draft: its parts plus an optional model-emitted topic label. */
export interface ParsedDraft {
  /** Short topic label from a <topic> tag, or null if the model didn't emit one. */
  topic: string | null;
  /** Single-post drafts have one part; thread drafts (using <part> tags) have several. */
  parts: string[];
}

/**
 * Extract drafts from a model response, including an optional <topic> label per
 * draft. <topic> is stripped from the body; remaining <part> tags become parts
 * (or the whole body is one part if there are none). Empty parts are dropped.
 */
export function parseDraftsWithTopics(raw: string): ParsedDraft[] {
  const drafts: ParsedDraft[] = [];
  const re = /<draft>([\s\S]*?)<\/draft>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    let inner = m[1].trim();
    if (!inner) continue;
    let topic: string | null = null;
    const tm = inner.match(/<topic>([\s\S]*?)<\/topic>/i);
    if (tm) {
      topic = tm[1].trim() || null;
      inner = inner.replace(tm[0], "").trim();
    }
    const partRe = /<part>([\s\S]*?)<\/part>/gi;
    const parts: string[] = [];
    let pm: RegExpExecArray | null;
    while ((pm = partRe.exec(inner)) !== null) {
      const t = pm[1].trim();
      if (t) parts.push(t);
    }
    const finalParts = parts.length > 0 ? parts : inner ? [inner] : [];
    if (finalParts.length === 0) continue;
    drafts.push({ topic, parts: finalParts });
  }
  // Fallback: if the model ignored the tags, treat the whole thing as one draft.
  if (drafts.length === 0 && raw.trim()) drafts.push({ topic: null, parts: [raw.trim()] });
  return drafts;
}

/**
 * Back-compat shape: drafts as arrays of parts only (drops topic labels).
 * Callers that don't need topics (compose UI, autopilot scheduling) keep this.
 */
export function parseDrafts(raw: string): string[][] {
  return parseDraftsWithTopics(raw).map((d) => d.parts);
}

/**
 * Plain-text idea generator — like `buildComposePrompt`, but outputs human-
 * readable text without XML tags. Used by the MCP `generate_idea` tool which
 * exists to brainstorm WITHOUT touching DB persistence, top-posts grounding,
 * or any specific account's voice.
 */
export interface IdeaTextContext {
  brief: string;
  count: number;
  thread: boolean;
  charLimit: number;
  /** Per-account voice/persona override (see buildComposePrompt). */
  persona?: string;
}

export function buildIdeaTextPrompt(ctx: IdeaTextContext): string {
  const voiceBlock = ctx.persona?.trim() ? ctx.persona.trim() : VOICE_RULES;
  const ideaClosing = ctx.persona?.trim()
    ? "- Penutup ngikut GAYA NULIS di atas. Kalau gaya itu melarang CTA/ajakan, pakai soft close reflektif — JANGAN maksa CTA atau pertanyaan engagement."
    : "- Bagian terakhir = penutup/CTA/pertanyaan biar orang reply.";

  if (ctx.thread) {
    return `Kamu kreator Threads yang nulis thread berkualitas — siap publish, hook kuat, voice santai kayak ngobrol sama temen.

TASK: Tulis ${ctx.count} ide thread Threads soal topik "${ctx.brief}". Tiap thread terdiri dari 3-6 part yang nyambung.

${voiceBlock}

ATURAN OUTPUT (CRITICAL):
- Tiap part = maksimal ${ctx.charLimit} karakter (Threads limit). Hitung ketat.
- Output PLAIN TEXT. JANGAN pakai tag XML <draft> atau <part>. JANGAN heading markdown.
- Pisahin tiap part dengan baris kosong. Awali tiap part dengan "Part N:" (contoh: "Part 1:").
- ${ctx.count > 1 ? `Pisahin tiap ide dengan separator "═══ Idea N ═══" di awal blok ide.` : "Langsung tulis Part 1 dst tanpa header."}
- Konten harus quality "ready to publish" — hook kuat di Part 1, ngalir.
${ideaClosing}

Tulis langsung, gak usah preamble atau penjelasan di luar konten.`;
  }

  return `Kamu kreator Threads yang nulis single post berkualitas — siap publish, hook kuat, voice santai.

TASK: Tulis ${ctx.count} ide single post Threads soal topik "${ctx.brief}".

${voiceBlock}

ATURAN OUTPUT (CRITICAL):
- Tiap post = maksimal ${ctx.charLimit} karakter (Threads limit). Hitung ketat.
- Output PLAIN TEXT. JANGAN pakai tag XML <draft>. JANGAN heading markdown.
- ${ctx.count > 1 ? `Pisahin tiap ide dengan separator "═══ Idea N ═══".` : "Langsung tulis post-nya."}

Tulis langsung, gak usah preamble.`;
}

/**
 * Weekly learning analysis — takes recent performance + prior learnings and
 * asks the LLM to derive structured patterns. Output is strict JSON so the
 * orchestrator can persist it directly.
 */
export interface WeeklyAnalysisContext {
  accountUsername: string;
  niche: string | null;
  periodDays: number;
  posts: Array<{
    topic: string | null;
    views: number;
    likes: number;
    engagement_rate: number;
    snapshot_at: string;
  }>;
  previousLearnings: Array<{ week: string; summary: string }>;
}

export function buildWeeklyAnalysisPrompt(ctx: WeeklyAnalysisContext): string {
  const postLines = ctx.posts
    .slice(0, 30)
    .map(
      (p, i) =>
        `${i + 1}. [ER=${(p.engagement_rate * 100).toFixed(2)}%, views=${p.views}, likes=${p.likes}] topic="${
          p.topic ?? "(tanpa topik)"
        }"`,
    )
    .join("\n");

  const learningLines = ctx.previousLearnings
    .slice(0, 5)
    .map((l, i) => `${i + 1}. [${l.week}] ${l.summary}`)
    .join("\n");

  const isCold = ctx.posts.length === 0;
  const nicheLine = ctx.niche ? `Niche: ${ctx.niche}.` : "Niche: umum.";

  return `Kamu analis konten Threads. Analisa performa minggu lalu untuk akun @${ctx.accountUsername}.
${nicheLine}
Periode: ${ctx.periodDays} hari terakhir.

DATA POST (${ctx.posts.length} entri):
${postLines || "(belum ada data — cold start)"}

LEARNINGS SEBELUMNYA:
${learningLines || "(belum ada)"}

TASK: ${
    isCold
      ? "Cold start — belum ada data. Tulis baseline ringkas: niche, gaya yang akan dicoba, target. patterns kosong (array []) untuk semua."
      : "Identifikasi pola: hook/format/jam yang konsisten menang vs sepi. Catat 10 topik terbaru biar dihindari minggu depan."
  }

OUTPUT — STRICT JSON (tanpa teks/markdown/backtick di luar JSON):
{
  "summary": "2-4 kalimat ringkas apa yang work, apa yang nggak, kenapa",
  "patterns": {
    "best_hooks": ["..."],
    "best_formats": ["..."],
    "best_times_wib": ["..."],
    "avoid": ["..."],
    "recent_topics": ["..."]
  }
}`;
}

export interface PatternContext {
  periodDays: number;
  topPosts: Array<{ text: string | null; views: number; engagementRate: number }>;
  bottomPosts: Array<{ text: string | null; views: number; engagementRate: number }>;
}

export function buildPatternPrompt(ctx: PatternContext): string {
  const fmt = (p: { text: string | null; views: number; engagementRate: number }, i: number) =>
    `${i + 1}. [views=${p.views}, ER=${(p.engagementRate * 100).toFixed(2)}%] ${
      (p.text ?? "(no text)").replace(/\s+/g, " ").slice(0, 240)
    }`;

  return `Kamu adalah content strategist yang mendeteksi pola di antara post Threads top performer vs bottom performer.

PERIODE: ${ctx.periodDays} hari terakhir.

TOP ${ctx.topPosts.length} POST (by engagement rate):
${ctx.topPosts.map(fmt).join("\n")}

BOTTOM ${ctx.bottomPosts.length} POST (by engagement rate):
${ctx.bottomPosts.map(fmt).join("\n")}

TASK:
Tulis laporan pola dalam Bahasa Indonesia natural. Format markdown dengan heading. Bahas:
1. **Apa yang membedakan TOP dari BOTTOM** — topik, gaya bahasa, panjang, struktur hook, ada tidaknya pertanyaan/CTA, format (list/cerita/opinion), timing kalau terlihat.
2. **Pola spesifik 2-3 hal yang konsisten muncul di TOP** dengan contoh kutipan dari post.
3. **Pola yang membuat BOTTOM under-perform**, dengan contoh.
4. **3 rekomendasi konkret** untuk post berikutnya berdasarkan pola yang terdeteksi.

Spesifik dan dapat ditindak — hindari saran generik seperti "buat konten yang menarik".

PENTING — FORMAT OUTPUT:
- JANGAN pakai tabel markdown (\`| kolom | kolom |\`) — renderer kita tidak support tabel.
- Pakai heading (## atau ###), paragraf biasa, dan bullet list (\`-\`) atau numbered list (\`1.\`).
- Untuk perbandingan top vs bottom, tulis sebagai dua section terpisah dengan bullet list, bukan tabel.`;
}
