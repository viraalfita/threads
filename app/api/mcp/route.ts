import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "@/lib/mcp/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";

// Vercel Hobby caps function duration at 60s. Threads multi-part chains
// (≤6 parts) typically finish in 15-25s, so this is enough headroom.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: invalid or missing bearer token." },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="threadlens-mcp"',
      },
    },
  );
}

async function handle(req: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(req);
  if (!auth) return unauthorized();

  // Stateless: each request gets a fresh server + transport. claude.ai's
  // Connector calls are short-lived and the server holds no per-session state
  // (the admin binding is reconstructed from the bearer on every request).
  const server = buildMcpServer(auth.adminId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Best-effort cleanup; transport is per-request.
    transport.close().catch(() => {});
    server.close().catch(() => {});
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
