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

  if (ctx.thread) {
    return `Kamu kreator Threads yang nulis thread panjang (beberapa post nyambung, kayak utas/komen-dalam-komen) dengan suara si creator.

${grounding}

${VOICE_RULES}

TASK:
Tulis ${ctx.count} usulan thread yang berbeda. Tiap thread terdiri dari beberapa BAGIAN nyambung (3-6 bagian):
- Bagian pertama = hook kuat yang berdiri sendiri dan bikin penasaran.
- Tiap bagian maksimal ${ctx.charLimit} karakter. Hitung ketat.
- Antar-bagian harus ngalir/nyambung, satu ide per bagian, jangan diulang-ulang.
- Bagian terakhir = penutup/CTA/pertanyaan biar orang reply.

FORMAT OUTPUT (WAJIB), tanpa teks lain di luar tag:
<draft><part>hook bagian 1</part><part>isi bagian 2</part><part>penutup bagian 3</part></draft>
${ctx.count > 1 ? "<draft><part>...</part><part>...</part></draft>\n...sebanyak " + ctx.count + " draft thread." : ""}`;
  }

  return `Kamu kreator Threads yang nulis draft post buat dirinya sendiri, dengan suara yang udah kebukti perform.

${grounding}

${VOICE_RULES}

TASK:
Tulis ${ctx.count} draft post Threads yang beda-beda. Aturan:
- Tiap draft maksimal ${ctx.charLimit} karakter (Threads limit). Hitung ketat.
- Variasikan angle antar-draft (hook beda, format beda: opini / cerita / list / pertanyaan).
- JANGAN tambahkan penjelasan, nomor, atau komentar apa pun di luar isi post.

FORMAT OUTPUT (WAJIB), tanpa teks lain di luar tag:
<draft>isi post draft pertama</draft>
<draft>isi post draft kedua</draft>
...sebanyak ${ctx.count} draft.`;
}

/**
 * Extract drafts from a model response. Each draft is returned as an array of
 * parts: single-post drafts have one part; thread drafts (using <part> tags)
 * have several. Empty parts are dropped.
 */
export function parseDrafts(raw: string): string[][] {
  const drafts: string[][] = [];
  const re = /<draft>([\s\S]*?)<\/draft>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const inner = m[1].trim();
    if (!inner) continue;
    const partRe = /<part>([\s\S]*?)<\/part>/gi;
    const parts: string[] = [];
    let pm: RegExpExecArray | null;
    while ((pm = partRe.exec(inner)) !== null) {
      const t = pm[1].trim();
      if (t) parts.push(t);
    }
    drafts.push(parts.length > 0 ? parts : [inner]);
  }
  // Fallback: if the model ignored the tags, treat the whole thing as one draft.
  if (drafts.length === 0 && raw.trim()) drafts.push([raw.trim()]);
  return drafts;
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
}

export function buildIdeaTextPrompt(ctx: IdeaTextContext): string {
  if (ctx.thread) {
    return `Kamu kreator Threads yang nulis thread berkualitas — siap publish, hook kuat, voice santai kayak ngobrol sama temen.

TASK: Tulis ${ctx.count} ide thread Threads soal topik "${ctx.brief}". Tiap thread terdiri dari 3-6 part yang nyambung.

${VOICE_RULES}

ATURAN OUTPUT (CRITICAL):
- Tiap part = maksimal ${ctx.charLimit} karakter (Threads limit). Hitung ketat.
- Output PLAIN TEXT. JANGAN pakai tag XML <draft> atau <part>. JANGAN heading markdown.
- Pisahin tiap part dengan baris kosong. Awali tiap part dengan "Part N:" (contoh: "Part 1:").
- ${ctx.count > 1 ? `Pisahin tiap ide dengan separator "═══ Idea N ═══" di awal blok ide.` : "Langsung tulis Part 1 dst tanpa header."}
- Konten harus quality "ready to publish" — hook kuat di Part 1, ngalir, CTA/pertanyaan di part terakhir.
- Bagian terakhir = penutup/CTA/pertanyaan biar orang reply.

Tulis langsung, gak usah preamble atau penjelasan di luar konten.`;
  }

  return `Kamu kreator Threads yang nulis single post berkualitas — siap publish, hook kuat, voice santai.

TASK: Tulis ${ctx.count} ide single post Threads soal topik "${ctx.brief}".

${VOICE_RULES}

ATURAN OUTPUT (CRITICAL):
- Tiap post = maksimal ${ctx.charLimit} karakter (Threads limit). Hitung ketat.
- Output PLAIN TEXT. JANGAN pakai tag XML <draft>. JANGAN heading markdown.
- ${ctx.count > 1 ? `Pisahin tiap ide dengan separator "═══ Idea N ═══".` : "Langsung tulis post-nya."}

Tulis langsung, gak usah preamble.`;
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
