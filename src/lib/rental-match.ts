import type { Sql } from "./db";
import type { SpecValue } from "./types";

/**
 * レンタル会社の掲載商品 → カタログの機種・構成の対応づけ。
 * 機種ごとの正規表現（products.listing_match）を「メーカー＋型番＋タイトル」に当てる。
 * 世代違いを混ぜないよう、正規表現は世代まで書く（迷ったら対応づけない）。
 */

export interface MatchProduct {
  slug: string;
  listingMatch: string;
  variants: { code: string; attrs: Record<string, SpecValue> }[];
}

export interface MatchListing {
  maker: string | null;
  model: string | null;
  title: string;
  memoryGb: number | null;
  storageGb: number | null;
}

export const listingText = (l: Pick<MatchListing, "maker" | "model" | "title">) =>
  [l.maker, l.model, l.title].filter(Boolean).join(" ").normalize("NFKC");

/** 正規表現として正しいか（管理画面の入力チェック用）。正しくなければエラーメッセージ */
export function checkPattern(src: string): string | null {
  try {
    new RegExp(src, "i");
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "正規表現が正しくありません";
  }
}

const compile = (src: string) => {
  try {
    return new RegExp(src, "i");
  } catch {
    return null;
  }
};

/** 構成：メモリ・ストレージが一致するもの。ストレージの記載が無ければメモリだけで 1 つに決まるときだけ */
export function matchVariant(p: Pick<MatchProduct, "variants">, l: Pick<MatchListing, "memoryGb" | "storageGb">): string | null {
  if (p.variants.length === 1 && !Object.keys(p.variants[0].attrs).length) return p.variants[0].code;
  if (l.memoryGb == null) return null;
  const sameMem = p.variants.filter((v) => Number(v.attrs.memory_gb) === l.memoryGb);
  if (l.storageGb != null) return sameMem.find((v) => Number(v.attrs.storage_gb) === l.storageGb)?.code ?? null;
  return sameMem.length === 1 ? sameMem[0].code : null;
}

/** 当てはまる機種が 2 つ以上なら対応づけない（正規表現が広すぎるので管理画面で直す） */
export function matchListing(products: MatchProduct[], l: MatchListing): { deviceSlug: string | null; configId: string | null; ambiguous: string[] } {
  const text = listingText(l);
  const hits = products.filter((p) => compile(p.listingMatch)?.test(text));
  if (hits.length !== 1) return { deviceSlug: null, configId: null, ambiguous: hits.length > 1 ? hits.map((h) => h.slug) : [] };
  return { deviceSlug: hits[0].slug, configId: matchVariant(hits[0], l), ambiguous: [] };
}

/**
 * 掲載中の商品をすべて対応づけ直す（手で決めたもの match_manual は除く）。
 * 取り込み（rentals:import）・機種の保存・掲載商品の画面から呼ぶ。
 */
export async function rematchListings(sql: Sql): Promise<{ matched: number; changed: number; ambiguous: { title: string; slugs: string[] }[] }> {
  const products = await sql<{ slug: string; listing_match: string; variants: MatchProduct["variants"] }[]>`
    select p.slug, p.listing_match,
      coalesce((select json_agg(json_build_object('code', v.code, 'attrs', v.attrs) order by v.sort, v.code)
                from public.product_variants v where v.product_id = p.id), '[]') as variants
    from public.products p
    where p.status <> 'archived' and coalesce(p.listing_match, '') <> ''`;
  const list: MatchProduct[] = products.map((p) => ({ slug: p.slug, listingMatch: p.listing_match, variants: p.variants }));
  const rows = await sql<{ id: string; maker: string | null; model: string | null; title: string; memory_gb: number | null; storage_gb: number | null; device_slug: string | null; config_id: string | null }[]>`
    select id, maker, model, title, memory_gb, storage_gb, device_slug, config_id
    from public.rental_listings where active and not match_manual`;
  let matched = 0;
  let changed = 0;
  const ambiguous: { title: string; slugs: string[] }[] = [];
  for (const r of rows) {
    const m = matchListing(list, { maker: r.maker, model: r.model, title: r.title, memoryGb: r.memory_gb, storageGb: r.storage_gb });
    if (m.ambiguous.length) ambiguous.push({ title: r.title, slugs: m.ambiguous });
    if (m.deviceSlug) matched++;
    if (m.deviceSlug !== r.device_slug || m.configId !== r.config_id) {
      await sql`update public.rental_listings set device_slug = ${m.deviceSlug}, config_id = ${m.configId}, updated_at = now() where id = ${r.id}`;
      changed++;
    }
  }
  return { matched, changed, ambiguous };
}
