/* eslint-disable @typescript-eslint/no-explicit-any -- テストで JSON-RPC 応答を気軽に覗くため */
import assert from "node:assert/strict";
import { test } from "node:test";
import { handleMcpMessage, TOOLS } from "../src/lib/mcp";
import { SEED_CATALOG } from "../src/lib/seed";

const call = (method: string, params?: Record<string, unknown>, id: number | undefined = 1) =>
  handleMcpMessage({ jsonrpc: "2.0", id, method, params }, SEED_CATALOG) as { result?: any; error?: { code: number } };

test("initialize はプロトコルバージョンと tools capability を返す", () => {
  const r = call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(r.result.protocolVersion, "2025-06-18");
  assert.ok(r.result.capabilities.tools);
  assert.equal(r.result.serverInfo.name, "xmall");
});

test("未知のバージョン要求には既定バージョンで応答", () => {
  const r = call("initialize", { protocolVersion: "1999-01-01" });
  assert.equal(r.result.protocolVersion, "2025-06-18");
});

test("通知には応答しない", () => {
  assert.equal(handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});

test("tools/list は全ツールを返す", () => {
  const r = call("tools/list");
  assert.equal(r.result.tools.length, TOOLS.length);
  assert.ok(r.result.tools.every((t: any) => t.inputSchema?.type === "object"));
});

test("search_devices の structuredContent はオブジェクト", () => {
  const r = call("tools/call", { name: "search_devices", arguments: { os: "macOS" } });
  assert.equal(r.result.isError, false);
  assert.ok(Array.isArray(r.result.structuredContent.results));
  assert.ok(r.result.structuredContent.results.length >= 1);
});

test("rent_or_buy と get_quote", () => {
  const rb = call("tools/call", { name: "rent_or_buy", arguments: { slug: "macbook-pro-14-m5", term: 36 } });
  assert.equal(rb.result.isError, false);
  assert.ok(["rent", "buy"].includes(rb.result.structuredContent.cheaper));
  const q = call("tools/call", { name: "get_quote", arguments: { slug: "macbook-pro-14-m5", quantity: 3, term: 12 } });
  assert.equal(q.result.structuredContent.quantity, 3);
});

test("存在しない機種はツールエラー（isError）", () => {
  const r = call("tools/call", { name: "get_device", arguments: { slug: "nope" } });
  assert.equal(r.result.isError, true);
});

test("未知のメソッド・ツールは JSON-RPC エラー", () => {
  assert.equal(call("foo/bar").error?.code, -32601);
  assert.equal(call("tools/call", { name: "nope" }).error?.code, -32602);
});
