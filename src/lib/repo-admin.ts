import type { Sql } from "./db";
import { mediaUrl } from "./media";
import type { DeviceContent, ProductStatus, Source, SpecAttribute, SpecValue } from "./types";

/** 管理画面の書き込み（カタログ）。SQL のみ。権限確認は呼び出し側（Server Action）で行う */

// ───────── 機種 ─────────

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  categoryId: string;
  categoryName: string;
  brandName: string;
  status: ProductStatus;
  verified: boolean;
  variants: number;
  images: number;
  thumb: string | null;
  updatedAt: Date;
}

export async function listProducts(sql: Sql, opts: { q?: string; category?: string; status?: ProductStatus } = {}): Promise<ProductListItem[]> {
  const q = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const rows = await sql<
    { id: string; slug: string; name: string; subtitle: string | null; category_id: string; category_name: string; brand_name: string; status: ProductStatus; verified: boolean; variants: number; images: number; thumb: string | null; updated_at: Date }[]
  >`
    select p.id, p.slug, p.name, p.subtitle, p.category_id, c.name as category_name, b.name as brand_name, p.status, p.verified,
      (select count(*)::int from public.product_variants v where v.product_id = p.id) as variants,
      (select count(*)::int from public.product_media pm where pm.product_id = p.id) as images,
      (select m.path from public.product_media pm join public.media m on m.id = pm.media_id where pm.product_id = p.id order by pm.sort limit 1) as thumb,
      p.updated_at
    from public.products p join public.categories c on c.id = p.category_id join public.sites b on b.id = p.brand_id
    where true
      ${q ? sql`and (p.name ilike ${q} or p.slug ilike ${q} or b.name ilike ${q})` : sql``}
      ${opts.category ? sql`and p.category_id = ${opts.category}` : sql``}
      ${opts.status ? sql`and p.status = ${opts.status}` : sql``}
    order by p.category_id, p.sort, p.created_at`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    categoryId: r.category_id,
    categoryName: r.category_name,
    brandName: r.brand_name,
    status: r.status,
    verified: r.verified,
    variants: r.variants,
    images: r.images,
    thumb: r.thumb ? mediaUrl(r.thumb) : null,
    updatedAt: r.updated_at,
  }));
}

export interface ProductBase {
  slug: string;
  categoryId: string;
  brandId: string;
  name: string;
  subtitle: string | null;
  releaseDate: string | null;
  status: ProductStatus;
  verified: boolean;
  bodyColor: string;
  uses: string[];
  listingMatch: string | null;
}

export async function createProduct(sql: Sql, p: Pick<ProductBase, "slug" | "categoryId" | "brandId" | "name">, userId: string): Promise<string> {
  const [{ id }] = await sql<{ id: string }[]>`
    insert into public.products (slug, category_id, brand_id, name, status, updated_by)
    values (${p.slug}, ${p.categoryId}, ${p.brandId}, ${p.name}, 'draft', ${userId}) returning id`;
  return id;
}

export async function updateProductBase(sql: Sql, id: string, p: ProductBase, userId: string): Promise<void> {
  await sql`
    update public.products set slug = ${p.slug}, category_id = ${p.categoryId}, brand_id = ${p.brandId}, name = ${p.name},
      subtitle = ${p.subtitle}, release_date = ${p.releaseDate}, status = ${p.status}, verified = ${p.verified},
      body_color = ${p.bodyColor}, uses = ${p.uses}, listing_match = ${p.listingMatch}, updated_at = now(), updated_by = ${userId}
    where id = ${id}`;
}

export async function updateProductContent(sql: Sql, id: string, content: DeviceContent | null, sources: Source[], userId: string): Promise<void> {
  await sql`
    update public.products set content = ${content ? sql.json(content as never) : null}, sources = ${sql.json(sources as never)},
      updated_at = now(), updated_by = ${userId}
    where id = ${id}`;
}

export async function deleteProduct(sql: Sql, id: string): Promise<void> {
  await sql`delete from public.products where id = ${id}`;
}

/** 機種の slug（キャッシュ更新・リダイレクト用） */
export async function productSlug(sql: Sql, id: string): Promise<string | null> {
  const [r] = await sql<{ slug: string }[]>`select slug from public.products where id = ${id}`;
  return r?.slug ?? null;
}

// ───────── スペック値・構成 ─────────

export interface SpecInput {
  attributeId: string;
  value: SpecValue | null;
  display: string | null;
  plain: string | null;
}

/** 機種のスペック値をまとめて保存（value が null の項目は削除） */
export async function saveSpecs(sql: Sql, productId: string, specs: SpecInput[], userId: string): Promise<void> {
  await sql.begin(async (tx) => {
    for (const s of specs) {
      if (s.value === null || s.value === "") {
        await tx`delete from public.product_specs where product_id = ${productId} and attribute_id = ${s.attributeId}`;
        continue;
      }
      await tx`
        insert into public.product_specs (product_id, attribute_id, value, display, plain)
        values (${productId}, ${s.attributeId}, ${tx.json(s.value as never)}, ${s.display}, ${s.plain})
        on conflict (product_id, attribute_id) do update set value = excluded.value, display = excluded.display, plain = excluded.plain`;
    }
    await tx`update public.products set updated_at = now(), updated_by = ${userId} where id = ${productId}`;
  });
}

export interface VariantInput {
  code: string;
  label: string;
  attrs: Record<string, SpecValue>;
  officialPrice: number | null;
  note: string | null;
}

/** 構成を丸ごと置き換える（並び順は配列の順） */
export async function saveVariants(sql: Sql, productId: string, variants: VariantInput[], userId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from public.product_variants where product_id = ${productId}`;
    for (const [i, v] of variants.entries()) {
      await tx`
        insert into public.product_variants (product_id, code, label, attrs, official_price, note, sort)
        values (${productId}, ${v.code}, ${v.label}, ${tx.json(v.attrs as never)}, ${v.officialPrice}, ${v.note}, ${i})`;
    }
    await tx`update public.products set updated_at = now(), updated_by = ${userId} where id = ${productId}`;
  });
}

// ───────── 画像 ─────────

export async function attachProductMedia(sql: Sql, productId: string, mediaId: string): Promise<void> {
  await sql`
    insert into public.product_media (product_id, media_id, sort)
    values (${productId}, ${mediaId}, coalesce((select max(sort) + 1 from public.product_media where product_id = ${productId}), 0))
    on conflict do nothing`;
}

export async function detachProductMedia(sql: Sql, productId: string, mediaId: string): Promise<void> {
  await sql`delete from public.product_media where product_id = ${productId} and media_id = ${mediaId}`;
}

/** 画像を前後に動かす（dir = -1 / 1） */
export async function moveProductMedia(sql: Sql, productId: string, mediaId: string, dir: -1 | 1): Promise<void> {
  await sql.begin(async (tx) => {
    const rows = await tx<{ media_id: string }[]>`select media_id from public.product_media where product_id = ${productId} order by sort, media_id`;
    const ids = rows.map((r) => r.media_id);
    const i = ids.indexOf(mediaId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (const [k, mid] of ids.entries()) await tx`update public.product_media set sort = ${k} where product_id = ${productId} and media_id = ${mid}`;
  });
}

export async function updateMediaMeta(sql: Sql, id: string, alt: string, credit: string | null): Promise<void> {
  await sql`update public.media set alt = ${alt}, credit = ${credit} where id = ${id}`;
}

export interface MediaItem {
  id: string;
  url: string;
  path: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  credit: string | null;
  kind: "product" | "favicon" | "other";
  createdAt: Date;
  usedBy: number;
}

export async function listMedia(sql: Sql, opts: { kind?: MediaItem["kind"]; productId?: string; limit?: number } = {}): Promise<MediaItem[]> {
  const rows = await sql<
    { id: string; path: string; mime: string; bytes: number; width: number | null; height: number | null; alt: string; credit: string | null; kind: MediaItem["kind"]; created_at: Date; used_by: number }[]
  >`
    select m.*, (select count(*)::int from public.product_media pm where pm.media_id = m.id)
              + (select count(*)::int from public.sites s where s.favicon_id = m.id) as used_by
    from public.media m
    ${opts.productId ? sql`join public.product_media pm on pm.media_id = m.id and pm.product_id = ${opts.productId}` : sql``}
    where true ${opts.kind ? sql`and m.kind = ${opts.kind}` : sql``}
    order by ${opts.productId ? sql`pm.sort` : sql`m.created_at desc`}
    limit ${opts.limit ?? 200}`;
  return rows.map((r) => ({
    id: r.id,
    url: mediaUrl(r.path),
    path: r.path,
    mime: r.mime,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    alt: r.alt,
    credit: r.credit,
    kind: r.kind,
    createdAt: r.created_at,
    usedBy: r.used_by,
  }));
}

// ───────── 品目・スペック項目 ─────────

export async function upsertCategory(sql: Sql, c: { id: string; name: string; icon: string | null; sort: number }): Promise<void> {
  await sql`
    insert into public.categories (id, name, icon, sort) values (${c.id}, ${c.name}, ${c.icon}, ${c.sort})
    on conflict (id) do update set name = excluded.name, icon = excluded.icon, sort = excluded.sort, updated_at = now()`;
}

/** 使っている機種があれば消さない */
export async function deleteCategory(sql: Sql, id: string): Promise<boolean> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from public.products where category_id = ${id}`;
  if (n > 0) return false;
  await sql`delete from public.categories where id = ${id}`;
  return true;
}

export type AttributeInput = Omit<SpecAttribute, "id">;

export async function upsertAttribute(sql: Sql, id: string | null, a: AttributeInput): Promise<void> {
  if (id) {
    await sql`
      update public.spec_attributes set label = ${a.label}, unit = ${a.unit}, type = ${a.type}, scope = ${a.scope}, options = ${a.options},
        icon = ${a.icon}, filterable = ${a.filterable}, highlight = ${a.highlight}, sort = ${a.sort}
      where id = ${id}`;
  } else {
    await sql`
      insert into public.spec_attributes (category_id, key, label, unit, type, scope, options, icon, filterable, highlight, sort)
      values (${a.categoryId}, ${a.key}, ${a.label}, ${a.unit}, ${a.type}, ${a.scope}, ${a.options}, ${a.icon}, ${a.filterable}, ${a.highlight}, ${a.sort})`;
  }
}

export async function deleteAttribute(sql: Sql, id: string): Promise<void> {
  await sql`delete from public.spec_attributes where id = ${id}`;
}

/** スペック項目ごとの使用数（削除前の確認用） */
export async function attributeUsage(sql: Sql): Promise<Record<string, number>> {
  const rows = await sql<{ attribute_id: string; n: number }[]>`select attribute_id, count(*)::int as n from public.product_specs group by attribute_id`;
  return Object.fromEntries(rows.map((r) => [r.attribute_id, r.n]));
}

// ───────── サイト ─────────

export async function upsertSite(sql: Sql, s: { id: string; name: string; kind: string; url: string | null; sort: number }): Promise<void> {
  await sql`
    insert into public.sites (id, name, kind, url, sort) values (${s.id}, ${s.name}, ${s.kind}, ${s.url}, ${s.sort})
    on conflict (id) do update set name = excluded.name, kind = excluded.kind, url = excluded.url, sort = excluded.sort, updated_at = now()`;
}

export async function setSiteFavicon(sql: Sql, siteId: string, mediaId: string | null): Promise<void> {
  await sql`update public.sites set favicon_id = ${mediaId}, updated_at = now() where id = ${siteId}`;
}

/** メーカーとして機種に使われていれば消さない */
export async function deleteSite(sql: Sql, id: string): Promise<boolean> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from public.products where brand_id = ${id}`;
  if (n > 0) return false;
  await sql`delete from public.sites where id = ${id}`;
  return true;
}

// ───────── 概要 ─────────

export async function catalogCounts(sql: Sql) {
  const [r] = await sql<{ published: number; drafts: number; media: number; categories: number }[]>`
    select (select count(*)::int from public.products where status = 'published') as published,
      (select count(*)::int from public.products where status = 'draft') as drafts,
      (select count(*)::int from public.media) as media,
      (select count(*)::int from public.categories) as categories`;
  return r;
}

// ───────── レンタル会社の掲載商品（対応づけの確認・手での修正） ─────────

export interface AdminListing {
  id: string;
  companyId: string;
  companyName: string;
  url: string;
  title: string;
  memoryGb: number | null;
  storageGb: number | null;
  minMonthly: number | null;
  priceTax: string;
  deviceSlug: string | null;
  configId: string | null;
  matchManual: boolean;
  fetchedAt: string;
}

export type ListingFilter = "unmatched" | "matched" | "manual" | "all";

export async function listRentalListings(sql: Sql, filter: ListingFilter, q = "", limit = 300): Promise<AdminListing[]> {
  const rows = await sql<(Omit<AdminListing, "fetchedAt"> & { fetchedAt: string })[]>`
    select l.id, l.company_id as "companyId", c.name as "companyName", l.url, l.title, l.memory_gb as "memoryGb", l.storage_gb as "storageGb",
      (select min(p.price_yen) from public.rental_prices p where p.listing_id = l.id and p.basis = 'per_month')::int as "minMonthly",
      l.price_tax as "priceTax", l.device_slug as "deviceSlug", l.config_id as "configId", l.match_manual as "matchManual",
      l.fetched_at::text as "fetchedAt"
    from public.rental_listings l join public.rental_companies c on c.id = l.company_id
    where l.active
      ${filter === "unmatched" ? sql`and l.device_slug is null` : filter === "matched" ? sql`and l.device_slug is not null` : filter === "manual" ? sql`and l.match_manual` : sql``}
      ${q ? sql`and (l.title ilike ${"%" + q + "%"} or coalesce(l.device_slug, '') ilike ${"%" + q + "%"})` : sql``}
    order by l.device_slug nulls first, l.company_id, l.title
    limit ${limit}`;
  return [...rows];
}

export async function listingCounts(sql: Sql) {
  const [r] = await sql<{ all: number; matched: number; manual: number }[]>`
    select count(*)::int as all, count(device_slug)::int as matched, count(*) filter (where match_manual)::int as manual
    from public.rental_listings where active`;
  return { ...r, unmatched: r.all - r.matched };
}

/** 手で対応づける（deviceSlug を null にすると「対応なし」で固定）。manual=false で自動に戻す */
export async function setListingMatch(sql: Sql, id: string, m: { deviceSlug: string | null; configId: string | null; manual: boolean }): Promise<void> {
  await sql`
    update public.rental_listings set device_slug = ${m.deviceSlug}, config_id = ${m.configId}, match_manual = ${m.manual}, updated_at = now()
    where id = ${id}`;
}
