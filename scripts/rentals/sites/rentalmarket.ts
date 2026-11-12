import {
  capacityGb, cpuFromText, dedupePrices, detectMaker, htmlToLines, indexOfLine, links, matchCatalog, pairs, price, today, valueAfter, yen,
  type RentalListingData, type SiteScraper,
} from "../lib";

/** レンタルマーケット（法人向け）：ノートパソコン一覧（?page=N） */
const LIST = "https://www.rentalmarket-houjin.jp/service/products/note-pc";

export const rentalmarket: SiteScraper = {
  company: {
    id: "rentalmarket",
    name: "レンタルマーケット（法人向け）",
    operator: null,
    url: "https://www.rentalmarket-houjin.jp/",
    audience: "business",
    note: "法人向け。3日〜1か月は期間合計、3か月以上は月額（税区分の記載なし）。往復送料は別途請求。",
  },
  async scrape(ctx) {
    const items = new Set<string>();
    const pages = [LIST];
    for (let i = 0; i < pages.length && i < 10; i++) {
      const html = await ctx.fetchHtml(pages[i]);
      for (const u of links(html, pages[i], /^\/service\/products\/note-pc\/rmh-\d+$/)) items.add(u);
      for (const p of links(html, pages[i], /^\/service\/products\/note-pc\?page=\d+$/)) if (!pages.includes(p)) pages.push(p);
    }
    const urls = [...items].slice(0, ctx.limit);
    ctx.log(`rentalmarket: ${pages.length} 一覧ページ, ${urls.length} 商品`);
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
  const codeIdx = indexOfLine(lines, /^商品コード[：:]/);
  if (codeIdx < 0) return null;
  const externalId = lines[codeIdx].replace(/^商品コード[：:]\s*/, "");
  const title = lines[codeIdx - 1].replace(/\s*レンタル$/, "");

  const tableAt = indexOfLine(lines, "レンタル期間", codeIdx);
  const prices =
    tableAt >= 0 && lines[tableAt + 1] === "価格"
      ? dedupePrices(
          pairs(lines, tableAt + 2, (s) => /^\d+\s*(日間|ヶ月|年)$/.test(s), (s) => /^[\d,]+円(\/月)?$/.test(s)).map(([label, v]) =>
            price(label, yen(v)!, v.endsWith("/月") ? "per_month" : "total"),
          ),
        )
      : [];

  const specAt = indexOfLine(lines, "商品仕様", codeIdx);
  const spec = (k: string) => (specAt >= 0 ? valueAfter(lines, k, specAt) : null);
  const memoryGb = capacityGb(spec("メモリ"));
  const storageGb = capacityGb(spec("ストレージ"));
  const base = { title, maker: detectMaker(title), model: null, memoryGb, storageGb };

  return {
    companyId: "rentalmarket",
    externalId,
    url,
    ...base,
    cpu: spec("CPU") ?? cpuFromText(title),
    os: spec("OS"),
    condition: null,
    officeIncluded: false,
    inStock: null,
    priceTax: "unknown",
    terms: /長期レンタル/.test(title) ? "長期（2年・3年）契約の月額。" : "3日から。往復の配送料は別途。",
    ...matchCatalog(base),
    prices,
    fetchedAt: today(),
  };
}
