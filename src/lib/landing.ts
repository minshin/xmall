import { companyCount, lowestMonthly } from "./pricing";
import { USE_LABEL } from "./labels";
import type { Device, Use } from "./types";

/**
 * 品目・メーカー・価格帯・用途の一覧ページ（検索の入口）に出す機種の選び方と、
 * ページごとに違う数字（実データの集計）。純粋関数なのでテストできる。
 *
 * 機種が少なすぎるページは作らない（MIN_PRODUCTS 未満は 404・サイトマップにも出さない）。
 */

export const MIN_PRODUCTS = 2;

export interface PriceBand {
  id: string;
  label: string;
  /** 最安月額（税込換算）がこの範囲に入る機種 */
  min: number;
  max: number;
}

export const PRICE_BANDS: PriceBand[] = [
  { id: "under-3000", label: "月額3,000円以下", min: 0, max: 3000 },
  { id: "under-5000", label: "月額5,000円以下", min: 0, max: 5000 },
  { id: "under-10000", label: "月額10,000円以下", min: 0, max: 10000 },
  { id: "over-10000", label: "月額10,000円超", min: 10001, max: Infinity },
];

export type LandingFilter =
  | { kind: "category" }
  | { kind: "brand"; brandId: string }
  | { kind: "price"; band: PriceBand }
  | { kind: "use"; use: Use };

export function filterDevices(devices: Device[], categoryId: string, f: LandingFilter): Device[] {
  return devices.filter((d) => {
    if (d.categoryId !== categoryId) return false;
    switch (f.kind) {
      case "category":
        return true;
      case "brand":
        return d.brandId === f.brandId;
      case "price": {
        const m = lowestMonthly(d);
        return m !== undefined && m >= f.band.min && m <= f.band.max;
      }
      case "use":
        return d.uses.includes(f.use);
    }
  });
}

export interface LandingStats {
  products: number;
  /** レンタルの掲載がある機種 */
  withRentals: number;
  listings: number;
  companies: number;
  minMonthly?: number;
  maxMonthly?: number;
  medianMonthly?: number;
  /** 掲載価格の取得日（最新） */
  fetchedAt?: string;
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** 掲載価格の集計（各機種の最安月額で比べる。比較用の税込換算） */
export function landingStats(devices: Device[]): LandingStats {
  const lows = devices.flatMap((d) => lowestMonthly(d) ?? []);
  const all = devices.flatMap((d) => d.rentals);
  return {
    products: devices.length,
    withRentals: lows.length,
    listings: all.length,
    companies: new Set(all.map((o) => o.companyId)).size,
    minMonthly: lows.length ? Math.min(...lows) : undefined,
    maxMonthly: lows.length ? Math.max(...lows) : undefined,
    medianMonthly: median(lows),
    fetchedAt: all.map((o) => o.fetchedAt).sort().at(-1),
  };
}

/** 一覧の並び：掲載社数の多い順 → 安い順（掲載が無い機種は最後） */
export function sortForLanding(devices: Device[]): Device[] {
  return [...devices].sort(
    (a, b) => companyCount(b) - companyCount(a) || (lowestMonthly(a) ?? Infinity) - (lowestMonthly(b) ?? Infinity),
  );
}

/** その品目で作れるメーカー・価格帯・用途のページ（機種が MIN_PRODUCTS 以上あるものだけ） */
export function landingFacets(devices: Device[], categoryId: string) {
  const inCat = devices.filter((d) => d.categoryId === categoryId);
  const brands = new Map<string, { id: string; name: string; count: number }>();
  for (const d of inCat) {
    const b = brands.get(d.brandId) ?? { id: d.brandId, name: d.brand, count: 0 };
    b.count++;
    brands.set(d.brandId, b);
  }
  const prices = PRICE_BANDS.map((band) => ({ band, count: filterDevices(devices, categoryId, { kind: "price", band }).length }));
  const uses = (Object.keys(USE_LABEL) as Use[]).map((use) => ({ use, label: USE_LABEL[use], count: inCat.filter((d) => d.uses.includes(use)).length }));
  return {
    brands: [...brands.values()].filter((b) => b.count >= MIN_PRODUCTS).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    prices: prices.filter((p) => p.count >= MIN_PRODUCTS),
    uses: uses.filter((u) => u.count >= MIN_PRODUCTS),
  };
}

/** 一覧ページの説明文（集計した実データから作る。数字が無いところは書かない） */
export function landingLead(subject: string, s: LandingStats, yen: (n: number) => string): string {
  const parts = [`${subject}を${s.products}機種掲載しています。`];
  if (s.withRentals) {
    parts.push(
      `${s.companies}社のレンタル会社の掲載価格（${s.listings}件）をもとに、月額は${yen(s.minMonthly!)}〜${yen(s.maxMonthly!)}、機種ごとの最安月額の中央値は${yen(s.medianMonthly!)}です。`,
    );
  }
  return parts.join("");
}
