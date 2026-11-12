import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/Landing";
import { getCategories, getDevices } from "@/lib/catalog-server";
import { filterDevices, landingFacets, landingStats } from "@/lib/landing";
import { purposePath } from "@/lib/urls";

type Props = PageProps<"/[category]/use/[use]">;

async function load(params: Props["params"]) {
  const { category, use } = await params;
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  const cat = cats.find((c) => c.id === category);
  const u = cat && landingFacets(all, cat.id).uses.find((x) => x.use === use);
  return cat && u ? { cat, use: u, devices: filterDevices(all, cat.id, { kind: "use", use: u.use }) } : undefined;
}

export async function generateStaticParams() {
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  return cats.flatMap((c) => landingFacets(all, c.id).uses.map((u) => ({ category: c.id, use: u.use })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(params);
  if (!r) return {};
  const s = landingStats(r.devices);
  return {
    title: `${r.use.label}向けの${r.cat.name}レンタル比較（${s.products}機種）`,
    description: `${r.use.label}に向いた法人向け${r.cat.name}を、レンタル会社の掲載価格で比較。`,
    alternates: { canonical: purposePath(r.cat.id, r.use.use) },
  };
}

export default async function UsePage({ params }: Props) {
  const r = await load(params);
  if (!r) notFound();
  return (
    <Landing
      categoryId={r.cat.id}
      title={`${r.use.label}向けの${r.cat.name}`}
      subject={`${r.use.label}向けの${r.cat.name}`}
      devices={r.devices}
      crumbs={[{ name: r.use.label, href: purposePath(r.cat.id, r.use.use) }]}
      current={`use:${r.use.use}`}
    />
  );
}
