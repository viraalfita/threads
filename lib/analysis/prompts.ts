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
  /** Hard character ceiling per draft (Threads limit). */
  charLimit: number;
  /** A few of the user's best-performing posts, for voice + topic grounding. */
  topPosts: Array<{ text: string | null; views: number; engagementRate: number }>;
}

export function buildComposePrompt(ctx: ComposeContext): string {
  const examples = ctx.topPosts
    .map(
      (p, i) =>
        `${i + 1}. [views=${p.views}, ER=${(p.engagementRate * 100).toFixed(2)}%] ${(p.text ?? "(no text)")
          .replace(/\s+/g, " ")
          .slice(0, 240)}`,
    )
    .join("\n");

  return `Kamu adalah content strategist yang menulis draft post Threads untuk seorang creator, meniru gaya dan suara mereka berdasarkan post yang terbukti perform.

${examples ? `POST TERBAIK CREATOR INI (referensi gaya & topik):\n${examples}\n` : "Belum ada data post yang cukup; tulis dengan gaya percakapan yang natural.\n"}
${ctx.brief ? `BRIEF DARI USER:\n"""\n${ctx.brief}\n"""` : "Tidak ada brief spesifik — usulkan ide post baru yang sejalan dengan topik & gaya yang sudah perform."}

TASK:
Tulis ${ctx.count} draft post Threads yang berbeda-beda. Aturan:
- Tiap draft maksimal ${ctx.charLimit} karakter (Threads limit). Hitung dengan ketat.
- Tiru voice creator dari contoh: tone, panjang kalimat, cara buka (hook), penggunaan pertanyaan/CTA.
- Variasikan angle antar-draft (mis. hook beda, format beda: opini / cerita / list / pertanyaan).
- Bahasa Indonesia natural, bukan kaku/korporat. Tanpa hashtag berlebihan (maks 1-2 kalau relevan).
- JANGAN tambahkan penjelasan, nomor, atau komentar apa pun di luar isi post.

FORMAT OUTPUT (WAJIB):
Bungkus SETIAP draft persis seperti ini, tanpa teks lain di luar tag:
<draft>isi post draft pertama</draft>
<draft>isi post draft kedua</draft>
...sebanyak ${ctx.count} draft.`;
}

/** Extract <draft>...</draft> blocks from a model response, trimmed and non-empty. */
export function parseDrafts(raw: string): string[] {
  const out: string[] = [];
  const re = /<draft>([\s\S]*?)<\/draft>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  // Fallback: if the model ignored the tags, return the whole thing as one draft.
  if (out.length === 0 && raw.trim()) out.push(raw.trim());
  return out;
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
