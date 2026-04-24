-- ============================================================
-- Multi-account: admin -> many threads accounts
-- ============================================================

-- 1. Add admin_id column
ALTER TABLE threadlens.users
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES threadlens.admins(id) ON DELETE CASCADE;

-- 2. Backfill existing users to the first admin (single-admin pre-migration)
UPDATE threadlens.users u
SET admin_id = (SELECT id FROM threadlens.admins ORDER BY created_at LIMIT 1)
WHERE u.admin_id IS NULL;

-- 3. Make admin_id NOT NULL (only if backfill succeeded)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM threadlens.users WHERE admin_id IS NULL) THEN
    ALTER TABLE threadlens.users ALTER COLUMN admin_id SET NOT NULL;
  END IF;
END $$;

-- 4. Index for admin -> users lookup (not unique — an admin can have many accounts)
CREATE INDEX IF NOT EXISTS idx_users_admin_id ON threadlens.users (admin_id);

-- 5. threads_user_id still unique per row, but also scope uniqueness to admin
--    (safety: prevent same threads account being linked under two different admins accidentally)
--    Actually: threads_user_id is globally unique in our schema; we keep it that way.
--    If different admins want to connect the same threads account, reconnect flow reassigns ownership.
