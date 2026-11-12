import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/Landing";
import { getCategories, getDevices } from "@/lib/catalog-server";
import { yen } from "@/lib/format";
import { filterDevices, landingStats } from "@/lib/landing";
import { categoryPath } from "@/lib/urls";

type Props = PageProps<"/[category]">;

async function load(params: Props["params"]) {
  const { category } = await params;
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  const cat = cats.find((c) => c.id === category);
  const devices = cat ? filterDevices(all, cat.id, { kind: "category" }) : [];
  return cat && devices.length ? { cat, devices } : undefined;
}

export async function generateStaticParams() {
  const [cats, all] = await Promise.all([getCategories(), getDevices()]);
  return cats.filter((c) => all.some((d) => d.categoryId === c.id)).map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(params);
  if (!r) return {};
  const s = landingStats(r.devices);
  return {
    title: `法人向け${r.cat.name}のレンタル比較${s.minMonthly ? `｜月額${yen(s.minMonthly)}〜・${s.companies}社` : ""}`,
    description: `法人向け${r.cat.name}${s.products}機種のレンタル月額を、${s.companies}社の掲載価格で比較。メーカー・月額・用途から選べます。`,
    alternates: { canonical: categoryPath(r.cat.id) },
  };
}

export default async function CategoryPage({ params }: Props) {
  const r = await load(params);
  if (!r) notFound();
  return <Landing categoryId={r.cat.id} title={`${r.cat.name}のレンタル・購入比較`} subject={`法人向けの${r.cat.name}`} devices={r.devices} crumbs={[]} />;
}
