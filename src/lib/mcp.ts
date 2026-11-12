// MCP（Model Context Protocol）の最小実装。docs/mcp.md 参照。
// ステートレスな JSON-RPC 2.0。route handler から handleMcpMessage を呼ぶ。

import { searchDevices, specValue, USE_LABEL } from "./catalog";
import { SITE_URL } from "./format";
import { COMPARE_MONTHS, findConfig, monthlyFor, rentalOffers, rentOrBuy, TAX_LABEL } from "./pricing";
import type { Device, Use } from "./types";
import { productPath } from "./urls";

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "xmall", version: "0.5.0" };

type Json = Record<string, unknown>;
interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Json;
}

const deviceArg = { slug: { type: "string", description: "機種のslug（search_devicesの結果に含まれる）" } };
const cfgArg = { configId: { type: "string", description: "構成ID（例: 16-512）。省略時は標準構成" } };
const monthsArg = { months: { type: "integer", minimum: 1, maximum: 60, description: "利用期間（か月）。各社の料金表のうち、この期間以下で最も長い契約の月額を使う" } };

export const TOOLS = [
  {
    name: "search_devices",
    description: "法人向けIT機器（ノートPC・モニター・タブレットなど）を条件で検索し、レンタル最安月額（各社の掲載価格）・掲載社数・メーカー直販価格を返す。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "機種名・ブランドなどのキーワード" },
        category: { type: "string", description: "品目 id（例：laptop, monitor, tablet）" },
        brand: { type: "string" },
        os: { type: "string", description: "OS（例：macOS, Windows）" },
        use: { type: "string", enum: Object.keys(USE_LABEL), description: "用途" },
        maxMonthlyRent: { type: "integer", description: "レンタル月額の上限（円）" },
        minMemoryGb: { type: "integer" },
      },
    },
  },
  {
    name: "get_device",
    description: "機種の詳細（品目、スペックとやさしい解説、構成、使い方の例、FAQ、出典）を返す。",
    inputSchema: { type: "object", properties: deviceArg, required: ["slug"] },
  },
  {
    name: "compare_rental_offers",
    description: "指定構成について、レンタル会社が公開ページに掲載している月額を安い順に返す（会社名・掲載URL・税区分・取得日つき）。",
    inputSchema: { type: "object", properties: { ...deviceArg, ...cfgArg, ...monthsArg }, required: ["slug"] },
  },
  {
    name: "compare_purchase_prices",
    description: "指定構成のメーカー直販価格（出典つきで登録したもの）を返す。",
    inputSchema: { type: "object", properties: { ...deviceArg, ...cfgArg }, required: ["slug"] },
  },
  {
    name: "rent_or_buy",
    description: "指定期間使う場合に、レンタル（掲載中の最安月額×期間）とメーカー直販価格のどちらが安いかを単純比較する。",
    inputSchema: { type: "object", properties: { ...deviceArg, ...cfgArg, ...monthsArg }, required: ["slug", "months"] },
  },
] as const;

class ToolError extends Error {}

const asMonths = (v: unknown, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 60 ? n : fallback;
};
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Number(v));

function requireDevice(devices: Device[], args: Json) {
  const slug = str(args.slug);
  const d = slug ? devices.find((x) => x.slug === slug) : undefined;
  if (!d) throw new ToolError(`機種が見つかりません: ${slug ?? "(slug未指定)"}`);
  return d;
}

/** devices：公開中のカタログ（route では DB から、テストでは固定データを渡す） */
export function callTool(name: string, args: Json = {}, devices: Device[] = []): unknown {
  switch (name) {
    case "search_devices":
      return { results: searchDevices(devices, {
        query: str(args.query),
        category: str(args.category),
        brand: str(args.brand),
        os: str(args.os),
        use: str(args.use) as Use | undefined,
        maxMonthlyRent: num(args.maxMonthlyRent),
        minMemoryGb: num(args.minMemoryGb),
      }).map((d) => ({ ...d, url: SITE_URL + d.url })) };
    case "get_device": {
      const d = requireDevice(devices, args);
      return {
        slug: d.slug,
        category: d.categoryId,
        brand: d.brand,
        name: d.name,
        subtitle: d.subtitle,
        os: specValue(d, "os") ?? null,
        releaseDate: d.releaseDate,
        specs: d.specs.map(({ key, label, value, unit, display, plain }) => ({ key, label, value, unit, display, plain })),
        configs: d.configs.map(({ id, label, attrs, officialPrice }) => ({ id, label, attrs, officialPrice })),
        verified: d.verified,
        content: d.content ?? null,
        sources: d.sources,
        rentalCompanies: new Set(d.rentals.map((o) => o.companyId)).size,
        url: SITE_URL + productPath(d),
      };
    }
    case "compare_rental_offers": {
      const d = requireDevice(devices, args);
      const cfg = d.configs.find((c) => c.id === str(args.configId));
      const months = args.months === undefined ? undefined : asMonths(args.months, 12);
      const offers = rentalOffers(d, cfg?.id).map((o) => ({
        company: o.companyName,
        url: o.url,
        title: o.title,
        configId: o.configId,
        cpu: o.cpu,
        memoryGb: o.memoryGb,
        storageGb: o.storageGb,
        monthly: months ? (monthlyFor(o, months) ?? null) : o.monthly,
        monthlyTermMonths: months ?? o.monthlyTerm,
        plans: o.plans,
        tax: TAX_LABEL[o.priceTax],
        inStock: o.inStock,
        fetchedAt: o.fetchedAt,
      }));
      return {
        device: `${d.brand} ${d.name}`,
        config: cfg?.label ?? "すべての構成",
        months: months ?? null,
        offers,
        note: "各レンタル会社の公開ページに掲載されている価格（xmall の提携先ではない）。最新の価格・在庫は url で確認すること。",
      };
    }
    case "compare_purchase_prices": {
      const d = requireDevice(devices, args);
      const cfg = findConfig(d, str(args.configId));
      return {
        device: `${d.brand} ${d.name}`,
        config: cfg.label,
        offers: cfg.officialPrice ? [{ seller: `${d.brand}（メーカー直販）`, price: cfg.officialPrice, tax: "税込" }] : [],
        sources: d.sources,
        note: cfg.officialPrice ? "メーカーの公式価格（出典は sources）。" : "メーカー直販の価格は登録されていません（販売終了・中古のみの機種など）。",
      };
    }
    case "rent_or_buy": {
      const d = requireDevice(devices, args);
      const cfg = findConfig(d, str(args.configId));
      const r = rentOrBuy(d, cfg.id, asMonths(args.months ?? args.term, COMPARE_MONTHS[1]));
      if (!r) throw new ToolError("この構成はメーカー直販価格かレンタルの掲載価格がありません。");
      return { device: `${d.brand} ${d.name}`, config: cfg.label, ...r, note: "レンタル（掲載中の最安月額×期間）と直販価格の単純比較。売却額・保守費用は含まない。" };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

/** 1件の JSON-RPC メッセージを処理。通知（idなし）の場合は null を返す。 */
export function handleMcpMessage(msg: RpcRequest, devices: Device[] = []): Json | null {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;
  try {
    let result: unknown;
    switch (msg.method) {
      case "initialize": {
        const requested = str(msg.params?.protocolVersion);
        result = {
          protocolVersion: requested && SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: "xmall.jp の法人向けIT機器レンタル・購入比較データ。レンタル月額は各社の公開ページの掲載価格（取得日つき）。search_devices で機種を探し、compare_rental_offers / compare_purchase_prices / rent_or_buy で比較できます。",
        };
        break;
      }
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call": {
        const name = str(msg.params?.name);
        if (!name) throw new RpcError(-32602, "params.name is required");
        try {
          const data = callTool(name, (msg.params?.arguments as Json) ?? {}, devices);
          result = { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false };
        } catch (e) {
          if (e instanceof ToolError) {
            result = { content: [{ type: "text", text: e.message }], isError: true };
          } else throw e;
        }
        break;
      }
      default:
        if (msg.method?.startsWith("notifications/")) return null;
        throw new RpcError(-32601, `Method not found: ${msg.method}`);
    }
    return isNotification ? null : { jsonrpc: "2.0", id, result };
  } catch (e) {
    if (isNotification) return null;
    const code = e instanceof RpcError ? e.code : -32603;
    return { jsonrpc: "2.0", id, error: { code, message: e instanceof Error ? e.message : "Internal error" } };
  }
}
