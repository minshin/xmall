import { summarize } from "@/lib/catalog";
import { getDevices } from "@/lib/catalog-server";
import { SITE_URL, yen } from "@/lib/format";
import { productPath } from "@/lib/urls";

/** AI向けのサイト案内（llms.txt） */
export async function GET() {
  const lines = [
    "# xmall",
    "",
    "> 法人向けのノートPC・モニター・タブレットなどIT機器の「レンタル」と「購入」を比較するサイト。複数のレンタル会社が公開ページに掲載している月額（取得日つき）と、メーカー直販価格を機種ごとに並べて比較できる。",
    "",
    "## 機種",
    ...(await getDevices()).map((d) => {
      const s = summarize(d);
      const price = [s.rentFrom ? `レンタル月額${yen(s.rentFrom)}〜（${s.companyCount}社の掲載価格）` : "", s.buyFrom ? `メーカー直販${yen(s.buyFrom)}〜` : ""].filter(Boolean).join("、");
      return `- [${d.brand} ${d.name}${d.subtitle ? `（${d.subtitle}）` : ""}](${SITE_URL}${productPath(d)}): ${d.categoryName}。${price}`;
    }),
    "",
    "## AI・開発者向け",
    `- MCPエンドポイント: ${SITE_URL}/api/mcp （tools: search_devices, get_device, compare_rental_offers, compare_purchase_prices, rent_or_buy）`,
    `- JSON API: ${SITE_URL}/api/devices`,
    "",
    "注：レンタル月額は各社の公開ページに掲載されている価格（税区分はページの表記どおり）。xmall の提携先ではありません。",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
