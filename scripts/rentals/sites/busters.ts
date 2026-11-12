import {
  capacityGb, cpuFromText, dedupePrices, detectMaker, htmlToLines, indexOfLine, links, matchCatalog, pairs, price, today, valueAfter, yen,
  type RentalListingData, type SiteScraper,
} from "../lib";

/** 法パソ（株式会社レンタルバスターズ）：ノートパソコン一覧 /note/ とそのページ送り */
const LIST = "https://pc.rentalbusters.net/note/";

export const busters: SiteScraper = {
  company: {
    id: "rentalbusters",
    name: "法パソ",
    operator: "株式会社レンタルバスターズ",
    url: "https://pc.rentalbusters.net/",
    audience: "business",
    note: "法人向け。価格は 1 台あたりの月額単価（税区分の記載なし）。配送料別。",
  },
  async scrape(ctx) {
    const items = new Set<string>();
    const pages = [LIST];
    for (let i = 0; i < pages.length && i < 10; i++) {
      const html = await ctx.fetchHtml(pages[i]);
      for (const u of links(html, pages[i], /^\/item\/\d+\/?$/)) items.add(u.replace(/\/?$/, "/"));
      for (const p of links(html, pages[i], /^\/note\/page\/\d+\/$/)) if (!pages.includes(p)) pages.push(p);
    }
    const urls = [...items].slice(0, ctx.limit);
    ctx.log(`rentalbusters: ${pages.length} 一覧ページ, ${urls.length} 商品`);
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
  const codeIdx = indexOfLine(lines, /^商品番号[：:]/);
  if (codeIdx < 0) return null;
  const externalId = lines[codeIdx].replace(/^商品番号[：:]\s*/, "");
  const title = lines[codeIdx - 1];

  const tableAt = indexOfLine(lines, "期間", codeIdx);
  const prices =
    tableAt >= 0 && lines[tableAt + 1] === "価格"
      ? dedupePrices(
          pairs(lines, tableAt + 2, (s) => /^~?\s*\d+\s*(ヶ月|年|日)/.test(s), (s) => /^[\d,]+円$/.test(s)).map(([label, v]) =>
            price(label, yen(v)!, "per_month"),
          ),
        )
      : [];

  const specAt = indexOfLine(lines, "主な仕様", codeIdx);
  const spec = (k: string) => (specAt >= 0 ? valueAfter(lines, k, specAt) : null);
  const maker = spec("メーカー");
  const series = spec("シリーズ");
  const modelNo = spec("型番");
  const memoryGb = capacityGb(spec("メモリ"));
  const storageGb = capacityGb(spec("ストレージ"));
  const base = {
    title,
    maker: detectMaker(maker ?? title) ?? maker,
    model: [series, modelNo].filter(Boolean).join(" ") || null,
    memoryGb,
    storageGb,
  };

  return {
    companyId: "rentalbusters",
    externalId,
    url,
    ...base,
    cpu: spec("CPU") ?? cpuFromText(title),
    os: spec("OS"),
    condition: null,
    officeIncluded: false,
    inStock: null,
    priceTax: "unknown",
    terms: "1か月〜2年の料金表。期間が長いほど月額が下がる。配送料別。銀行振込。",
    ...matchCatalog(base),
    prices,
    fetchedAt: today(),
  };
}
