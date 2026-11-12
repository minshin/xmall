/**
 * レンタル会社の掲載商品（rental_listings、実データ）から、複数社が扱っている機種をカタログに登録する。
 *
 *   npm run catalog:from-rentals              何が作られるかを表示するだけ（DB は変えない）
 *   npm run catalog:from-rentals -- --apply   登録する（同じ slug の機種が既にあれば飛ばす）
 *   --min-companies=2                          何社以上が掲載している機種を登録するか（既定 2）
 *
 * 方針（CLAUDE.md の原則 2・7）：
 *   * 機種は「世代まで特定できる型番」でまとめる（例：ProBook 450 G9）。世代違いを混ぜない。
 *   * スペックは掲載ページに書かれている値だけ（CPU・メモリ・ストレージ・OS）。画面サイズ等は推測しない。
 *     メーカーの仕様で確認したら管理画面で追記し、verified を付ける。
 *   * 出典として各社の掲載ページを sources に入れる。
 *   * 構成は掲載にあるメモリ×ストレージの組み合わせ。メーカー価格は入れない（中古・旧機種で直販が無いため）。
 *
 * 登録したあとは rematchListings で掲載商品を対応づけ直す。
 */
import postgres from "postgres";
import { listingText, rematchListings } from "../src/lib/rental-match";

interface Family {
  slug: string;
  brandId: string;
  name: string;
  /** listing_match に入れる正規表現（JavaScript, i） */
  match: string;
}

/** 実在の掲載（2026-11 取得）を型番でまとめたもの。増やすときは世代まで書くこと */
const FAMILIES: Family[] = [
  { slug: "probook-450-g6", brandId: "hp", name: "ProBook 450 G6", match: "ProBook ?450 ?G6\\b" },
  { slug: "probook-450-g8", brandId: "hp", name: "ProBook 450 G8", match: "ProBook ?450 ?G8\\b" },
  { slug: "probook-450-g9", brandId: "hp", name: "ProBook 450 G9", match: "ProBook ?450 ?G9\\b" },
  { slug: "probook-450-g10", brandId: "hp", name: "ProBook 450 G10", match: "ProBook ?450 ?G10\\b" },
  { slug: "probook-650-g4", brandId: "hp", name: "ProBook 650 G4", match: "ProBook ?650 ?G4\\b" },
  { slug: "probook-650-g5", brandId: "hp", name: "ProBook 650 G5", match: "ProBook ?650 ?G5\\b" },
  { slug: "elitebook-830-g6", brandId: "hp", name: "EliteBook 830 G6", match: "EliteBook ?830 ?G6\\b" },
  { slug: "elitebook-630-g10", brandId: "hp", name: "EliteBook 630 G10", match: "EliteBook ?630 ?G10\\b" },
  { slug: "hp-250-g7", brandId: "hp", name: "HP 250 G7", match: "HP ?250 ?G7\\b" },
  { slug: "hp-250-g8", brandId: "hp", name: "HP 250 G8", match: "HP ?250 ?G8\\b" },
  { slug: "latitude-3500", brandId: "dell", name: "Latitude 3500", match: "Latitude ?3500\\b" },
  { slug: "latitude-3510", brandId: "dell", name: "Latitude 3510", match: "Latitude ?3510\\b" },
  { slug: "latitude-3550", brandId: "dell", name: "Latitude 3550", match: "Latitude ?3550\\b" },
  { slug: "latitude-5300", brandId: "dell", name: "Latitude 5300", match: "Latitude ?(Latitude ?)?5300\\b" },
  { slug: "latitude-5320", brandId: "dell", name: "Latitude 5320", match: "Latitude ?5320\\b" },
  { slug: "latitude-5330", brandId: "dell", name: "Latitude 5330", match: "Latitude ?5330\\b" },
  { slug: "thinkpad-e15-gen2", brandId: "lenovo", name: "ThinkPad E15 Gen 2", match: "ThinkPad ?E15 ?Gen ?2\\b" },
  { slug: "thinkpad-e16-gen2", brandId: "lenovo", name: "ThinkPad E16 Gen 2", match: "ThinkPad ?E16 ?Gen ?2\\b" },
  { slug: "thinkpad-l15-gen1", brandId: "lenovo", name: "ThinkPad L15 Gen 1", match: "ThinkPad ?L15 ?Gen ?1\\b" },
  { slug: "thinkpad-l580", brandId: "lenovo", name: "ThinkPad L580", match: "ThinkPad ?L580\\b" },
  { slug: "thinkpad-l590", brandId: "lenovo", name: "ThinkPad L590", match: "ThinkPad ?L590\\b" },
  { slug: "thinkpad-x13-gen1", brandId: "lenovo", name: "ThinkPad X13 Gen 1", match: "ThinkPad ?X13 ?Gen ?1\\b" },
  { slug: "thinkpad-x280", brandId: "lenovo", name: "ThinkPad X280", match: "ThinkPad ?X280\\b" },
  { slug: "lets-note-sv9", brandId: "panasonic", name: "Let's note SV9", match: "CF-?SV9|Let.?s ?note ?SV9\\b" },
  { slug: "lets-note-sv7", brandId: "panasonic", name: "Let's note SV7", match: "CF-?SV7|Let.?s ?note ?SV7\\b" },
  { slug: "lets-note-lv9", brandId: "panasonic", name: "Let's note LV9", match: "CF-?LV9|Let.?s ?note ?LV9\\b" },
  { slug: "lifebook-a5510", brandId: "fujitsu", name: "LIFEBOOK A5510", match: "LIFEBOOK ?A5510\\b" },
  { slug: "lifebook-u9310", brandId: "fujitsu", name: "LIFEBOOK U9310", match: "LIFEBOOK ?U9310\\b" },
  { slug: "lifebook-u939", brandId: "fujitsu", name: "LIFEBOOK U939", match: "LIFEBOOK ?U939\\b" },
  { slug: "lifebook-a579", brandId: "fujitsu", name: "LIFEBOOK A579", match: "(LIFEBOOK ?|FMV-?)A579\\b" },
  { slug: "dynabook-g83-hs", brandId: "dynabook", name: "dynabook G83/HS", match: "dynabook ?G83/HS\\b" },
  { slug: "dynabook-b65-ep", brandId: "dynabook", name: "dynabook B65/EP", match: "dynabook ?B65/EP\\b" },
  { slug: "dynabook-b65-er", brandId: "dynabook", name: "dynabook B65/ER", match: "dynabook ?B65/ER\\b" },
  { slug: "dynabook-b65-ds", brandId: "dynabook", name: "dynabook B65/DS", match: "dynabook ?B65/DS\\b" },
];

type Listing = {
  company_id: string;
  company_name: string;
  url: string;
  title: string;
  maker: string | null;
  model: string | null;
  cpu: string | null;
  memory_gb: number | null;
  storage_gb: number | null;
  os: string | null;
  fetched_at: string;
};

const cap = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);
const code = (mem: number, sto: number) => `${mem}-${sto >= 1024 ? `${sto / 1024}t` : sto}`;

/** CPU の系統（spec_attributes cpu_family の選択肢）。掲載の記載が全部同じ系統のときだけ */
function cpuFamily(cpus: string[]): string | null {
  const fam = new Set(
    cpus.map((c) => (/Core ?Ultra/i.test(c) ? "Intel Core Ultra" : /Core ?i\d|Core-i\d|Corei\d/i.test(c) ? "Intel Core i" : /Ryzen/i.test(c) ? "AMD Ryzen" : "?")),
  );
  return fam.size === 1 && !fam.has("?") ? [...fam][0] : null;
}

/** 名前の下に出す CPU のグレード（例：Core i5／i7）。掲載に書かれたものだけ */
function cpuGrades(texts: string[]): string {
  const g = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/(?:Core[ -]?)(i[3579])|Ryzen ?([3579])/gi)) g.add(m[1] ? m[1].toLowerCase() : `Ryzen ${m[2]}`);
  const core = [...g].filter((x) => x.startsWith("i")).sort();
  const ryzen = [...g].filter((x) => x.startsWith("Ryzen")).sort();
  return [core.length ? `Core ${core.join("／")}` : "", ryzen.join("／")].filter(Boolean).join("・");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません");
  const apply = process.argv.includes("--apply");
  const minCompanies = Number(process.argv.find((a) => a.startsWith("--min-companies="))?.split("=")[1] ?? 2);
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const listings = await sql<Listing[]>`
      select l.company_id, c.name as company_name, l.url, l.title, l.maker, l.model, l.cpu, l.memory_gb, l.storage_gb, l.os,
        l.fetched_at::text as fetched_at
      from public.rental_listings l join public.rental_companies c on c.id = l.company_id
      where l.active and exists (select 1 from public.rental_prices p where p.listing_id = l.id and p.term_unit = 'month')`;
    const existing = new Set((await sql<{ slug: string }[]>`select slug from public.products`).map((r) => r.slug));
    const brands = new Set((await sql<{ id: string }[]>`select id from public.sites where kind = 'maker'`).map((r) => r.id));
    const attrs = new Map((await sql<{ id: string; key: string }[]>`select id, key from public.spec_attributes where category_id = 'laptop'`).map((a) => [a.key, a.id]));
    const [{ max: sortBase }] = await sql<{ max: number }[]>`select coalesce(max(sort), 0)::int as max from public.products`;

    let created = 0;
    for (const [i, f] of FAMILIES.entries()) {
      const re = new RegExp(f.match, "i");
      const hits = listings.filter((l) => re.test(listingText(l)));
      const companies = [...new Set(hits.map((h) => h.company_id))];
      const status = existing.has(f.slug) ? "既存" : companies.length < minCompanies ? `${companies.length}社のみ` : !brands.has(f.brandId) ? `メーカー ${f.brandId} が sites に無い` : "登録";
      console.log(`${status.padEnd(8)} ${f.slug.padEnd(20)} 掲載 ${hits.length} 件・${companies.length} 社（${companies.join(", ")}）`);
      if (status !== "登録" || !apply) continue;

      // 構成：メモリ×ストレージ（両方わかる掲載から）
      const combos = new Map<string, { mem: number; sto: number }>();
      for (const h of hits) if (h.memory_gb && h.storage_gb) combos.set(code(h.memory_gb, h.storage_gb), { mem: h.memory_gb, sto: h.storage_gb });
      const variants = [...combos.entries()].sort((a, b) => a[1].mem - b[1].mem || a[1].sto - b[1].sto);

      const cpus = [...new Set(hits.map((h) => h.cpu).filter((c): c is string => !!c))];
      const fam = cpuFamily(cpus);
      const windows = hits.some((h) => /Windows/i.test(`${h.os ?? ""} ${h.title}`));
      const subtitle = cpuGrades([...cpus, ...hits.map((h) => h.title)]);
      const sources = companies.map((cid) => {
        const h = hits.find((x) => x.company_id === cid)!;
        return { title: `${h.company_name}の掲載ページ（CPU・メモリ・ストレージ・OS）`, url: h.url, accessed: h.fetched_at };
      });

      await sql.begin(async (tx) => {
        const [{ id }] = await tx<{ id: string }[]>`
          insert into public.products (slug, category_id, brand_id, name, subtitle, status, verified, uses, listing_match, content, sources, sort)
          values (${f.slug}, 'laptop', ${f.brandId}, ${f.name}, ${subtitle || null}, 'published', false, '{}', ${f.match}, null,
            ${tx.json(sources as never)}, ${sortBase + 10 + i})
          returning id`;
        const specs: [string, unknown, string | null][] = [];
        if (cpus.length) specs.push(["chip", cpus.slice(0, 4).join(" ／ "), null]);
        if (fam) specs.push(["cpu_family", fam, null]);
        if (windows) specs.push(["os", "Windows", null]);
        for (const [key, value, display] of specs) {
          const aid = attrs.get(key);
          if (aid) await tx`insert into public.product_specs (product_id, attribute_id, value, display) values (${id}, ${aid}, ${tx.json(value as never)}, ${display})`;
        }
        if (variants.length) {
          for (const [k, [c, v]] of variants.entries())
            await tx`insert into public.product_variants (product_id, code, label, attrs, sort)
              values (${id}, ${c}, ${`${v.mem}GB / ${cap(v.sto)}`}, ${tx.json({ memory_gb: v.mem, storage_gb: v.sto })}, ${k})`;
        } else {
          await tx`insert into public.product_variants (product_id, code, label, attrs, sort) values (${id}, 'std', '構成は掲載ごとに異なる', '{}', 0)`;
        }
      });
      created++;
    }

    if (apply) {
      const m = await rematchListings(sql);
      console.log(`\n登録 ${created} 機種。掲載商品の対応づけ：${m.matched} 件（変更 ${m.changed} 件）`);
      for (const a of m.ambiguous) console.warn(`  複数の機種に当てはまるため対応づけなし：${a.title} → ${a.slugs.join(", ")}`);
    } else {
      console.log("\n（確認のみ。登録するには --apply）");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
