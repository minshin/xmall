import { summarize } from "@/lib/catalog";
import { getDevices } from "@/lib/catalog-server";
import { SITE_URL, yen } from "@/lib/format";

/** AI向けのサイト案内（llms.txt） */
export async function GET() {
  const lines = [
    "# xmall",
    "",
    "> 法人向けのノートPC・モニター・タブレットなどIT機器の「レンタル」と「購入」を比較するサイト。品質グレード（S/A/B/C）と設定テンプレートを標準化し、複数のレンタル会社の月額と主要ショップの価格を並べて比較できる。",
    "",
    "## 機種",
    ...(await getDevices()).map((d) => {
      const s = summarize(d);
      const price = [s.rentFrom ? `レンタル月額${yen(s.rentFrom)}〜` : "", s.buyFrom ? `購入実質${yen(s.buyFrom)}〜` : ""].filter(Boolean).join("、");
      return `- [${d.brand} ${d.name}${d.subtitle ? `（${d.subtitle}）` : ""}](${SITE_URL}/pc/${d.slug}): ${d.categoryName}。${price}`;
    }),
    "",
    "## ガイド",
    `- [品質グレード基準](${SITE_URL}/guide/grades)`,
    "",
    "## AI・開発者向け",
    `- MCPエンドポイント: ${SITE_URL}/api/mcp （tools: search_devices, get_device, compare_rental_offers, compare_purchase_prices, rent_or_buy, get_quote）`,
    `- JSON API: ${SITE_URL}/api/devices`,
    "",
    "注：レンタル会社名・月額、公式以外のショップ価格は現在サンプルデータです。",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
