import { summarize } from "@/lib/catalog";
import { getDevices } from "@/lib/catalog-server";

/** 機種一覧（要約） */
export async function GET() {
  return Response.json({ devices: (await getDevices()).map((d) => summarize(d)) });
}
