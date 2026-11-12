import { allDevices, summarize } from "@/lib/catalog";

/** 機種一覧（要約）。ビルド時に静的生成される。 */
export async function GET() {
  return Response.json({ devices: allDevices().map(summarize) });
}
