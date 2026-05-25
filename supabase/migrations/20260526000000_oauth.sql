-- ============================================================
-- OAuth 2.0 authorization server tables for MCP Connector
-- (claude.ai Custom Connector requires OAuth, not static Bearer)
-- ============================================================

-- Clients registered via Dynamic Client Registration (RFC 7591)
-- or pre-configured. For public clients (PKCE-only), client_secret is null.
CREATE TABLE IF NOT EXISTS threadlens.oauth_clients (
  client_id                   text        PRIMARY KEY,
  client_secret               text,
  client_name                 text,
  redirect_uris               text[]      NOT NULL,
  grant_types                 text[]      NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token']::text[],
  response_types              text[]      NOT NULL DEFAULT ARRAY['code']::text[],
  token_endpoint_auth_method  text        NOT NULL DEFAULT 'none',
  scope                       text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- Short-lived single-use authorization codes (RFC 6749 §4.1)
-- PKCE (RFC 7636) fields are required since claude.ai uses PKCE.
CREATE TABLE IF NOT EXISTS threadlens.oauth_codes (
  code                    text        PRIMARY KEY,
  client_id               text        NOT NULL REFERENCES threadlens.oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri            text        NOT NULL,
  admin_id                uuid        NOT NULL REFERENCES threadlens.admins(id) ON DELETE CASCADE,
  scope                   text,
  code_challenge          text        NOT NULL,
  code_challenge_method   text        NOT NULL DEFAULT 'S256',
  expires_at              timestamptz NOT NULL,
  used                    boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON threadlens.oauth_codes (expires_at);

-- Long-lived access tokens (and optional refresh tokens) returned to the client.
CREATE TABLE IF NOT EXISTS threadlens.oauth_tokens (
  access_token   text        PRIMARY KEY,
  refresh_token  text        UNIQUE,
  client_id      text        NOT NULL REFERENCES threadlens.oauth_clients(client_id) ON DELETE CASCADE,
  admin_id       uuid        NOT NULL REFERENCES threadlens.admins(id) ON DELETE CASCADE,
  scope          text,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_admin ON threadlens.oauth_tokens (admin_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON threadlens.oauth_tokens (expires_at);

GRANT ALL ON TABLE threadlens.oauth_clients TO service_role;
GRANT ALL ON TABLE threadlens.oauth_codes TO service_role;
GRANT ALL ON TABLE threadlens.oauth_tokens TO service_role;
