import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "レンタル会社・ショップの方へ",
  description: "xmallへの掲載のご案内。標準化された機種カタログに見積を登録するだけで、法人のお客様からの問い合わせを受け取れます。",
  alternates: { canonical: "/partners" },
};

const POINTS = [
  ["成果報酬", "初期費用・月額費用はかかりません。お問い合わせまたは成約ごとの手数料のみです。"],
  ["かんたん登録", "自社の型番・在庫をCSVで送ると、xmallの標準SKUに対応づけます。"],
  ["同じ基準で比較", "品質グレードと設定テンプレートが共通なので、サービスの良さが正しく伝わります。"],
  ["AI経由の集客", "AIアシスタントがxmallのデータを参照して機種を比較・提案します（MCP対応）。"],
];

export default function PartnersPage() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-8 flex flex-col gap-5">
      <h1 className="m-0 text-2xl font-bold">レンタル会社・ショップの方へ</h1>
      <p className="m-0 text-[15px] leading-loose">
        xmallは、法人がPC・IT機器を「借りる」「買う」を比較するサイトです。サービスの提供（審査・契約・配送・保守）は掲載各社が行い、xmallは集客と比較を担当します。
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {POINTS.map(([t, b]) => (
          <div key={t} className="card p-5">
            <p className="m-0 mb-1.5 font-bold">{t}</p>
            <p className="m-0 text-sm leading-relaxed text-sub">{b}</p>
          </div>
        ))}
      </div>
      <p className="m-0 text-sm text-sub">掲載のご相談は準備中です。</p>
    </main>
  );
}
