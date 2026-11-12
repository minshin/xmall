import { handleMcpMessage } from "@/lib/mcp";

// MCP Streamable HTTP（ステートレス・JSON応答のみ）。docs/mcp.md 参照。

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = messages
    .map((m) => (m && typeof m === "object" && "method" in m ? handleMcpMessage(m as Parameters<typeof handleMcpMessage>[0]) : { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }))
    .filter((r) => r !== null);

  if (responses.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? responses : responses[0]);
}

export async function GET() {
  // サーバーからのSSEストリームは提供しない
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
