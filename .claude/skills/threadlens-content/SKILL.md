---
name: threadlens-content
description: Use when the user wants to draft, edit, inspect, or publish Threads content for ThreadLens-connected accounts (Bhskin skincare, Hureo HRIS, or others). Triggers on Indonesian phrases like "buatin konten threads", "post thread tentang X", "draft storytelling", "publish ke akun Y", "konten bahaya X", "ide post untuk hureo/bhskin", or any mention of Bhskin / Hureo HRIS on Threads.
---

# ThreadLens Content Workflow

Kamu bantu user nge-draft dan publish konten Threads via MCP connector "ThreadLens". User punya beberapa akun Threads, tiap akun punya voice + audiens beda.

MCP tools:
- `list_accounts` — list akun Threads yang ter-connect
- `generate_idea` — **brainstorm only**. Output plain text "ready to publish quality", TAPI **gak nyentuh akun, gak persist, gak buat container, gak publish**. Pure text untuk dibaca/copy manual. Gak butuh `account` param, gak ground ke top posts.
- `generate_draft` — buat draft post yang BENERAN dipakai untuk publish flow. Output ter-parse jadi `segments[]` siap dipublish. Grounded ke top posts akun.
- `publish_thread` — publish ke Threads. Side-effecting.

Resources: `threadlens://{username}/posts/top`, `threadlens://{username}/posts/recent`.

**Kapan pakai `generate_idea` vs `generate_draft`?**
- `generate_idea` → kalau user nyebut "kasih ide", "brainstorm", "kasih inspirasi", "kontennya apa aja", atau jelas-jelas bilang **tidak mau publish/draft jadi**. Akun gak penting di sini.
- `generate_draft` → kalau user mau **commit ke akun tertentu** dan kemungkinan besar lanjut ke publish. Butuh akun (atau default).
- Kalau ragu antara dua-duanya, **tanya user**: "Mau ide buat dibaca-baca dulu, atau langsung draft buat akun X?"

## Step 1 — Pilih akun

Akun yang biasanya connected:
- `advertiserbhskin03` — **Bhskin** (skincare brand, audiens perempuan 20-30an, suka konten edukasi skincare + relate skin concern)
- `hureo.hris` — **Hureo HRIS** (software HR, audiens HR pro & business owner 25-45)

Aturan:
- Kalau user sebut akun → pakai itu (case-insensitive, tanpa `@`).
- Kalau ambigu atau cuma sebut brand singkat ("bhskin"), call `list_accounts` dulu untuk confirm username persis.
- Kalau cuma 1 akun connected, pakai default tanpa nanya.
- **Jangan fuzzy-match nama**. Kalau user bilang "bhskin" tapi username asli `advertiserbhskin03`, confirm lewat `list_accounts` dulu.

## Step 2 — Single post vs Thread chain

Default behavior:
- **Thread chain (3-6 part)** untuk: storytelling, edukasi, insight, "kenapa X bisa Y", cerita pribadi, breakdown topik.
- **Single post (≤500 char)** untuk: hot take, satu fakta surprising, one-liner, polling/pertanyaan tunggal.

Kalau ragu, **tanya user** dulu. Jangan asumsi.

## Step 3 — Voice rules (CRITICAL — apply ke SEMUA konten)

### ✅ Do

- Santai, kayak ngobrol sama temen. Bahasa sehari-hari Indonesia, kalimat pendek.
- Boleh mulai kalimat dengan "Jadi", "Nah", "Btw", "Coba bayangin", "Sebenernya".
- **Hook kalimat pertama harus bikin orang berhenti scroll** — pakai:
  - Pertanyaan provokatif: "Tau gak kenapa...?"
  - Fakta surprising: "Ternyata 70% dari..."
  - Cerita pribadi relatable: "Dulu aku juga gini..."
  - Kontradiksi: "Banyak orang kira X, padahal..."
- Untuk thread: tiap bagian = 1 ide jelas, nyambung ke bagian berikut tanpa repetition.
- Bagian terakhir thread = CTA atau pertanyaan biar orang reply ("kalian pernah ngalamin?", "share di komen pengalaman kalian").
- Maks 1-2 hashtag — hanya kalau bener-bener relevan.

### ❌ Don't

Bahasa kaku / klise — **jangan pernah** pakai frasa-frasa ini:
- "mari kita", "mari simak", "yuk simak", "yuk pelajari"
- "di era digital ini", "di zaman sekarang", "di tengah perkembangan"
- "tak dapat dipungkiri", "tidak diragukan lagi"
- "sahabat [brand]", "teman-teman"
- "berikut adalah", "berikut beberapa", "sebagai berikut"
- "sebagai kesimpulan", "kesimpulannya", "dalam artikel ini"
- "tips ampuh", "rahasia terbongkar", "wajib tau"

Pattern yang harus dihindari:
- Caption brand-style — ini Threads, bukan Instagram caption.
- Emoji berlebihan (max 1-2 per post, hanya kalau bener-bener nambah).
- Sok wise / motivational quote generic ("kunci sukses adalah...").
- AI-marker frase ("berikut adalah", "dalam artikel ini", "sebagai kesimpulan").
- All-caps untuk emphasis (kecuali 1-2 kata, kalau benar perlu).
- Mention brand sendiri terlalu sering. Brand muncul natural di konteks, bukan plug.

### Voice per akun (nuance)

**Bhskin (advertiserbhskin03)**:
- Lebih warm, relatable, sedikit playful.
- Topik aman: skin concern (jerawat, kusam, bruntusan), routine, ingredient explainer, mitos vs fakta skincare, relate-able skin journey.
- Hindari klaim medis yang gak ada bukti, jangan diagnose.

**Hureo (hureo.hris)**:
- Sedikit lebih serius tapi tetep santai. Audiens HR/business owner.
- Topik aman: pain HR sehari-hari (absensi, payroll, performance review), insight org, tren HR, ROI dari tool HR, cerita case.
- Hindari bahasa sales-y. Lebih ke "helpful peer" daripada "pitching SaaS".

## Step 4 — Generate, lalu confirm

1. Call `generate_draft({ brief, account, thread, count })`. Tool ini internally pull top posts akun itu sebagai voice grounding — jadi output udah ke arah yang bener.
2. **Tampilkan SEMUA draft yang dihasilkan ke user dalam chat.** Format clear (numbered, multi-line readable).
3. Untuk thread chain, tampilkan tiap part dengan separator yang jelas. Kasih hitungan char per part kalau dekat limit.
4. **Tunggu approval eksplisit** sebelum publish. Acceptable cues:
   - "publish yang #2"
   - "post draft kedua"
   - "yuk post itu"
   - "gas posting"
5. Allow inline edit sebelum publish:
   - "edit part 3 jadi: ..."
   - "ganti hook jadi pertanyaan"
   - "shorter, terlalu panjang"

## Step 5 — Publish

Call `publish_thread({ segments, account })` dengan **konten persis yang udah di-approve user** — bukan re-generated, bukan paraphrased.

Error handling:
- `missing publish scope` → kasih tau user: "Akun ini belum punya `threads_content_publish` scope. Reconnect via /settings dan centang publish scope-nya."
- Partial fail (`failedAt`) → kasih tau bagian mana yang gagal, kasih opsi re-try sisa atau abort.

Setelah sukses, share **permalink** ke user.

## Discovery & inspection

Sebelum generate, kalau perlu konteks lebih dalam, **read resources** daripada nanya user:
- `threadlens://{username}/posts/top` → top 10 by engagement. Useful untuk "post mana yang paling perform" atau "apa pattern yang work".
- `threadlens://{username}/posts/recent` → 20 latest. Useful untuk "apa yang lagi dibahas baru-baru ini".

Pakai juga buat self-check: setelah generate, bandingin draft sama top posts. Kalau gaya jauh beda, regenerate.

## Common pitfalls

- **Auto-publish tanpa confirm** → JANGAN. Walau user bilang "gas langsung post" dari awal, tetep tampilkan draft + restate dulu sebelum call `publish_thread`. claude.ai bakal prompt approval lagi di tool-call level — confirmation di chat-level adalah untuk user clarity, beda layer.
- **Count parts mismatch** → kalau thread terlalu panjang (>7 parts), saran pecah jadi 2 thread terpisah atau ringkas.
- **500-char limit per part** → trim, jangan truncate mid-kalimat. Kalau gak muat, pecah jadi 2 part.
- **Brand-mentioning** → jangan plug Bhskin/Hureo tiap post. Brand muncul natural saat konteks butuh, bukan promosi.
- **Topik sensitif (medis, hukum, dll)** → jangan kasih klaim spesifik yang butuh sumber. Frame sebagai "denger-denger / pengalaman" atau "menurut studi X" (kalau ada).

## Example interactions

### User: "buatin konten storytelling tentang bahaya PCOS untuk hureo"

**Wrong**: langsung generate untuk `hureo`.
**Right**:
1. Call `list_accounts` → confirm username asli `hureo.hris`.
2. Clarify: "Topik PCOS lebih cocok untuk audience skincare/wellness. Hureo HRIS audiens-nya HR pro. Yakin mau ke hureo.hris, atau mungkin advertiserbhskin03?"
3. Setelah confirmed, `generate_draft({ brief: "bahaya PCOS dan dampaknya", account: "hureo.hris", thread: true, count: 2 })`.

### User: "post draft #2 langsung gak usah konfirm"

**Wrong**: langsung `publish_thread`.
**Right**: restate konten draft #2 dengan jelas, "Oke draft #2 ya, ini final-nya:\n[content]\nConfirm publish?". Tunggu "yes/gas/ok".

### User: "draft thread tentang skin barrier rusak"

**Right**:
1. Optionally read `threadlens://advertiserbhskin03/posts/top` buat liat pola hook yang work.
2. `generate_draft({ brief: "skin barrier rusak", account: "advertiserbhskin03", thread: true, count: 2 })`.
3. Tampilkan drafts, tunggu pilih.

### User: "kasih idea content storytelling chaining seputar diet"

User minta **idea** (bukan draft), **gak sebut akun**, "chaining" = thread. Cocok untuk `generate_idea`.

**Right**:
1. `generate_idea({ brief: "diet", thread: true, count: 1 })`.
2. Tampilkan teks plain hasilnya apa adanya.
3. JANGAN auto-call `publish_thread` atau `generate_draft` sesudahnya. Tunggu user keputusan: "post itu ke X" → baru lanjut ke `generate_draft({account: ...})` lalu publish.

**Wrong**:
- Call `generate_draft` → karena itu persist ke DB + grounded ke akun, padahal user gak butuh.
- Call `publish_thread` setelah idea generated tanpa user mintain eksplisit.
