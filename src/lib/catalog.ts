import { lowestMonthly, lowestPurchase } from "./pricing";
import type { Device, DeviceImage, DeviceSpec, SpecValue, Use } from "./types";

/**
 * カタログの純粋な処理（DB に依存しない）。データの取得は catalog-server.ts（キャッシュ付き）。
 */

export { USE_LABEL } from "./labels";

export const spec = (d: Pick<Device, "specs">, key: string): DeviceSpec | undefined => d.specs.find((s) => s.key === key);
export const specValue = (d: Pick<Device, "specs">, key: string): SpecValue | undefined => spec(d, key)?.value;

/** 構成ごとの値（variant スコープ）の一覧（重複なし・昇順） */
export function variantValues(d: Pick<Device, "configs">, key: string): SpecValue[] {
  const vals = [...new Set(d.configs.map((c) => c.attrs[key]).filter((v) => v !== undefined && v !== null))];
  return vals.sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ja")));
}

export interface DeviceSummary {
  slug: string;
  categoryId: string;
  categoryName: string;
  brand: string;
  name: string;
  subtitle: string;
  /** 一覧カードに出すスペック（highlight の項目。variant は範囲で表示） */
  highlights: { key: string; label: string; icon: string | null; text: string }[];
  /** 絞り込み用の値（key → 値の一覧。variant は全構成の値） */
  facets: Record<string, string[]>;
  uses: Use[];
  rentFrom?: number;
  buyFrom?: number;
  supplierCount: number;
  verified: boolean;
  bodyColor: string;
  images?: DeviceImage[];
  url: string;
}

const unitText = (v: SpecValue, unit: string | null) =>
  typeof v === "boolean" ? (v ? "あり" : "なし") : unit === "インチ" ? `${v}″` : unit ? `${v}${unit}` : String(v);

export function summarize(d: Device, highlightAttrs?: { key: string; label: string; icon: string | null; unit: string | null; scope: "product" | "variant" }[]): DeviceSummary {
  const highlights: DeviceSummary["highlights"] = [];
  const facets: Record<string, string[]> = { brand: [d.brand] };
  for (const s of d.specs) {
    if (s.highlight) highlights.push({ key: s.key, label: s.label, icon: s.icon, text: unitText(s.value, s.unit) });
    if (s.filterable) facets[s.key] = [String(s.value)];
  }
  // 構成ごとの値（メモリなど）。項目定義が渡されていればそれに従う
  for (const a of highlightAttrs ?? []) {
    if (a.scope !== "variant") continue;
    const vals = variantValues(d, a.key);
    if (!vals.length) continue;
    facets[a.key] = vals.map((v) => unitText(v, a.unit));
    highlights.push({ key: a.key, label: a.label, icon: a.icon, text: vals.map((v) => String(v)).join("/") + (a.unit ?? "") });
  }
  return {
    slug: d.slug,
    categoryId: d.categoryId,
    categoryName: d.categoryName,
    brand: d.brand,
    name: d.name,
    subtitle: d.subtitle,
    highlights,
    facets,
    uses: d.uses,
    rentFrom: lowestMonthly(d),
    buyFrom: lowestPurchase(d),
    supplierCount: d.suppliers.length,
    verified: d.verified,
    bodyColor: d.bodyColor,
    images: d.images.slice(0, 1),
    url: `/pc/${d.slug}`,
  };
}

export interface SearchParams {
  query?: string;
  category?: string;
  brand?: string;
  os?: string;
  use?: Use;
  maxMonthlyRent?: number;
  minMemoryGb?: number;
}

/** 条件で機種を検索（MCP・API から利用）。月額の安い順。 */
export function searchDevices(devices: Device[], p: SearchParams) {
  const q = p.query?.trim().toLowerCase();
  return devices
    .filter((d) => {
      if (q && !`${d.brand} ${d.name} ${d.subtitle} ${d.categoryName}`.toLowerCase().includes(q)) return false;
      if (p.category && d.categoryId !== p.category) return false;
      if (p.brand && d.brand.toLowerCase() !== p.brand.toLowerCase()) return false;
      if (p.os && specValue(d, "os") !== p.os) return false;
      if (p.use && !d.uses.includes(p.use)) return false;
      if (p.minMemoryGb) {
        const mem = variantValues(d, "memory_gb").map(Number);
        if (!mem.length || Math.max(...mem) < p.minMemoryGb) return false;
      }
      return true;
    })
    .map((d) => summarize(d))
    .filter((s) => !p.maxMonthlyRent || (s.rentFrom !== undefined && s.rentFrom <= p.maxMonthlyRent))
    .sort((a, b) => (a.rentFrom ?? Infinity) - (b.rentFrom ?? Infinity));
}
