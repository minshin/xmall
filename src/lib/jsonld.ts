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
      name: device.subtitle ? `${device.name}（${device.subtitle}）` : device.name,
      brand: { "@type": "Brand", name: device.brand },
      category: device.categoryName,
      url,
      ...(device.content ? { description: device.content.summary } : {}),
      ...(device.images[0] ? { image: device.images.map((i) => i.src) } : {}),
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
        { "@type": "ListItem", position: 2, name: device.categoryName, item: `${SITE_URL}/` },
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
