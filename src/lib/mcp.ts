// MCP（Model Context Protocol）の最小実装。docs/mcp.md 参照。
// ステートレスな JSON-RPC 2.0。route handler から handleMcpMessage を呼ぶ。

import { GRADES, TEMPLATES, TERMS } from "../data/master";
import { getDevice, searchDevices, USE_LABEL } from "./catalog";
import { SITE_URL } from "./format";
import { findConfig, quote, rentalOffers, rentOrBuy, shopOffers } from "./pricing";
import type { GradeCode, Os, TemplateCode, Term, Use } from "./types";

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "xmall", version: "0.1.0" };

type Json = Record<string, unknown>;
interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Json;
}

const deviceArg = { slug: { type: "string", description: "機種のslug（search_devicesの結果に含まれる）" } };
const cfgArg = { configId: { type: "string", description: "構成ID（例: 16-512）。省略時は標準構成" } };
const termArg = { term: { type: "integer", enum: TERMS, description: "契約期間（月）" } };
const gradeArg = { grade: { type: "string", enum: Object.keys(GRADES), description: "品質グレード S/A/B/C" } };
const tplArg = { template: { type: "string", enum: Object.keys(TEMPLATES), description: "設定テンプレート" } };

export const TOOLS = [
  {
    name: "search_devices",
    description: "法人向けIT機器（ノートPC）を条件で検索し、レンタル最安月額と購入最安価格を返す。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "機種名・ブランドなどのキーワード" },
        brand: { type: "string" },
        os: { type: "string", enum: ["macOS", "Windows"] },
        use: { type: "string", enum: Object.keys(USE_LABEL), description: "用途" },
        maxMonthlyRent: { type: "integer", description: "レンタル月額の上限（円）" },
        minMemoryGb: { type: "integer" },
      },
    },
  },
  {
    name: "get_device",
    description: "機種の詳細（構成、やさしいスペック解説、使い方の例、FAQ、出典）を返す。",
    inputSchema: { type: "object", properties: deviceArg, required: ["slug"] },
  },
  {
    name: "compare_rental_offers",
    description: "指定構成について、各レンタル会社の月額・初期費用・納期・故障対応を安い順に比較する。",
    inputSchema: { type: "object", properties: { ...deviceArg, ...cfgArg, ...gradeArg, ...termArg, ...tplArg }, required: ["slug"] },
  },
  {
    name: "compare_purchase_prices",
    description: "指定構成について、メーカー公式・Amazon・楽天などの購入価格とポイント還元後の実質価格を比較する。",
    inputSchema: { type: "object", properties: { ...deviceArg, ...cfgArg }, required: ["slug"] },
  },
  {
    name: "rent_or_buy",
    description: "指定期間使う場合に、購入（売却残価を差し引き）とレンタルのどちらが安いかを試算する。",
    inputSchema: { type: "object", properties: { ...deviceArg, ...cfgArg, ...termArg }, required: ["slug", "term"] },
  },
  {
    name: "get_quote",
    description: "台数・期間・グレード・テンプレートを指定してレンタルの見積総額を計算する。",
    inputSchema: {
      type: "object",
      properties: { ...deviceArg, ...cfgArg, ...gradeArg, ...termArg, ...tplArg, quantity: { type: "integer", minimum: 1 }, supplierId: { type: "string" } },
      required: ["slug", "quantity"],
    },
  },
] as const;

class ToolError extends Error {}

const asTerm = (v: unknown): Term => (TERMS.includes(Number(v) as Term) ? (Number(v) as Term) : 24);
const asGrade = (v: unknown): GradeCode => (typeof v === "string" && v in GRADES ? (v as GradeCode) : "A");
const asTpl = (v: unknown): TemplateCode => (typeof v === "string" && v in TEMPLATES ? (v as TemplateCode) : "OFFICE");
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Number(v));

function requireDevice(args: Json) {
  const slug = str(args.slug);
  const d = slug ? getDevice(slug) : undefined;
  if (!d) throw new ToolError(`機種が見つかりません: ${slug ?? "(slug未指定)"}`);
  return d;
}

export function callTool(name: string, args: Json = {}): unknown {
  switch (name) {
    case "search_devices":
      return { results: searchDevices({
        query: str(args.query),
        brand: str(args.brand),
        os: str(args.os) as Os | undefined,
        use: str(args.use) as Use | undefined,
        maxMonthlyRent: num(args.maxMonthlyRent),
        minMemoryGb: num(args.minMemoryGb),
      }).map((d) => ({ ...d, url: SITE_URL + d.url })) };
    case "get_device": {
      const d = requireDevice(args);
      return {
        slug: d.slug,
        brand: d.brand,
        name: d.name,
        chip: d.chip,
        os: d.os,
        screenInch: d.screenInch,
        weightKg: d.weightKg,
        releaseDate: d.releaseDate,
        configs: d.configs.map(({ id, label, memoryGb, storageGb, officialPrice }) => ({ id, label, memoryGb, storageGb, officialPrice })),
        verified: d.verified,
        content: d.content ?? null,
        sources: d.sources,
        url: `${SITE_URL}/pc/${d.slug}`,
      };
    }
    case "compare_rental_offers": {
      const d = requireDevice(args);
      const cfg = findConfig(d, str(args.configId));
      return {
        device: d.name,
        config: cfg.label,
        grade: asGrade(args.grade),
        term: asTerm(args.term),
        template: asTpl(args.template),
        offers: rentalOffers(d, cfg.id, asGrade(args.grade), asTerm(args.term), asTpl(args.template)),
        note: "レンタル会社と価格はサンプルデータです。",
      };
    }
    case "compare_purchase_prices": {
      const d = requireDevice(args);
      const cfg = findConfig(d, str(args.configId));
      const offers = shopOffers(d, cfg.id);
      return { device: d.name, config: cfg.label, offers, note: offers.length ? "公式以外の価格・ポイントはサンプルです。" : "購入価格は準備中です。" };
    }
    case "rent_or_buy": {
      const d = requireDevice(args);
      const cfg = findConfig(d, str(args.configId));
      const r = rentOrBuy(d, cfg.id, asTerm(args.term));
      if (!r) throw new ToolError("この構成は購入価格またはレンタル見積がまだありません。");
      return { device: d.name, config: cfg.label, ...r, note: "残価率・価格はサンプル仮定による試算です。" };
    }
    case "get_quote": {
      const d = requireDevice(args);
      const q = quote(d, {
        configId: str(args.configId),
        grade: asGrade(args.grade),
        term: asTerm(args.term),
        template: asTpl(args.template),
        quantity: num(args.quantity),
        supplierId: str(args.supplierId),
      });
      if (!q) throw new ToolError("条件に合う見積がありません。");
      return { device: d.name, ...q, note: "サンプルデータによる試算です。" };
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
export function handleMcpMessage(msg: RpcRequest): Json | null {
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
          instructions: "xmall.jp の法人向けIT機器レンタル・購入比較データ。search_devices で機種を探し、compare_rental_offers / compare_purchase_prices / rent_or_buy で比較できます。",
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
          const data = callTool(name, (msg.params?.arguments as Json) ?? {});
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
