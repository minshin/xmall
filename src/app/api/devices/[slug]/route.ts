import { summarize } from "@/lib/catalog";
import { getDevice, getDevices } from "@/lib/catalog-server";
import { rentalOffers } from "@/lib/pricing";

export async function generateStaticParams() {
  return (await getDevices()).map((d) => ({ slug: d.slug }));
}

/** 機種詳細と、構成ごとのレンタル掲載価格・メーカー直販価格 */
export async function GET(_req: Request, ctx: RouteContext<"/api/devices/[slug]">) {
  const { slug } = await ctx.params;
  const d = await getDevice(slug);
  if (!d) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({
    summary: summarize(d),
    device: d,
    configs: d.configs.map((c) => ({
      id: c.id,
      label: c.label,
      officialPrice: c.officialPrice ?? null,
      rentalOffers: rentalOffers(d, c.id),
    })),
  });
}
