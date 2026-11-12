import type { Device, DeviceConfig, RentalOffer } from "./types";

/**
 * 価格の計算（純粋関数）。使うのは実データだけ：
 *   * レンタル：各社の公開ページに載っている月額（device.rentals）
 *   * 購入：メーカー直販価格（出典つきで登録したもの）
 * 推測で金額を作らない（係数・残価率などの仮定は使わない）。
 */

/** 「借りる vs 買う」で比べる利用期間（か月） */
export const COMPARE_MONTHS = [12, 24, 36] as const;

export function findConfig(device: Pick<Device, "configs">, configId?: string | null): DeviceConfig {
  return device.configs.find((c) => c.id === configId) ?? device.configs[0];
}

/** 税抜表示の月額を税込に換算（比較用。表示はページの表記どおりにする） */
export const toCompare = (yen: number, tax: RentalOffer["priceTax"]) => (tax === "excl" ? Math.round(yen * 1.1) : yen);

const byPrice = (a: RentalOffer, b: RentalOffer) => a.monthlyCompare - b.monthlyCompare || a.companyName.localeCompare(b.companyName, "ja");

/**
 * 構成に合うレンタル掲載（安い順）。
 * configId を渡すと、その構成のものと「構成の記載がない」ものを返す。省略時は全件。
 */
export function rentalOffers(device: Pick<Device, "rentals">, configId?: string | null): RentalOffer[] {
  return device.rentals.filter((o) => !configId || o.configId === configId || o.configId === null).sort(byPrice);
}

/** 会社ごとに最安の 1 件だけ（一覧・要約用） */
export function cheapestPerCompany(offers: RentalOffer[]): RentalOffer[] {
  const best = new Map<string, RentalOffer>();
  for (const o of offers) {
    const cur = best.get(o.companyId);
    if (!cur || byPrice(o, cur) < 0) best.set(o.companyId, o);
  }
  return [...best.values()].sort(byPrice);
}

/** 機種の最安月額（比較用の税込換算） */
export function lowestMonthly(device: Pick<Device, "rentals">): number | undefined {
  return device.rentals.length ? Math.min(...device.rentals.map((o) => o.monthlyCompare)) : undefined;
}

/** 掲載している会社の数 */
export const companyCount = (device: Pick<Device, "rentals">) => new Set(device.rentals.map((o) => o.companyId)).size;

/** 構成のメーカー直販価格（未登録なら undefined） */
export function officialPrice(device: Pick<Device, "configs">, configId?: string | null): number | undefined {
  return findConfig(device, configId).officialPrice;
}

export function lowestPurchase(device: Pick<Device, "configs">): number | undefined {
  const all = device.configs.flatMap((c) => (c.officialPrice ? [c.officialPrice] : []));
  return all.length ? Math.min(...all) : undefined;
}

/**
 * months か月使うときの月額（ページの表記どおり）。
 * 各社の「◯か月以上の契約で月額◯円」の表のうち、months 以下で最も長い期間の月額を使う。表に無ければ undefined。
 */
export function monthlyFor(offer: RentalOffer, months: number): number | undefined {
  const fit = offer.plans.filter((p) => p.months <= months).sort((a, b) => b.months - a.months)[0];
  return fit?.monthly;
}

export interface RentOrBuy {
  months: number;
  buyPrice: number;
  rentMonthly: number;
  rentTotal: number;
  rentCompany: string;
  rentTax: RentalOffer["priceTax"];
  cheaper: "rent" | "buy";
  difference: number;
}

/**
 * 借りる（掲載中の最安月額 × 期間）と買う（メーカー直販価格）の単純比較。
 * 売却額・保守費用などは含めない。どちらかの価格が無ければ undefined。
 */
export function rentOrBuy(device: Pick<Device, "configs" | "rentals">, configId: string | undefined, months: number): RentOrBuy | undefined {
  const cfg = findConfig(device, configId);
  if (!cfg.officialPrice) return undefined;
  let best: { o: RentalOffer; monthly: number; compare: number } | undefined;
  for (const o of rentalOffers(device, cfg.id)) {
    const m = monthlyFor(o, months);
    if (m === undefined) continue;
    const compare = toCompare(m, o.priceTax);
    if (!best || compare < best.compare) best = { o, monthly: m, compare };
  }
  if (!best) return undefined;
  const rentTotal = best.compare * months;
  return {
    months,
    buyPrice: cfg.officialPrice,
    rentMonthly: best.monthly,
    rentTotal,
    rentCompany: best.o.companyName,
    rentTax: best.o.priceTax,
    cheaper: rentTotal < cfg.officialPrice ? "rent" : "buy",
    difference: Math.abs(cfg.officialPrice - rentTotal),
  };
}

/** 価格の税区分の表示 */
export const TAX_LABEL: Record<RentalOffer["priceTax"], string> = { incl: "税込", excl: "税抜", unknown: "税区分の記載なし" };

const cap = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);

/** 掲載の仕様の短い表記（ページに書かれている値だけ） */
export function offerSpec(o: RentalOffer): string {
  return [
    o.cpu?.replace(/^インテル\s*/, ""),
    o.memoryGb ? `メモリ${o.memoryGb}GB` : null,
    o.storageGb ? cap(o.storageGb) : null,
    o.condition === "selectable" ? "新品・中古を選択" : o.condition === "new" ? "新品" : o.condition === "used" ? "中古" : null,
    o.officeIncluded ? "Office付き" : null,
  ]
    .filter(Boolean)
    .join("・");
}
