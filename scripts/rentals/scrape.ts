/**
 * 実在レンタル会社の公開ページからノートPCの掲載価格を取得し、
 * supabase/data/rental-listings.json に書き出す（DB への投入は import.ts）。
 *
 *   npm run rentals:scrape                 全社
 *   npm run rentals:scrape -- tamaya rentio   指定した会社だけ（他社の既存データは残す）
 *   npm run rentals:scrape -- --limit 3       各社 3 商品まで（動作確認用）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DATA_FILE, SITES, type RentalDataFile } from "./config";
import { createContext } from "./lib";

async function main() {
  const args = process.argv.slice(2);
  const li = args.indexOf("--limit");
  const limit = li >= 0 ? Number(args[li + 1]) : undefined;
  const only = args.filter((a, i) => !a.startsWith("--") && (li < 0 || i !== li + 1));
  const targets = only.length ? SITES.filter((s) => only.includes(s.company.id)) : SITES;
  if (!targets.length) throw new Error(`会社 id が不明です。使える id: ${SITES.map((s) => s.company.id).join(", ")}`);

  const prev: RentalDataFile = existsSync(DATA_FILE)
    ? JSON.parse(readFileSync(DATA_FILE, "utf8"))
    : { generatedAt: "", companies: [], listings: [] };
  const ctx = createContext({ limit });

  let listings = prev.listings.filter((l) => !targets.some((t) => t.company.id === l.companyId));
  for (const site of targets) {
    try {
      const got = await site.scrape(ctx);
      const priced = got.filter((l) => l.prices.length > 0);
      for (const l of got) if (!l.prices.length) ctx.log(`  価格を読み取れないため除外: ${l.url}`);
      listings = listings.concat(priced);
      ctx.log(`${site.company.id}: ${priced.length} 件`);
    } catch (e) {
      // 取得に失敗した会社は前回のデータを残す
      ctx.log(`${site.company.id}: 失敗（前回のデータを保持） ${e instanceof Error ? e.message : e}`);
      listings = listings.concat(prev.listings.filter((l) => l.companyId === site.company.id));
    }
  }

  const companies = SITES.map((s) => s.company).filter((c) => listings.some((l) => l.companyId === c.id));
  listings.sort((a, b) => a.companyId.localeCompare(b.companyId) || a.externalId.localeCompare(b.externalId, "ja", { numeric: true }));
  const out: RentalDataFile = { generatedAt: new Date().toISOString(), companies, listings };
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(out, null, 2) + "\n");
  const matched = listings.filter((l) => l.deviceSlug).length;
  console.log(`書き出し: ${DATA_FILE}\n  会社 ${companies.length} / 商品 ${listings.length}（カタログ機種に対応 ${matched}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
