import {
  capacityGb, cpuFromText, dedupePrices, detectMaker, htmlToLines, indexOfLine, links, pairs, price, today, valueAfter, yen,
  type RentalListingData, type SiteScraper,
} from "../lib";

/** e-TAMAYA（株式会社タマヤ）：ノートパソコン マンスリー（1・3・6・9・12か月の月額表） */
const LIST = "https://www.e-tamaya.co.jp/monthly.php";

export const tamaya: SiteScraper = {
  company: {
    id: "tamaya",
    name: "e-TAMAYA",
    operator: "株式会社タマヤ",
    url: "https://www.e-tamaya.co.jp/",
    audience: "business",
    note: "法人向け。料金は税抜表示。Office はオプション。",
  },
  async scrape(ctx) {
    const listHtml = await ctx.fetchHtml(LIST);
    const urls = links(listHtml, LIST, /^\/html\/goods\/pc\/(?!pc_itemlist)[\w-]+\.php$/).slice(0, ctx.limit);
    ctx.log(`tamaya: ${urls.length} 商品`);
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
  const titleLine = lines.slice(codeIdx + 1, codeIdx + 4).find((s) => /】$/.test(s)) ?? lines[codeIdx + 2];
  const title = titleLine.replace(/【[^】]*】/g, "").trim();

  const priceIdx = indexOfLine(lines, /^レンタル料金/, codeIdx);
  const taxLine = priceIdx >= 0 ? lines[priceIdx] : "";
  const prices = dedupePrices(
    pairs(lines, priceIdx + 1, (s) => /^\d+[ヶケ]月$/.test(s), (s) => /円\/月$/.test(s)).map(([label, v]) => price(label, yen(v)!, "per_month")),
  );

  const specAt = indexOfLine(lines, "主な仕様");
  const spec = (k: string) => (specAt >= 0 ? valueAfter(lines, k, specAt) : null);
  const cpu = ([spec("CPU"), spec("クロック数")].filter(Boolean).join(" ") || cpuFromText(title))?.replace(/^Ultra/, "Core Ultra") ?? null;
  const memoryGb = capacityGb(spec("メモリ"));
  const storageGb = capacityGb(spec("ストレージ"));
  const base = { title, maker: detectMaker(title), model: null, memoryGb, storageGb };

  return {
    companyId: "tamaya",
    externalId,
    url,
    ...base,
    cpu,
    os: spec("OS"),
    condition: null,
    officeIncluded: false,
    inStock: lines.some((s) => s.includes("欠品中")) ? false : null,
    priceTax: /税抜/.test(taxLine) ? "excl" : /税込/.test(taxLine) ? "incl" : "unknown",
    terms: "1か月単位。3か月以上で月額が下がる。送料別。",
    // 機種との対応づけは取り込み時に DB の products.listing_match で行う（lib/rental-match.ts）
    deviceSlug: null,
    configId: null,
    prices,
    fetchedAt: today(),
  };
}
