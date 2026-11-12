import { notFound, permanentRedirect } from "next/navigation";
import { getDevices } from "@/lib/catalog-server";
import { productPath } from "@/lib/urls";

export async function generateStaticParams() {
  return (await getDevices()).map((d) => ({ slug: d.slug }));
}

/** 旧 URL（/pc/{機種}）→ /{品目}/{機種} へ恒久リダイレクト */
export default async function LegacyDevicePage({ params }: PageProps<"/pc/[slug]">) {
  const { slug } = await params;
  const d = (await getDevices()).find((x) => x.slug === slug);
  if (!d) notFound();
  permanentRedirect(productPath(d));
}
