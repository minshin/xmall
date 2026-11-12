import { GRADES, RESALE_RATE, SHOPS, SUPPLIERS, TEMPLATES, TERM_FACTOR } from "../data/master";
import type { Device, DeviceConfig, GradeCode, RentalOffer, ShopOffer, TemplateCode, Term } from "./types";

const round10 = (n: number) => Math.round(n / 10) * 10;

export function findConfig(device: Device, configId?: string): DeviceConfig {
  return device.configs.find((c) => c.id === configId) ?? device.configs[0];
}

/** 指定構成の各社レンタル見積（月額の安い順）。対応していないグレードの会社は除外。 */
export function rentalOffers(
  device: Device,
  configId: string | undefined,
  grade: GradeCode = "A",
  term: Term = 24,
  template: TemplateCode = "OFFICE",
): RentalOffer[] {
  const cfg = findConfig(device, configId);
  return SUPPLIERS.filter((s) => device.suppliers.includes(s.id) && s.grades.includes(grade))
    .map((s) => ({
      supplierId: s.id,
      supplierName: s.name,
      monthly: round10(cfg.rentBase * GRADES[grade].priceFactor * TERM_FACTOR[term] * s.priceFactor + TEMPLATES[template].monthlyFee),
      setupFee: s.setupFee,
      leadDays: s.leadDays,
      swap: s.swap,
      rating: s.rating,
      certified: s.certified,
    }))
    .sort((a, b) => a.monthly - b.monthly);
}

/** 機種の最安月額（24か月・A・一般事務、全構成のうち最安） */
export function lowestMonthly(device: Device): number | undefined {
  const all = device.configs.flatMap((c) => rentalOffers(device, c.id, "A", 24, "OFFICE").map((o) => o.monthly));
  return all.length ? Math.min(...all) : undefined;
}

/** 指定構成の購入価格比較（実質価格の安い順）。公式価格が未確認なら空配列。 */
export function shopOffers(device: Device, configId?: string): ShopOffer[] {
  const cfg = findConfig(device, configId);
  if (!cfg.officialPrice) return [];
  const list = cfg.officialPrice;
  return SHOPS.map((s) => {
    const price = round10(list * s.priceRatio);
    const points = Math.round(price * s.pointRate);
    return {
      shopId: s.id,
      shopName: s.id === "official" ? `${device.brand}公式ストア` : s.name,
      kind: s.kind,
      price,
      points,
      effective: price - points,
      shipping: s.shipping,
      note: s.note,
    };
  }).sort((a, b) => a.effective - b.effective);
}

export function lowestPurchase(device: Device): number | undefined {
  const all = device.configs.flatMap((c) => shopOffers(device, c.id).map((o) => o.effective));
  return all.length ? Math.min(...all) : undefined;
}

export interface RentOrBuy {
  term: Term;
  buyEffective: number;
  resale: number;
  buyNet: number;
  rentMonthly: number;
  rentTotal: number;
  cheaper: "rent" | "buy";
  difference: number;
}

/** 買う vs 借りる。購入価格が無い、またはレンタル見積が無い場合は undefined。 */
export function rentOrBuy(device: Device, configId: string | undefined, term: Term): RentOrBuy | undefined {
  const shops = shopOffers(device, configId);
  const offers = rentalOffers(device, configId, "A", term, "OFFICE");
  if (!shops.length || !offers.length) return undefined;
  const buyEffective = shops[0].effective;
  const resale = Math.round(buyEffective * RESALE_RATE[term]);
  const buyNet = buyEffective - resale;
  const rentMonthly = offers[0].monthly;
  const rentTotal = rentMonthly * term;
  return {
    term,
    buyEffective,
    resale,
    buyNet,
    rentMonthly,
    rentTotal,
    cheaper: rentTotal < buyNet ? "rent" : "buy",
    difference: Math.abs(buyNet - rentTotal),
  };
}

export interface Quote {
  supplierId: string;
  supplierName: string;
  monthlyPerUnit: number;
  quantity: number;
  monthlyTotal: number;
  term: Term;
  setupFeeTotal: number;
  contractTotal: number;
}

export function quote(
  device: Device,
  opts: { configId?: string; grade?: GradeCode; term?: Term; template?: TemplateCode; quantity?: number; supplierId?: string },
): Quote | undefined {
  const term = opts.term ?? 24;
  const quantity = Math.max(1, Math.floor(opts.quantity ?? 1));
  const offers = rentalOffers(device, opts.configId, opts.grade ?? "A", term, opts.template ?? "OFFICE");
  const o = opts.supplierId ? offers.find((x) => x.supplierId === opts.supplierId) : offers[0];
  if (!o) return undefined;
  const setupFeeTotal = o.setupFee * quantity;
  return {
    supplierId: o.supplierId,
    supplierName: o.supplierName,
    monthlyPerUnit: o.monthly,
    quantity,
    monthlyTotal: o.monthly * quantity,
    term,
    setupFeeTotal,
    contractTotal: o.monthly * quantity * term + setupFeeTotal,
  };
}
