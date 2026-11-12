/**
 * 購入先・メーカー・レンタル会社のサイトアイコン（favicon）を取得し、Storage（バケット media）に置いて
 * sites.favicon_id に紐づける。ファイルはリポジトリに置かない。
 *
 *   npm run favicons              sites にある全サイト（favicon 未設定のものだけ）
 *   npm run favicons -- --force   設定済みも取り直す
 *
 * 高解像度を優先：apple-touch-icon → rel="icon"（sizes の大きい順）→ /favicon.ico。
 * 取れないサイト（ボット対策で弾かれるなど）は管理画面 /admin/sites から手で登録する。
 */
import postgres from "postgres";
import { uploadMedia } from "../src/lib/storage";

/** sites.url が無い・トップページ以外を見たいときの取得先 */
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

async function fetchIcon(site: string): Promise<{ data: Uint8Array; mime: string } | null> {
  const page = await fetch(site, { headers: { "user-agent": UA, "accept-language": "ja" } });
  const html = page.ok ? await page.text() : "";
  for (const url of candidates(html, page.url || site)) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA } });
      const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
      const buf = new Uint8Array(await r.arrayBuffer());
      if (!r.ok || buf.length < 100 || !EXT[type]) continue;
      return { data: buf, mime: type === "image/vnd.microsoft.icon" ? "image/x-icon" : type };
    } catch {
      /* 次の候補へ */
    }
  }
  return null;
}

async function main() {
  const force = process.argv.includes("--force");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const sites = await sql<{ id: string; name: string; url: string | null; favicon_id: string | null }[]>`
      select id, name, url, favicon_id from public.sites order by kind, sort`;
    for (const s of sites) {
      if (s.favicon_id && !force) continue;
      const from = SITES[s.id] ?? s.url;
      if (!from) continue;
      try {
        const icon = await fetchIcon(from);
        if (!icon) {
          console.log(`${s.id}: 見つからず（管理画面から登録してください）`);
          continue;
        }
        const m = await uploadMedia(sql, { data: icon.data, mime: icon.mime, path: `favicon/${s.id}.${EXT[icon.mime] ?? "png"}`, kind: "favicon", alt: s.name });
        await sql`update public.sites set favicon_id = ${m.id}, updated_at = now() where id = ${s.id}`;
        console.log(`${s.id}: ${m.path}`);
      } catch (e) {
        console.log(`${s.id}: 失敗 ${e instanceof Error ? e.message : e}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
