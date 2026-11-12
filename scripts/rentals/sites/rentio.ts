import {
  capacitiesFromTitle, capacityGb, cpuFromText, decodeEntities, detectMaker, htmlToLines, indexOfLine, links, matchCatalog, today, valueAfter,
  type RentalListingData, type SiteScraper,
} from "../lib";

/** Rentio（レンティオ株式会社）：法人向けノートパソコン カテゴリ（?page=N）。月額制プラン、税込 */
const LIST = "https://www.rentio.jp/t/genre/pc/notepc/business-pc";
const BUSINESS_LINK = "/t/genre/pc/notepc/business-pc";

export const rentio: SiteScraper = {
  company: {
    id: "rentio",
    name: "Rentio（レンティオ）",
    operator: "レンティオ株式会社",
    url: "https://www.rentio.jp/",
    audience: "mixed",
    note: "個人・法人向け。月額制プランは税込、最低利用期間未満の返却は解約料あり。配送手数料 480 円。",
  },
  async scrape(ctx) {
    const items = new Set<string>();
    const pages = [LIST];
    for (let i = 0; i < pages.length && i < 10; i++) {
      const html = await ctx.fetchHtml(pages[i]);
      for (const u of links(html, pages[i], /^\/products\/[\w-]+$/)) items.add(u);
      for (const p of links(html, pages[i], /^\/t\/genre\/pc\/notepc\/business-pc\?page=\d+$/)) if (!pages.includes(p)) pages.push(p);
    }
    const urls = [...items].slice(0, ctx.limit);
    ctx.log(`rentio: ${pages.length} 一覧ページ, ${urls.length} 候補`);
    const out: RentalListingData[] = [];
    for (const url of urls) {
      try {
        const l = parse(await ctx.fetchHtml(url), url);
        if (l) out.push(l);
      } catch (e) {
        ctx.log(`  skip ${url}: ${e instanceof Error ? e.message : e}`);
      }
    }
    ctx.log(`rentio: 法人向けノートPC ${out.length} 件`);
    return out;
  },
};

interface LdProduct {
  "@type": string;
  name: string;
  offers?: { price?: number } | { price?: number }[];
}

function ldProduct(html: string): LdProduct | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      if (j?.["@type"] === "Product") return j;
    } catch {
      /* 壊れた JSON-LD は無視 */
    }
  }
  return null;
}

export function parse(html: string, url: string): RentalListingData | null {
  // 一覧には「おすすめ」として PC 以外も並ぶので、法人向けノートPC カテゴリに属するページだけ残す
  if (!html.includes(BUSINESS_LINK)) return null;
  const product = ldProduct(html);
  if (!product) return null;
  const title = decodeEntities(product.name).normalize("NFKC").replace(/^【法人向け】\s*/, "").replace(/\([ァ-ヶー・]+\)/g, "").replace(/\s+/g, " ").trim();
  const lines = htmlToLines(html);
  const text = lines.join("\n");

  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const shown = text.match(/([\d,]+)\s*円\s*月額\s*\(税込\)/);
  const monthly = shown ? Number(shown[1].replace(/,/g, "")) : (offer?.price ?? null);
  if (!monthly) return null;

  // 「ご選択中のプランでは、 N ヶ月以上のご利用で返却時の解約料が0円」
  const minMonths = Number(text.match(/ご選択中のプランでは、?\s*(\d+)\s*ヶ月以上のご利用で/)?.[1] ?? 0) || null;
  const autoEnd = text.match(/月額課金の自動終了[:：]\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const hasUsed = text.includes("点検済みリユース品");
  const hasNew = text.includes("「新品」の場合");

  // 「詳細仕様」の表を優先（「製品特徴」の箇条書きは誤記があるため使わない）。無ければタイトルから
  const specAt = indexOfLine(lines, "詳細仕様");
  const spec = (k: string | RegExp) => (specAt >= 0 ? valueAfter(lines, k, specAt) : null);
  const fromTitle = capacitiesFromTitle(title);
  const memoryGb = capacityGb(spec("メモリー") ?? spec("メモリ")) ?? fromTitle.memoryGb;
  const storageGb = capacityGb(spec(/^(ストレージ|ストレージ容量|SSD|SSDストレージ|SSD容量)$/)) ?? fromTitle.storageGb;
  const specOs = spec("初期導入済OS") ?? spec("OS");
  const base = { title, maker: detectMaker(spec("メーカー") ?? title) ?? detectMaker(title), model: spec(/^(製品型番|型番)$/), memoryGb, storageGb };
  const externalId = new URL(url).pathname.split("/").pop()!;
  const terms = [
    minMonths ? `${minMonths}か月以上の利用で解約料0円（それ未満は残り月数分の解約料）` : null,
    autoEnd ? `月額課金の自動終了：${autoEnd}` : null,
    "配送手数料480円・返却送料無料",
  ]
    .filter(Boolean)
    .join("。");

  return {
    companyId: "rentio",
    externalId,
    url,
    ...base,
    cpu: spec("CPU") ?? spec("プロセッサー") ?? cpuFromText(title),
    os: specOs ?? (/MacBook|Apple/i.test(title) ? "macOS" : /Windows ?11/i.test(title) ? "Windows 11" : null),
    condition: hasUsed && hasNew ? "selectable" : hasUsed ? "used" : hasNew ? "new" : null,
    officeIncluded: /Office非搭載/i.test(title) ? false : /Office(搭載|付)/i.test(title) ? true : null,
    inStock: text.includes("現在お届けできる在庫がありません") ? false : null,
    priceTax: "incl",
    terms,
    ...matchCatalog(base),
    prices: [
      {
        termUnit: "month",
        termValue: minMonths ?? 1,
        priceYen: monthly,
        basis: "per_month",
        label: minMonths ? `月額制（${minMonths}か月以上）` : "月額制",
      },
    ],
    fetchedAt: today(),
  };
}
