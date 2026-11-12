/**
 * 購入先・レンタル会社・メーカーのサイトアイコン（favicon）を取得して supabase/seed-assets/favicons/ に保存する。
 * `npm run catalog:seed` で Storage に上がり、sites.favicon_id に紐づく（以後は管理画面 /admin/sites で差し替えられる）。
 *
 *   npm run favicons
 *
 * 高解像度を優先：apple-touch-icon → rel="icon"（sizes の大きい順）→ /favicon.ico。
 * 実行時に外部サービス（Google の favicon API など）を使わないよう、ファイルは自前で配信する。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITES: Record<string, string> = {
  // 購入先
  amazon: "https://www.amazon.co.jp/",
  rakuten: "https://www.rakuten.co.jp/",
  yodobashi: "https://www.yodobashi.com/",
  biccamera: "https://www.biccamera.com/",
  // メーカー（公式ストア）
  apple: "https://www.apple.com/jp/",
  lenovo: "https://www.lenovo.com/jp/ja/",
  dell: "https://www.dell.com/ja-jp",
  panasonic: "https://panasonic.jp/",
  // レンタル会社（scripts/rentals の company id と同じ）
  rentio: "https://www.rentio.jp/",
  tamaya: "https://www.e-tamaya.co.jp/",
  rentalbusters: "https://pc.rentalbusters.net/",
  rentalmarket: "https://www.rentalmarket-houjin.jp/",
  inversenet: "https://www.inversenet.co.jp/",
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const OUT_DIR = resolve(import.meta.dirname, "../supabase/seed-assets/favicons");

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function candidates(html: string, base: string): string[] {
  const out: { href: string; score: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || !/icon/.test(rel) || /mask-icon/.test(rel)) continue;
    const size = Number(tag.match(/sizes=["'](\d+)x\d+["']/i)?.[1] ?? 0);
    const score = (/apple-touch-icon/.test(rel) ? 1000 : 0) + size + (/\.svg/i.test(href) ? 500 : 0);
    out.push({ href: new URL(href.replace(/&amp;/g, "&"), base).toString(), score });
  }
  out.sort((a, b) => b.score - a.score);
  return [...out.map((c) => c.href), new URL("/favicon.ico", base).toString()];
}

async function fetchIcon(id: string, site: string): Promise<string | null> {
  const page = await fetch(site, { headers: { "user-agent": UA, "accept-language": "ja" } });
  const html = page.ok ? await page.text() : "";
  for (const url of candidates(html, page.url || site)) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA } });
      const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok || buf.length < 100 || !EXT[type]) continue;
      const file = `${id}.${EXT[type]}`;
      writeFileSync(resolve(OUT_DIR, file), buf);
      return file;
    } catch {
      /* 次の候補へ */
    }
  }
  return null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const map: Record<string, string> = {};
  for (const [id, site] of Object.entries(SITES)) {
    try {
      const path = await fetchIcon(id, site);
      if (path) map[id] = path;
      console.log(`${id}: ${path ?? "見つからず"}`);
    } catch (e) {
      console.log(`${id}: 失敗 ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`保存先: ${OUT_DIR}（${Object.keys(map).length} 件）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
