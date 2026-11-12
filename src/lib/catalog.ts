import { DEVICES } from "../data/devices";
import { REVIEWS } from "../data/reviews";
import { lowestMonthly, lowestPurchase } from "./pricing";
import type { Device, Os, Use } from "./types";

export const USE_LABEL: Record<Use, string> = {
  office: "一般事務",
  design: "デザイン・映像",
  dev: "開発",
  sales: "営業・外回り",
  cad: "CAD・3D",
};

export function allDevices(): Device[] {
  return DEVICES;
}

export function getDevice(slug: string): Device | undefined {
  return DEVICES.find((d) => d.slug === slug);
}

export function reviewsFor(slug: string) {
  return REVIEWS.filter((r) => r.deviceSlug === slug);
}

export interface DeviceSummary {
  slug: string;
  brand: string;
  name: string;
  chip: string;
  cpuFamily: Device["cpuFamily"];
  os: Os;
  screenInch: number;
  weightKg: number;
  memoryOptionsGb: number[];
  storageRange: string;
  uses: Use[];
  rentFrom?: number;
  buyFrom?: number;
  supplierCount: number;
  verified: boolean;
  social: Device["social"];
  bodyColor: string;
  url: string;
}

const storageLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);

export function summarize(d: Device): DeviceSummary {
  const mem = [...new Set(d.configs.map((c) => c.memoryGb))].sort((a, b) => a - b);
  const st = d.configs.map((c) => c.storageGb).sort((a, b) => a - b);
  return {
    slug: d.slug,
    brand: d.brand,
    name: d.name,
    chip: d.chip,
    cpuFamily: d.cpuFamily,
    os: d.os,
    screenInch: d.screenInch,
    weightKg: d.weightKg,
    memoryOptionsGb: mem,
    storageRange: st[0] === st[st.length - 1] ? storageLabel(st[0]) : `${storageLabel(st[0])}〜${storageLabel(st[st.length - 1])}`,
    uses: d.uses,
    rentFrom: lowestMonthly(d),
    buyFrom: lowestPurchase(d),
    supplierCount: d.suppliers.length,
    verified: d.verified,
    social: d.social,
    bodyColor: d.bodyColor,
    url: `/pc/${d.slug}`,
  };
}

export interface SearchParams {
  query?: string;
  brand?: string;
  os?: Os;
  use?: Use;
  maxMonthlyRent?: number;
  minMemoryGb?: number;
}

/** 条件で機種を検索（MCP・APIから利用）。月額の安い順。 */
export function searchDevices(p: SearchParams): DeviceSummary[] {
  const q = p.query?.trim().toLowerCase();
  return DEVICES.map(summarize)
    .filter((d) => {
      if (q && !`${d.brand} ${d.name} ${d.chip}`.toLowerCase().includes(q)) return false;
      if (p.brand && d.brand.toLowerCase() !== p.brand.toLowerCase()) return false;
      if (p.os && d.os !== p.os) return false;
      if (p.use && !d.uses.includes(p.use)) return false;
      if (p.maxMonthlyRent && (d.rentFrom === undefined || d.rentFrom > p.maxMonthlyRent)) return false;
      if (p.minMemoryGb && Math.max(...d.memoryOptionsGb) < p.minMemoryGb) return false;
      return true;
    })
    .sort((a, b) => (a.rentFrom ?? Infinity) - (b.rentFrom ?? Infinity));
}
