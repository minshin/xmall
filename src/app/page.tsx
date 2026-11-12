import { Suspense } from "react";
import { CatalogBrowser, CatalogBrowserWithParams, type FacetDef } from "@/components/CatalogBrowser";
import { summarize } from "@/lib/catalog";
import { getCategories, getDevices } from "@/lib/catalog-server";
import { getAllStats } from "@/lib/community";

export default async function Home() {
  const [devices, categories, stats] = await Promise.all([getDevices(), getCategories(), getAllStats()]);
  const attrsOf = (id: string) => categories.find((c) => c.id === id)?.attributes ?? [];
  const summaries = devices.map((d) => summarize(d, attrsOf(d.categoryId).filter((a) => a.scope === "variant" && (a.highlight || a.filterable))));
  const facetDefs: FacetDef[] = [];
  for (const c of categories)
    for (const a of c.attributes)
      if (a.filterable && !facetDefs.some((f) => f.key === a.key)) facetDefs.push({ key: a.key, label: a.label });
  const withProducts = categories.filter((c) => devices.some((d) => d.categoryId === c.id)).map(({ id, name, icon }) => ({ id, name, icon }));

  return (
    <main className="mx-auto max-w-[1240px] px-4 sm:px-6 py-10">
      <Suspense fallback={<CatalogBrowser devices={summaries} stats={stats} facetDefs={facetDefs} categories={withProducts} />}>
        <CatalogBrowserWithParams devices={summaries} stats={stats} facetDefs={facetDefs} categories={withProducts} />
      </Suspense>
    </main>
  );
}
