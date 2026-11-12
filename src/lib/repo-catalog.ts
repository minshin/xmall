import type { Sql } from "./db";
import { mediaUrl } from "./media";
import { formatSpec } from "./seed";
import type {
  Category, Device, DeviceContent, DeviceImage, DeviceSpec, ProductStatus, Source, SpecAttribute, SpecValue, Use,
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
  supplier_ids: string[];
  content: DeviceContent | null;
  sources: Source[];
  specs: { key: string; label: string; unit: string | null; icon: string | null; highlight: boolean; filterable: boolean; value: SpecValue; display: string | null; plain: string | null; sort: number }[];
  variants: { code: string; label: string; attrs: Record<string, SpecValue>; official_price: number | null; rent_base: number; note: string | null }[];
  images: { media_id: string; path: string; width: number | null; height: number | null; alt: string; credit: string | null }[];
};

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
      rentBase: v.rent_base,
      note: v.note ?? undefined,
    })),
    suppliers: r.supplier_ids,
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
      p.release_date::text as release_date, p.status, p.verified, p.body_color, p.uses, p.supplier_ids, p.content, p.sources,
      coalesce((select json_agg(json_build_object('key', a.key, 'label', a.label, 'unit', a.unit, 'icon', a.icon,
                  'highlight', a.highlight, 'filterable', a.filterable, 'value', ps.value, 'display', ps.display,
                  'plain', ps.plain, 'sort', a.sort) order by a.sort, a.key)
                from public.product_specs ps join public.spec_attributes a on a.id = ps.attribute_id
                where ps.product_id = p.id), '[]') as specs,
      coalesce((select json_agg(json_build_object('code', v.code, 'label', v.label, 'attrs', v.attrs,
                  'official_price', v.official_price, 'rent_base', v.rent_base, 'note', v.note) order by v.sort, v.code)
                from public.product_variants v where v.product_id = p.id), '[]') as variants,
      coalesce((select json_agg(json_build_object('media_id', m.id, 'path', m.path, 'width', m.width, 'height', m.height,
                  'alt', m.alt, 'credit', m.credit) order by pm.sort, m.created_at)
                from public.product_media pm join public.media m on m.id = pm.media_id
                where pm.product_id = p.id), '[]') as images
    from public.products p
    join public.categories c on c.id = p.category_id
    join public.sites b on b.id = p.brand_id
    where p.status = any(${statuses}::public.product_status[])
      ${opts.slug ? sql`and p.slug = ${opts.slug}` : sql``}
      ${opts.id ? sql`and p.id = ${opts.id}` : sql``}
    order by p.sort, p.created_at`;
  return rows.map(toDevice);
}
