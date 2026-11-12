/**
 * 初期データ（品目以外のカタログ）を DB に入れる（何度実行しても同じ結果になる）。
 *
 *   npm run catalog:seed
 *
 * * サイト（メーカー・購入先・レンタル会社）。favicon は入れない（npm run favicons か管理画面で登録）
 * * 機種：src/data/devices.ts（スペック・構成・解説）。画像は入れない（管理画面か npm run media:import）
 *
 * 画像・favicon などの素材はリポジトリに置かず、Storage と media テーブルだけで管理する。
 *
 * 既に同じ slug の機種がある場合は上書きする。管理画面で編集した内容も上書きされるので、
 * 本番では最初の 1 回だけ使うこと（--only-missing で、まだ無い機種だけ入れる）。
 */
import postgres from "postgres";
import { DEVICES } from "../src/data/devices";
import { BRAND_ID, seedSpecValues } from "../src/lib/seed";

const SITES: { id: string; name: string; kind: "maker" | "shop" | "rental"; url: string }[] = [
  { id: "apple", name: "Apple", kind: "maker", url: "https://www.apple.com/jp/" },
  { id: "lenovo", name: "Lenovo", kind: "maker", url: "https://www.lenovo.com/jp/ja/" },
  { id: "dell", name: "Dell", kind: "maker", url: "https://www.dell.com/ja-jp" },
  { id: "panasonic", name: "Panasonic", kind: "maker", url: "https://panasonic.jp/" },
  { id: "amazon", name: "Amazon", kind: "shop", url: "https://www.amazon.co.jp/" },
  { id: "rakuten", name: "楽天市場", kind: "shop", url: "https://www.rakuten.co.jp/" },
  { id: "yodobashi", name: "ヨドバシ.com", kind: "shop", url: "https://www.yodobashi.com/" },
  { id: "biccamera", name: "ビックカメラ.com", kind: "shop", url: "https://www.biccamera.com/" },
  { id: "rentio", name: "Rentio（レンティオ）", kind: "rental", url: "https://www.rentio.jp/" },
  { id: "tamaya", name: "e-TAMAYA", kind: "rental", url: "https://www.e-tamaya.co.jp/" },
  { id: "rentalbusters", name: "法パソ", kind: "rental", url: "https://pc.rentalbusters.net/" },
  { id: "rentalmarket", name: "レンタルマーケット（法人向け）", kind: "rental", url: "https://www.rentalmarket-houjin.jp/" },
  { id: "inversenet", name: "インバースネット", kind: "rental", url: "https://www.inversenet.co.jp/" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません");
  const onlyMissing = process.argv.includes("--only-missing");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    // サイト（favicon は既存のものを残す）
    for (const [i, s] of SITES.entries()) {
      await sql`
        insert into public.sites (id, name, kind, url, sort) values (${s.id}, ${s.name}, ${s.kind}, ${s.url}, ${i})
        on conflict (id) do update set name = excluded.name, kind = excluded.kind, url = excluded.url, updated_at = now()`;
    }
    console.log(`サイト ${SITES.length} 件`);

    // 機種
    const attrs = await sql<{ id: string; key: string }[]>`select id, key from public.spec_attributes where category_id = 'laptop'`;
    const attrId = new Map(attrs.map((a) => [a.key, a.id]));
    let n = 0;
    for (const [i, d] of DEVICES.entries()) {
      const exists = (await sql`select 1 from public.products where slug = ${d.slug}`).length > 0;
      if (onlyMissing && exists) continue;
      const { specs: _s, ...content } = d.content ?? ({} as NonNullable<typeof d.content>);
      void _s;
      await sql.begin(async (tx) => {
        const [{ id }] = await tx<{ id: string }[]>`
          insert into public.products (slug, category_id, brand_id, name, subtitle, release_date, status, verified, body_color, uses,
            supplier_ids, content, sources, sort)
          values (${d.slug}, ${d.category}, ${BRAND_ID[d.brand]}, ${d.name}, ${d.chip}, ${d.releaseDate ?? null}, 'published',
            ${d.verified}, ${d.bodyColor}, ${d.uses}, ${d.suppliers}, ${d.content ? tx.json(content as never) : null},
            ${tx.json(d.sources as never)}, ${i})
          on conflict (slug) do update set category_id = excluded.category_id, brand_id = excluded.brand_id, name = excluded.name,
            subtitle = excluded.subtitle, release_date = excluded.release_date, verified = excluded.verified,
            body_color = excluded.body_color, uses = excluded.uses, supplier_ids = excluded.supplier_ids, content = excluded.content,
            sources = excluded.sources, sort = excluded.sort, updated_at = now()
          returning id`;
        await tx`delete from public.product_specs where product_id = ${id}`;
        for (const [key, v] of seedSpecValues(d)) {
          const aid = attrId.get(key);
          if (!aid) continue;
          await tx`insert into public.product_specs (product_id, attribute_id, value, display, plain)
            values (${id}, ${aid}, ${tx.json(v.value as never)}, ${v.display ?? null}, ${v.plain ?? null})`;
        }
        await tx`delete from public.product_variants where product_id = ${id}`;
        for (const [k, c] of d.configs.entries()) {
          await tx`insert into public.product_variants (product_id, code, label, attrs, official_price, rent_base, note, sort)
            values (${id}, ${c.id}, ${c.label}, ${tx.json({ memory_gb: c.memoryGb, storage_gb: c.storageGb })}, ${c.officialPrice ?? null},
              ${c.rentBase}, ${c.note ?? null}, ${k})`;
        }
      });
      n++;
    }
    console.log(`機種 ${n} 件を投入`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
