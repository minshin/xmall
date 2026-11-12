import type { MetadataRoute } from "next";
import { getCategories, getDevices } from "@/lib/catalog-server";
import { SITE_URL } from "@/lib/format";
import { filterDevices, landingFacets } from "@/lib/landing";
import type { Device } from "@/lib/types";
import { brandPath, categoryPath, pricePath, productPath, purposePath } from "@/lib/urls";

/** 一覧ページの最終更新＝含まれる機種のうち最新 */
const latest = (ds: Device[]) => {
  const d = ds.map((x) => x.updatedAt).sort().at(-1);
  return d ? new Date(d) : undefined;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [devices, categories] = await Promise.all([getDevices(), getCategories()]);
  const out: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: latest(devices), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/partners`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.1 },
  ];
  for (const c of categories) {
    const inCat = filterDevices(devices, c.id, { kind: "category" });
    if (!inCat.length) continue;
    out.push({ url: SITE_URL + categoryPath(c.id), lastModified: latest(inCat), changeFrequency: "daily", priority: 0.9 });
    const f = landingFacets(devices, c.id);
    for (const b of f.brands)
      out.push({ url: SITE_URL + brandPath(c.id, b.id), lastModified: latest(filterDevices(devices, c.id, { kind: "brand", brandId: b.id })), changeFrequency: "weekly", priority: 0.7 });
    for (const p of f.prices)
      out.push({ url: SITE_URL + pricePath(c.id, p.band.id), lastModified: latest(filterDevices(devices, c.id, { kind: "price", band: p.band })), changeFrequency: "weekly", priority: 0.7 });
    for (const u of f.uses)
      out.push({ url: SITE_URL + purposePath(c.id, u.use), lastModified: latest(filterDevices(devices, c.id, { kind: "use", use: u.use })), changeFrequency: "weekly", priority: 0.6 });
  }
  for (const d of devices)
    out.push({ url: SITE_URL + productPath(d), lastModified: new Date(d.updatedAt), changeFrequency: "weekly", priority: d.rentals.length ? 0.8 : 0.5 });
  return out;
}
