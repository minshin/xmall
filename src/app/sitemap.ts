import type { MetadataRoute } from "next";
import { allDevices } from "@/lib/catalog";
import { SITE_URL } from "@/lib/format";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/guide/grades`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/partners`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.1 },
    ...allDevices().map((d) => ({
      url: `${SITE_URL}/pc/${d.slug}`,
      changeFrequency: "daily" as const,
      priority: d.verified ? 0.9 : 0.6,
    })),
  ];
}
