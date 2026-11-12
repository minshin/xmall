import type { Metadata } from "next";
import { GRADE_CODES, GRADES } from "@/data/master";

export const metadata: Metadata = {
  title: "品質グレード基準（S/A/B/C）",
  description: "xmallに掲載するレンタルPCの品質グレード基準。外観・バッテリー最大容量・保証をS/A/B/Cの4段階で定義しています。",
  alternates: { canonical: "/guide/grades" },
};

export default function GradesPage() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-8 flex flex-col gap-5">
      <h1 className="m-0 text-2xl font-bold">品質グレード基準</h1>
      <p className="m-0 text-[15px] leading-loose">
        中古・再生品のレンタルPCは、会社によって「美品」「良品」などの言葉の意味がばらばらです。xmallでは外観・バッテリー・保証の3つの観点でS/A/B/Cの4段階を定義し、掲載するすべてのレンタル会社にこの基準での登録をお願いしています。
      </p>
      <div className="card p-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-mute text-xs">
              {["グレード", "外観", "バッテリー最大容量", "保証"].map((h) => (
                <th key={h} className="p-2 border-b border-line font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADE_CODES.map((g) => (
              <tr key={g}>
                <th scope="row" className="text-left px-2 py-3 border-b border-[#EEEEEA]">
                  {g}　{GRADES[g].label}
                </th>
                <td className="px-2 py-3 border-b border-[#EEEEEA]">{GRADES[g].appearance}</td>
                <td className="px-2 py-3 border-b border-[#EEEEEA]">{GRADES[g].batteryMin}</td>
                <td className="px-2 py-3 border-b border-[#EEEEEA]">{GRADES[g].warranty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-sm leading-loose text-sub">
        出荷前に各社が写真と検査結果を登録し、xmallが定期的に抜き取り検査を行います。基準外が続く会社は掲載を停止します。性能はグレードによって変わりません。社内用で見た目を気にしない場合は、グレードBを選ぶと月額を抑えられます。
      </p>
    </main>
  );
}
