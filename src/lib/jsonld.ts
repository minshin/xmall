import { SITE_NAME, SITE_URL } from "./format";
import { shopOffers } from "./pricing";
import type { Device } from "./types";

/** 機種ページの構造化データ（Product + AggregateOffer、FAQPage、BreadcrumbList） */
export function deviceJsonLd(device: Device) {
  const url = `${SITE_URL}/pc/${device.slug}`;
  const prices = device.configs.flatMap((c) => shopOffers(device, c.id).map((o) => o.price));
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Product",
      "@id": `${url}#product`,
      name: `${device.name}（${device.chip}）`,
      brand: { "@type": "Brand", name: device.brand },
      category: "ノートパソコン",
      url,
      ...(device.content ? { description: device.content.summary } : {}),
      ...(prices.length
        ? {
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "JPY",
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              offerCount: prices.length,
            },
          }
        : {}),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "ノートPC", item: `${SITE_URL}/` },
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
