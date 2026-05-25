function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishable: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  supabaseServiceRole: () =>
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  metaAppId: () => required("META_APP_ID", process.env.META_APP_ID),
  metaAppSecret: () => required("META_APP_SECRET", process.env.META_APP_SECRET),
  metaRedirectUri: () => required("META_REDIRECT_URI", process.env.META_REDIRECT_URI),
  llmGatewayUrl: () =>
    process.env.LLM_GATEWAY_URL ?? "https://patunganai-gateway.bhskin.workers.dev/v1/messages",
  llmGatewayKey: () => required("LLM_GATEWAY_API_KEY", process.env.LLM_GATEWAY_API_KEY),
  tokenEncryptionKey: () => required("TOKEN_ENCRYPTION_KEY", process.env.TOKEN_ENCRYPTION_KEY),
  cronSecret: () => required("CRON_SECRET", process.env.CRON_SECRET),
  sessionSecret: () => required("SESSION_SECRET", process.env.SESSION_SECRET),
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  mcpBearerToken: () => required("MCP_BEARER_TOKEN", process.env.MCP_BEARER_TOKEN),
};
