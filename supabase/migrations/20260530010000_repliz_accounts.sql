-- ============================================================
-- Per-account activation for the autonomous engine. Only accounts
-- tagged is_active=true are eligible for schedule/publish and the
-- stats cron. Opt-in by design (default false) so no account is used
-- unless explicitly enabled.
-- ============================================================

CREATE TABLE IF NOT EXISTS threadlens.repliz_accounts (
  account_id  text          PRIMARY KEY,   -- Repliz account id
  username    text,
  is_active   boolean       NOT NULL DEFAULT false,
  niche       text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS repliz_accounts_touch ON threadlens.repliz_accounts;
CREATE TRIGGER repliz_accounts_touch BEFORE UPDATE ON threadlens.repliz_accounts
  FOR EACH ROW EXECUTE FUNCTION threadlens.touch_updated_at();

GRANT ALL ON TABLE threadlens.repliz_accounts TO service_role;
