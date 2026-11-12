import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/Landing";
import { getCategories, getDevices } from "@/lib/catalog-server";
import { yen } from "@/lib/format";
import { filterDevices, landingFacets, landingStats } from "@/lib/landing";
import { brandPath } from "@/lib/urls";

type Props = PageProps<"/[category]/brand/[brand]">;

async function load(params: Props["params"]) {
  const { category, brand } = await params;
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  const cat = cats.find((c) => c.id === category);
  const b = cat && landingFacets(all, cat.id).brands.find((x) => x.id === brand);
  return cat && b ? { cat, brand: b, devices: filterDevices(all, cat.id, { kind: "brand", brandId: b.id }) } : undefined;
}

export async function generateStaticParams() {
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  return cats.flatMap((c) => landingFacets(all, c.id).brands.map((b) => ({ category: c.id, brand: b.id })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(params);
  if (!r) return {};
  const s = landingStats(r.devices);
  return {
    title: `${r.brand.name}の${r.cat.name}レンタル比較${s.minMonthly ? `｜月額${yen(s.minMonthly)}〜` : ""}`,
    description: `${r.brand.name}の法人向け${r.cat.name}${s.products}機種を、${s.companies}社のレンタル掲載価格で比較。`,
    alternates: { canonical: brandPath(r.cat.id, r.brand.id) },
  };
}

export default async function BrandPage({ params }: Props) {
  const r = await load(params);
  if (!r) notFound();
  return (
    <Landing
      categoryId={r.cat.id}
      title={`${r.brand.name}の${r.cat.name}レンタル`}
      subject={`${r.brand.name}の${r.cat.name}`}
      devices={r.devices}
      crumbs={[{ name: r.brand.name, href: brandPath(r.cat.id, r.brand.id) }]}
      current={`brand:${r.brand.id}`}
    />
  );
}
