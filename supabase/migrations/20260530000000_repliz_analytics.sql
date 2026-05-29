-- ============================================================
-- Repliz-backed analytics + learning loop for the autonomous
-- Threads content engine. Keyed by Repliz account/post ids (text),
-- independent of the Meta-synced `users`/`posts` tables.
-- ============================================================

-- Time-series snapshots of post performance. A daily cron pulls
-- Repliz /content/{postId}/statistic and appends a row, so we keep
-- history (velocity) rather than just the latest value.
CREATE TABLE IF NOT EXISTS threadlens.repliz_post_performance (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      text          NOT NULL,           -- Repliz account id
  username        text,                             -- denormalized for convenience
  post_id         text          NOT NULL,           -- Repliz/Threads post id (schedule.postId)
  schedule_id     text,                             -- originating Repliz schedule id (attribution)
  topic           text,                             -- topic label carried from the schedule
  views           bigint        NOT NULL DEFAULT 0,
  likes           bigint        NOT NULL DEFAULT 0,
  replies         bigint        NOT NULL DEFAULT 0,
  reposts         bigint        NOT NULL DEFAULT 0,
  quotes          bigint        NOT NULL DEFAULT 0,
  shares          bigint        NOT NULL DEFAULT 0,
  engagement_rate numeric(8,4)  NOT NULL DEFAULT 0,
  snapshot_at     timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repliz_perf_account_post
  ON threadlens.repliz_post_performance (account_id, post_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_repliz_perf_account_snapshot
  ON threadlens.repliz_post_performance (account_id, snapshot_at DESC);

-- Derived weekly learnings — written after analyzing performance, read
-- before the next generation cycle. This is the loop's memory.
CREATE TABLE IF NOT EXISTS threadlens.repliz_learnings (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  text          NOT NULL,
  username    text,
  week        date          NOT NULL,
  summary     text          NOT NULL,
  patterns    jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repliz_learnings_account_created
  ON threadlens.repliz_learnings (account_id, created_at DESC);

GRANT ALL ON TABLE threadlens.repliz_post_performance TO service_role;
GRANT ALL ON TABLE threadlens.repliz_learnings TO service_role;
