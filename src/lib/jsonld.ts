import { SITE_NAME, SITE_URL } from "./format";
import { cheapestPerCompany } from "./pricing";
import type { Device } from "./types";
import { categoryPath, productPath } from "./urls";

/**
 * 機種ページの構造化データ（Product、BreadcrumbList、FAQPage）。
 * 価格は実データだけを載せる：
 *   * レンタル：各社の掲載価格（月額。LeaseOut・単位 MON）。会社ごとに最安の 1 件
 *   * 購入：メーカー直販価格（登録してあるもの）
 */
export function deviceJsonLd(device: Device) {
  const url = SITE_URL + productPath(device);
  const rentals = cheapestPerCompany(device.rentals).map((o) => ({
    "@type": "Offer",
    url: o.url,
    price: o.monthly,
    priceCurrency: "JPY",
    businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: o.monthly,
      priceCurrency: "JPY",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      ...(o.priceTax === "unknown" ? {} : { valueAddedTaxIncluded: o.priceTax === "incl" }),
    },
    seller: { "@type": "Organization", name: o.companyName },
    ...(o.inStock === false ? { availability: "https://schema.org/OutOfStock" } : {}),
  }));
  const buys = device.configs.flatMap((c) =>
    c.officialPrice
      ? [
          {
            "@type": "Offer",
            name: c.label,
            price: c.officialPrice,
            priceCurrency: "JPY",
            businessFunction: "http://purl.org/goodrelations/v1#Sell",
            seller: { "@type": "Organization", name: device.brand },
          },
        ]
      : [],
  );
  const offers = [...rentals, ...buys];
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Product",
      "@id": `${url}#product`,
      name: `${device.brand} ${device.name}`,
      brand: { "@type": "Brand", name: device.brand },
      category: device.categoryName,
      url,
      ...(device.content ? { description: device.content.summary } : {}),
      ...(device.images[0] ? { image: device.images.map((i) => i.src) } : {}),
      ...(offers.length ? { offers } : {}),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: device.categoryName, item: SITE_URL + categoryPath(device.categoryId) },
        { "@type": "ListItem", position: 3, name: device.name, item: url },
      ],
    },
  ];
  if (device.content?.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: device.content.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
