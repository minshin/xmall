import {
  capacityGb, cpuFromText, dedupePrices, detectMaker, h1, htmlToLines, indexOfLine, links, pairs, price, today, valueAfter, yen,
  type RentalListingData, type SiteScraper,
} from "../lib";

/** インバースネット：法人向けノートパソコンレンタル（短期は期間合計、3か月以上は月額。税込） */
const LIST = "https://www.inversenet.co.jp/rental/notepc/";

export const inversenet: SiteScraper = {
  company: {
    id: "inversenet",
    name: "インバースネット",
    operator: "インバースネット株式会社",
    url: "https://www.inversenet.co.jp/rental/",
    audience: "business",
    note: "法人向け。税込表示、往復送料無料。「モデル」商品はメーカーを指定しないプラン。",
  },
  async scrape(ctx) {
    const listHtml = await ctx.fetchHtml(LIST);
    const urls = links(listHtml, LIST, /^\/rental\/notepc\/(?!achievement)[\w/-]+\.php$/)
      .filter((u) => !u.endsWith("/index.php"))
      .slice(0, ctx.limit);
    ctx.log(`inversenet: ${urls.length} 商品`);
    const out: RentalListingData[] = [];
    for (const url of urls) {
      try {
        const l = parse(await ctx.fetchHtml(url), url);
        if (l) out.push(l);
      } catch (e) {
        ctx.log(`  skip ${url}: ${e instanceof Error ? e.message : e}`);
      }
    }
    return out;
  },
};

export function parse(html: string, url: string): RentalListingData | null {
  const lines = htmlToLines(html);
  // 料金表の見出し「○○レンタル料金」を基準にする（下の「おすすめ」欄には他商品の注文番号が並ぶため）
  const head = indexOfLine(lines, /レンタル料金$/);
  if (head < 0) return null;
  const codeIdx = lines.slice(0, head).findIndex((s) => /注文番号[：:]/.test(s));
  const externalId =
    (codeIdx >= 0 ? lines[codeIdx].match(/注文番号[：:]\s*([\w-]+)/)?.[1] : null) ??
    new URL(url).pathname.replace(/^\/rental\/notepc\//, "").replace(/\.php$/, "");
  const title = (h1(html) ?? lines[head].replace(/レンタル料金$/, "")).replace(/^法人向け\s*/, "");

  const isLabel = (s: string) => /^\d+\s*(日間|[ヵヶか]月)$/.test(s);
  const isValue = (s: string) => /^[\d,]+(円)?$/.test(s);
  let prices;
  const colAt = indexOfLine(lines, "期間", head);
  if (colAt >= 0 && colAt < head + 4) {
    // 縦並び：期間の列 → 「価格（月額）」→ 価格の列
    let i = colAt + 1;
    const labels: string[] = [];
    while (i < lines.length && isLabel(lines[i])) labels.push(lines[i++]);
    const perMonth = /月額/.test(lines[i] ?? "");
    i++;
    const values: string[] = [];
    while (i < lines.length && isValue(lines[i]) && values.length < labels.length) values.push(lines[i++]);
    prices = values.length === labels.length ? labels.map((l, k) => price(l, yen(values[k])!, perMonth ? "per_month" : "total")) : [];
  } else {
    const shortAt = indexOfLine(lines, "短期レンタル", head);
    const longAt = indexOfLine(lines, /長期レンタル[(（]月額[)）]/, head);
    prices = [
      ...(shortAt >= 0 && shortAt < head + 5 ? pairs(lines, shortAt + 1, isLabel, isValue).map(([l, v]) => price(l, yen(v)!, "total")) : []),
      ...(longAt >= 0 && longAt < head + 20 ? pairs(lines, longAt + 1, isLabel, isValue).map(([l, v]) => price(l, yen(v)!, "per_month")) : []),
    ];
  }
  const deduped = dedupePrices(prices);
  const taxIncl = lines.some((s) => s.includes("税込価格"));

  const specAt = indexOfLine(lines, /のスペック$/, head);
  const spec = (k: string) => (specAt >= 0 ? valueAfter(lines, k, specAt) : null);
  const memoryGb = capacityGb(spec("メモリ"));
  const storageGb = capacityGb(spec("SSD") ?? spec("ストレージ"));
  const base = { title, maker: detectMaker(title), model: null, memoryGb, storageGb };

  return {
    companyId: "inversenet",
    externalId,
    url,
    ...base,
    cpu: spec("CPU") ?? cpuFromText(title),
    os: spec("OS"),
    condition: null,
    officeIncluded: false,
    inStock: null,
    priceTax: taxIncl ? "incl" : "unknown",
    terms: "3日から。3か月以上は月額。往復送料無料。",
    // 機種との対応づけは取り込み時に DB の products.listing_match で行う（lib/rental-match.ts）
    deviceSlug: null,
    configId: null,
    prices: deduped,
    fetchedAt: today(),
  };
}
