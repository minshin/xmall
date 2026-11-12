import { summarize } from "@/lib/catalog";
import { getDevice, getDevices } from "@/lib/catalog-server";
import { rentalOffers, shopOffers } from "@/lib/pricing";

export async function generateStaticParams() {
  return (await getDevices()).map((d) => ({ slug: d.slug }));
}

/** 機種詳細と、各構成の標準条件（A・24か月・一般事務）での見積・購入価格 */
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
      rentalOffers: rentalOffers(d, c.id, "A", 24, "OFFICE"),
      shopOffers: shopOffers(d, c.id),
    })),
  });
}
