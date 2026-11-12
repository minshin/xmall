/* eslint-disable @typescript-eslint/no-explicit-any -- テストで JSON-RPC 応答を気軽に覗くため */
import assert from "node:assert/strict";
import { test } from "node:test";
import { handleMcpMessage, TOOLS } from "../src/lib/mcp";
import { toRentalOffer, type RentalRow } from "../src/lib/repo-catalog";
import { SEED_CATALOG } from "../src/lib/seed";

/** MacBook Pro に実データと同じ形の掲載を 2 件付けたカタログ */
const listing = (company: string, prices: [number, number][], config: string | null): RentalRow => ({
  company_id: company, company_name: company, external_id: "1", url: `https://example.com/${company}`, title: "MacBook Pro 14 M5",
  config_id: config, cpu: "M5", memory_gb: 16, storage_gb: 512, condition: null, office_included: null, in_stock: null,
  price_tax: "incl", terms: null, fetched_at: "2026-11-12",
  prices: prices.map(([m, y]) => ({ termUnit: "month", termValue: m, priceYen: y, basis: "per_month", label: `${m}か月` })),
});
const CATALOG = SEED_CATALOG.map((d) =>
  d.slug === "macbook-pro-14-m5"
    ? { ...d, rentals: [toRentalOffer(listing("a", [[1, 19000], [12, 15000]], "16-512"))!, toRentalOffer(listing("b", [[3, 16000]], null))!] }
    : d,
);

const call = (method: string, params?: Record<string, unknown>, id: number | undefined = 1) =>
  handleMcpMessage({ jsonrpc: "2.0", id, method, params }, CATALOG) as { result?: any; error?: { code: number } };

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

test("compare_rental_offers は掲載価格を安い順に、期間を指定するとその期間の月額で返す", () => {
  const r = call("tools/call", { name: "compare_rental_offers", arguments: { slug: "macbook-pro-14-m5", configId: "16-512" } });
  assert.deepEqual(r.result.structuredContent.offers.map((o: any) => [o.company, o.monthly]), [["a", 15000], ["b", 16000]]);
  const one = call("tools/call", { name: "compare_rental_offers", arguments: { slug: "macbook-pro-14-m5", months: 1 } });
  assert.deepEqual(one.result.structuredContent.offers.map((o: any) => [o.company, o.monthly]), [["a", 19000], ["b", null]]);
});

test("rent_or_buy は掲載の月額×期間と直販価格を比べる。get_quote（架空の見積）は無い", () => {
  const rb = call("tools/call", { name: "rent_or_buy", arguments: { slug: "macbook-pro-14-m5", configId: "16-512", months: 24 } });
  assert.equal(rb.result.isError, false);
  assert.equal(rb.result.structuredContent.rentTotal, 15000 * 24);
  assert.equal(rb.result.structuredContent.cheaper, "buy");
  assert.equal(TOOLS.some((t) => t.name === ("get_quote" as string)), false);
});

test("存在しない機種はツールエラー（isError）", () => {
  const r = call("tools/call", { name: "get_device", arguments: { slug: "nope" } });
  assert.equal(r.result.isError, true);
});

test("未知のメソッド・ツールは JSON-RPC エラー", () => {
  assert.equal(call("foo/bar").error?.code, -32601);
  assert.equal(call("tools/call", { name: "nope" }).error?.code, -32602);
});
