import { CatalogBrowser } from "@/components/CatalogBrowser";
import { allDevices, summarize } from "@/lib/catalog";
import { getAllStats } from "@/lib/community";

export default async function Home() {
  const devices = allDevices().map(summarize);
  const stats = await getAllStats();
  return (
    <main className="mx-auto max-w-[1240px] px-6 py-5">
      <p className="text-xs text-mute mb-3">法人向けノートPCを、レンタル会社と主要ショップの価格でまとめて比較できます。</p>
      <CatalogBrowser devices={devices} stats={stats} />
    </main>
  );
}
