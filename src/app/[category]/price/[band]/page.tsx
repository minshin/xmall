import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/Landing";
import { getCategories, getDevices } from "@/lib/catalog-server";
import { filterDevices, landingFacets, landingStats } from "@/lib/landing";
import { pricePath } from "@/lib/urls";

type Props = PageProps<"/[category]/price/[band]">;

async function load(params: Props["params"]) {
  const { category, band } = await params;
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  const cat = cats.find((c) => c.id === category);
  const p = cat && landingFacets(all, cat.id).prices.find((x) => x.band.id === band);
  return cat && p ? { cat, band: p.band, devices: filterDevices(all, cat.id, { kind: "price", band: p.band }) } : undefined;
}

export async function generateStaticParams() {
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  return cats.flatMap((c) => landingFacets(all, c.id).prices.map((p) => ({ category: c.id, band: p.band.id })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(params);
  if (!r) return {};
  const s = landingStats(r.devices);
  return {
    title: `${r.band.label}で借りられる法人向け${r.cat.name}（${s.products}機種）`,
    description: `${r.band.label}でレンタルできる法人向け${r.cat.name}を、${s.companies}社の掲載価格で比較。`,
    alternates: { canonical: pricePath(r.cat.id, r.band.id) },
  };
}

export default async function PricePage({ params }: Props) {
  const r = await load(params);
  if (!r) notFound();
  return (
    <Landing
      categoryId={r.cat.id}
      title={`${r.band.label}の${r.cat.name}レンタル`}
      subject={`${r.band.label}で借りられる${r.cat.name}`}
      devices={r.devices}
      crumbs={[{ name: r.band.label, href: pricePath(r.cat.id, r.band.id) }]}
      current={`price:${r.band.id}`}
    />
  );
}
