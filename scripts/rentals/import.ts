/**
 * supabase/data/rental-listings.json を DB に取り込む。
 *
 *   npm run rentals:import
 *
 * * 会社・商品は (company_id, external_id) で upsert、価格は商品ごとに入れ替え。
 * * JSON に含まれる会社のうち、JSON に無くなった商品は active = false にする（履歴として残す）。
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { importRentalData } from "../../src/lib/repo";
import { DATA_FILE, type RentalDataFile } from "./config";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません（.env.local を読み込んで実行してください）");
  const data: RentalDataFile = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const r = await importRentalData(sql, data);
    console.log(`取り込み完了：会社 ${r.companies} / 商品 ${r.listings}（価格 ${r.prices} 行）/ 掲載終了 ${r.deactivated}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
