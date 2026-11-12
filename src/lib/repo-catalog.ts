import type { Sql } from "./db";
import { mediaUrl } from "./media";
import { formatSpec } from "./seed";
import { toCompare } from "./pricing";
import type {
  Category, Device, DeviceContent, DeviceImage, DeviceSpec, ProductStatus, RentalListingData, RentalOffer, RentalPriceData, Source,
  SpecAttribute, SpecValue, Use,
} from "./types";

/**
 * 商品カタログの DB アクセス（SQL のみ。Next.js に依存しないのでテスト・スクリプトから呼べる）。
 * 画面からはキャッシュ付きの lib/catalog.ts を使う。
 */

// ───────── 品目・スペック定義 ─────────

type AttrRow = {
  id: string;
  category_id: string;
  key: string;
  label: string;
  unit: string | null;
  type: SpecAttribute["type"];
  scope: SpecAttribute["scope"];
  options: string[];
  icon: string | null;
  filterable: boolean;
  highlight: boolean;
  sort: number;
};

const toAttr = (r: AttrRow): SpecAttribute => ({
  id: r.id,
  categoryId: r.category_id,
  key: r.key,
  label: r.label,
  unit: r.unit,
  type: r.type,
  scope: r.scope,
  options: r.options,
  icon: r.icon,
  filterable: r.filterable,
  highlight: r.highlight,
  sort: r.sort,
});

export async function loadCategories(sql: Sql): Promise<Category[]> {
  const cats = await sql<{ id: string; name: string; icon: string | null; sort: number }[]>`
    select id, name, icon, sort from public.categories order by sort, id`;
  const attrs = await sql<AttrRow[]>`select * from public.spec_attributes order by sort, key`;
  return cats.map((c) => ({ ...c, attributes: attrs.filter((a) => a.category_id === c.id).map(toAttr) }));
}

// ───────── サイト（メーカー・購入先・レンタル会社） ─────────

export interface Site {
  id: string;
  name: string;
  kind: "maker" | "shop" | "rental" | "other";
  url: string | null;
  faviconUrl: string | null;
  faviconId: string | null;
  sort: number;
}

export async function loadSites(sql: Sql): Promise<Site[]> {
  const rows = await sql<{ id: string; name: string; kind: Site["kind"]; url: string | null; favicon_id: string | null; path: string | null; sort: number }[]>`
    select s.id, s.name, s.kind, s.url, s.favicon_id, m.path, s.sort
    from public.sites s left join public.media m on m.id = s.favicon_id
    order by s.kind, s.sort, s.name`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    url: r.url,
    faviconId: r.favicon_id,
    faviconUrl: r.path ? mediaUrl(r.path) : null,
    sort: r.sort,
  }));
}

// ───────── 機種 ─────────

type ProductRow = {
  id: string;
  slug: string;
  category_id: string;
  category_name: string;
  brand_id: string;
  brand_name: string;
  name: string;
  subtitle: string | null;
  release_date: string | null;
  status: ProductStatus;
  verified: boolean;
  body_color: string;
  uses: string[];
  listing_match: string | null;
  updated_at: string;
  content: DeviceContent | null;
  sources: Source[];
  specs: { key: string; label: string; unit: string | null; icon: string | null; highlight: boolean; filterable: boolean; value: SpecValue; display: string | null; plain: string | null; sort: number }[];
  variants: { code: string; label: string; attrs: Record<string, SpecValue>; official_price: number | null; note: string | null }[];
  images: { media_id: string; path: string; width: number | null; height: number | null; alt: string; credit: string | null }[];
  rentals: RentalRow[];
};

/** 機種に対応づいた掲載商品（loadProducts の副問い合わせ） */
export type RentalRow = {
  company_id: string;
  company_name: string;
  external_id: string;
  url: string;
  title: string;
  config_id: string | null;
  cpu: string | null;
  memory_gb: number | null;
  storage_gb: number | null;
  condition: RentalListingData["condition"];
  office_included: boolean | null;
  in_stock: boolean | null;
  price_tax: RentalListingData["priceTax"];
  terms: string | null;
  fetched_at: string;
  prices: RentalPriceData[];
};

/**
 * 掲載商品 → 比較用の 1 件。月額の表記が無いもの（短期の合計額だけ等）は比較できないので null。
 * 1 か月の「期間合計」は 1 か月分の月額として扱う（同じ金額なので）。
 */
export function toRentalOffer(r: RentalRow): RentalOffer | null {
  const plans = r.prices
    .filter((p) => p.termUnit === "month" && (p.basis === "per_month" || p.termValue === 1))
    .map((p) => ({ months: p.termValue, monthly: p.priceYen, label: p.label }))
    .sort((a, b) => a.months - b.months);
  if (!plans.length) return null;
  const best = plans.reduce((a, b) => (b.monthly < a.monthly ? b : a));
  const days = r.prices.filter((p) => p.termUnit === "day").map((p) => p.termValue);
  const minTerm = days.length ? `${Math.min(...days)}日〜` : `${plans[0].months}か月〜`;
  return {
    key: `${r.company_id}:${r.external_id}`,
    companyId: r.company_id,
    companyName: r.company_name,
    url: r.url,
    title: r.title,
    configId: r.config_id,
    cpu: r.cpu,
    memoryGb: r.memory_gb,
    storageGb: r.storage_gb,
    condition: r.condition,
    officeIncluded: r.office_included,
    inStock: r.in_stock,
    priceTax: r.price_tax,
    monthly: best.monthly,
    monthlyTerm: best.months,
    monthlyCompare: toCompare(best.monthly, r.price_tax),
    plans,
    minTerm,
    terms: r.terms,
    fetchedAt: r.fetched_at,
  };
}

/** 同じ会社が同じ仕様・同じ月額で複数掲載しているもの（色違い等）は 1 件にまとめる */
export function dedupeOffers(offers: RentalOffer[]): RentalOffer[] {
  const seen = new Map<string, RentalOffer>();
  for (const o of offers) {
    const k = [o.companyId, o.configId, o.memoryGb, o.storageGb, o.cpu, o.monthly].join("|");
    if (!seen.has(k)) seen.set(k, o);
  }
  return [...seen.values()];
}

export function toDevice(r: ProductRow): Device {
  const specs: DeviceSpec[] = r.specs.map((s) => ({
    key: s.key,
    label: s.label,
    unit: s.unit,
    icon: s.icon,
    highlight: s.highlight,
    filterable: s.filterable,
    value: s.value,
    display: s.display?.trim() || formatSpec(s.value, s.unit),
    plain: s.plain?.trim() || null,
  }));
  const images: DeviceImage[] = r.images.map((m) => ({
    mediaId: m.media_id,
    src: mediaUrl(m.path),
    width: m.width ?? 1600,
    height: m.height ?? 1000,
    alt: m.alt || r.name,
    credit: m.credit ?? "",
  }));
  const rentals = dedupeOffers(r.rentals.flatMap((x) => toRentalOffer(x) ?? [])).sort((a, b) => a.monthlyCompare - b.monthlyCompare);
  const updatedAt = [r.updated_at.slice(0, 10), ...rentals.map((o) => o.fetchedAt)].sort().at(-1)!;
  return {
    id: r.id,
    slug: r.slug,
    categoryId: r.category_id,
    categoryName: r.category_name,
    brandId: r.brand_id,
    brand: r.brand_name,
    name: r.name,
    subtitle: r.subtitle ?? "",
    releaseDate: r.release_date ?? undefined,
    status: r.status,
    uses: r.uses as Use[],
    configs: r.variants.map((v) => ({
      id: v.code,
      label: v.label,
      attrs: v.attrs,
      officialPrice: v.official_price ?? undefined,
      note: v.note ?? undefined,
    })),
    rentals,
    updatedAt,
    listingMatch: r.listing_match,
    verified: r.verified,
    specs,
    content: r.content ?? undefined,
    sources: r.sources,
    bodyColor: r.body_color,
    images,
  };
}

/** 機種一覧（スペック・構成・画像つき）。statuses 省略時は公開中のみ */
export async function loadProducts(sql: Sql, opts: { statuses?: ProductStatus[]; slug?: string; id?: string } = {}): Promise<Device[]> {
  const statuses = opts.statuses ?? ["published"];
  const rows = await sql<ProductRow[]>`
    select p.id, p.slug, p.category_id, c.name as category_name, p.brand_id, b.name as brand_name, p.name, p.subtitle,
      p.release_date::text as release_date, p.status, p.verified, p.body_color, p.uses, p.listing_match, p.updated_at::text as updated_at, p.content, p.sources,
      coalesce((select json_agg(json_build_object('key', a.key, 'label', a.label, 'unit', a.unit, 'icon', a.icon,
                  'highlight', a.highlight, 'filterable', a.filterable, 'value', ps.value, 'display', ps.display,
                  'plain', ps.plain, 'sort', a.sort) order by a.sort, a.key)
                from public.product_specs ps join public.spec_attributes a on a.id = ps.attribute_id
                where ps.product_id = p.id), '[]') as specs,
      coalesce((select json_agg(json_build_object('code', v.code, 'label', v.label, 'attrs', v.attrs,
                  'official_price', v.official_price, 'note', v.note) order by v.sort, v.code)
                from public.product_variants v where v.product_id = p.id), '[]') as variants,
      coalesce((select json_agg(json_build_object('media_id', m.id, 'path', m.path, 'width', m.width, 'height', m.height,
                  'alt', m.alt, 'credit', m.credit) order by pm.sort, m.created_at)
                from public.product_media pm join public.media m on m.id = pm.media_id
                where pm.product_id = p.id), '[]') as images,
      coalesce((select json_agg(json_build_object('company_id', l.company_id, 'company_name', rc.name, 'external_id', l.external_id,
                  'url', l.url, 'title', l.title, 'config_id', l.config_id, 'cpu', l.cpu, 'memory_gb', l.memory_gb,
                  'storage_gb', l.storage_gb, 'condition', l.condition, 'office_included', l.office_included,
                  'in_stock', l.in_stock, 'price_tax', l.price_tax, 'terms', l.terms, 'fetched_at', l.fetched_at::text,
                  'prices', coalesce((select json_agg(json_build_object('termUnit', rp.term_unit, 'termValue', rp.term_value,
                              'priceYen', rp.price_yen, 'basis', rp.basis, 'label', rp.label) order by rp.term_unit, rp.term_value)
                            from public.rental_prices rp where rp.listing_id = l.id), '[]')) order by l.company_id, l.external_id)
                from public.rental_listings l join public.rental_companies rc on rc.id = l.company_id
                where l.active and l.device_slug = p.slug), '[]') as rentals
    from public.products p
    join public.categories c on c.id = p.category_id
    join public.sites b on b.id = p.brand_id
    where p.status = any(${statuses}::public.product_status[])
      ${opts.slug ? sql`and p.slug = ${opts.slug}` : sql``}
      ${opts.id ? sql`and p.id = ${opts.id}` : sql``}
    order by p.sort, p.created_at`;
  return rows.map(toDevice);
}
