import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeviceIllustration } from "@/components/DeviceIllustration";
import { PriceSection } from "@/components/PriceSection";
import { LikeButton, ReviewList } from "@/components/Social";
import { allDevices, getDevice, reviewsFor, summarize } from "@/lib/catalog";
import { yen } from "@/lib/format";
import { deviceJsonLd } from "@/lib/jsonld";

export function generateStaticParams() {
  return allDevices().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/pc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = getDevice(slug);
  if (!d) return {};
  const title = `${d.name}（${d.chip}）のレンタル・購入価格比較`;
  return {
    title,
    description:
      d.content?.summary.slice(0, 110) ??
      `${d.brand} ${d.name}のレンタル月額を複数のレンタル会社で比較。購入価格・品質グレード・設定テンプレートもまとめて確認できます。`,
    alternates: { canonical: `/pc/${d.slug}` },
  };
}

export default async function DevicePage({ params }: PageProps<"/pc/[slug]">) {
  const { slug } = await params;
  const device = getDevice(slug);
  if (!device) notFound();
  const s = summarize(device);
  const c = device.content;
  const reviews = reviewsFor(device.slug);

  const toc = [
    ["price", "価格を比べる"],
    ...(c
      ? [
          ["summary", "ひとことで言うと"],
          ["specs", "スペックをやさしく解説"],
          ["scenes", "使い方の例"],
          ["choose", "構成の選び方"],
          ["faq", "よくある質問"],
        ]
      : []),
    ["reviews", "口コミ"],
  ];

  return (
    <main className="mx-auto max-w-[1240px] px-6 py-5 flex flex-col gap-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(deviceJsonLd(device)) }} />

      <nav aria-label="パンくず" className="text-xs text-mute">
        <Link href="/">トップ</Link> › <Link href="/">ノートPC</Link> › {device.brand} › {device.name}
      </nav>

      <section className="card p-5 flex flex-wrap gap-5">
        <div className="flex-[1_1_320px] min-h-[260px] rounded-[14px] bg-[#ECEEF2] flex items-center justify-center">
          <DeviceIllustration color={device.bodyColor} id={`hero-${device.slug}`} width={300} />
        </div>
        <div className="flex-[2_1_320px] flex flex-col gap-2.5">
          <span className="text-xs text-mute">
            {device.brand}
            {device.releaseDate ? ` ・ ${device.releaseDate.slice(0, 4)}年${Number(device.releaseDate.slice(5, 7))}月発売` : ""}
          </span>
          <h1 className="m-0 text-[26px] font-bold leading-snug">
            {device.name}（{device.chip}）
            <br />
            <span className="text-base font-medium text-sub">レンタル・購入の価格比較と、はじめての方向けの詳しい解説</span>
          </h1>
          <div className="flex flex-wrap gap-2.5 items-center text-[13px]">
            <LikeButton base={device.social.likes} />
            <a href="#reviews" className="no-underline">
              ★ {device.social.rating}（口コミ {device.social.reviewCount}件）
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <div className="bg-brand-soft rounded-xl px-3.5 py-3">
              <p className="m-0 text-xs text-[#1F3F9C] font-bold">借りる</p>
              <p className="m-0 mt-1 text-[13px]">
                月額 <b className="text-[22px]">{s.rentFrom ? yen(s.rentFrom) : "—"}</b>〜
              </p>
              <p className="m-0 mt-0.5 text-xs text-mute">{s.supplierCount}社が見積</p>
            </div>
            <div className="bg-buy-soft rounded-xl px-3.5 py-3">
              <p className="m-0 text-xs text-buy font-bold">買う</p>
              <p className="m-0 mt-1 text-[13px]">{s.buyFrom ? <b className="text-[22px]">{yen(s.buyFrom)}</b> : "準備中"}{s.buyFrom ? "〜" : ""}</p>
              <p className="m-0 mt-0.5 text-xs text-mute">ポイント還元後の実質価格</p>
            </div>
          </div>
          {!device.verified && (
            <p className="m-0 text-xs bg-[#FFF1DD] text-[#8A4B00] rounded-lg px-3 py-2">この機種の詳しい解説と仕様は現在確認中です。仕様はメーカー公式サイトをご確認ください。</p>
          )}
        </div>
      </section>

      <nav aria-label="このページの目次" className="flex flex-wrap gap-1.5 text-[13px]">
        {toc.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="bg-white border border-line rounded-full px-3 py-1.5 no-underline">
            {label}
          </a>
        ))}
      </nav>

      <PriceSection device={device} />

      {c && (
        <>
          <section id="summary" aria-labelledby="summary-h" className="card p-6 flex flex-col gap-3.5">
            <h2 id="summary-h" className="m-0 text-[19px] font-bold">ひとことで言うと</h2>
            <p className="m-0 text-[15px] leading-loose">{c.summary}</p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              <div className="border border-[#CFE3D5] bg-[#F3FAF5] rounded-xl px-4 py-3.5">
                <p className="m-0 mb-1.5 font-bold text-ok">こんな方に向いています</p>
                <ul className="m-0 pl-5 text-sm leading-loose list-disc">
                  {c.goodFor.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="border border-[#F1D9B5] bg-[#FFF9F1] rounded-xl px-4 py-3.5">
                <p className="m-0 mb-1.5 font-bold text-[#8A4B00]">向いていない方</p>
                <ul className="m-0 pl-5 text-sm leading-loose list-disc">
                  {c.notFor.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section id="specs" aria-labelledby="specs-h" className="card p-6">
            <h2 id="specs-h" className="m-0 mb-1 text-[19px] font-bold">スペックをやさしく解説</h2>
            <p className="m-0 mb-3.5 text-[13px] text-mute">カタログの言葉を、パソコンに詳しくない方にもわかるように説明しています。</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-mute text-xs">
                    <th className="p-2 border-b border-line font-normal w-[18%]">項目</th>
                    <th className="p-2 border-b border-line font-normal w-[32%]">仕様</th>
                    <th className="p-2 border-b border-line font-normal">つまりどういうこと？</th>
                  </tr>
                </thead>
                <tbody>
                  {c.specs.map((x) => (
                    <tr key={x.key}>
                      <th scope="row" className="text-left px-2 py-3 border-b border-[#EEEEEA] font-bold align-top">
                        {x.key}
                      </th>
                      <td className="px-2 py-3 border-b border-[#EEEEEA] align-top">{x.value}</td>
                      <td className="px-2 py-3 border-b border-[#EEEEEA] align-top text-[#2D3140] leading-relaxed">{x.plain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="scenes" aria-labelledby="scenes-h" className="card p-6">
            <h2 id="scenes-h" className="m-0 mb-3.5 text-[19px] font-bold">使い方の例とおすすめ構成</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              {c.scenes.map((x) => (
                <div key={x.title} className="border border-line rounded-xl p-4 flex flex-col gap-2">
                  <p className="m-0 font-bold text-[15px]">{x.title}</p>
                  <p className="m-0 text-[13px] leading-relaxed text-[#2D3140]">{x.body}</p>
                  <p className="m-0 text-xs bg-brand-soft rounded-lg px-2.5 py-2">
                    <b>おすすめ：</b>
                    {x.recommend}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="choose" aria-labelledby="choose-h" className="card p-6 flex flex-col gap-2.5">
            <h2 id="choose-h" className="m-0 text-[19px] font-bold">構成の選び方</h2>
            {c.choose.map((x) => (
              <p key={x.title} className="m-0 text-sm leading-loose">
                <b>{x.title}：</b>
                {x.body}
              </p>
            ))}
          </section>

          <section id="faq" aria-labelledby="faq-h" className="card p-6">
            <h2 id="faq-h" className="m-0 mb-3 text-[19px] font-bold">よくある質問</h2>
            {c.faqs.map((f, i) => (
              <details key={f.q} open={i === 0} className="border-b border-[#EEEEEA]">
                <summary className="flex justify-between gap-3 py-3.5 px-1 text-[15px] font-bold min-h-11">
                  <span>Q. {f.q}</span>
                  <span aria-hidden="true" className="faq-icon text-mute transition-transform">
                    ＋
                  </span>
                </summary>
                <p className="m-0 mb-3.5 px-1 text-sm leading-loose text-[#2D3140]">A. {f.a}</p>
              </details>
            ))}
          </section>
        </>
      )}

      <section id="reviews" aria-labelledby="reviews-h" className="card p-6 flex flex-col gap-4">
        <div className="flex flex-wrap justify-between gap-2 items-baseline">
          <h2 id="reviews-h" className="m-0 text-[19px] font-bold">利用者の口コミ</h2>
          <span className="text-xs text-mute">評価を投稿できるのは、xmall経由でレンタル・購入した方だけです</span>
        </div>
        <ReviewList reviews={reviews} />
        <p className="m-0 text-[11px] text-mute">ショップやレンタル会社から依頼された投稿、特典と引き換えの投稿にはその旨を表示します。現在の口コミはサンプルです。</p>
      </section>

      {c?.related.length ? (
        <section aria-labelledby="related-h" className="card p-6">
          <h2 id="related-h" className="m-0 mb-3 text-[19px] font-bold">よく比較される機種</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] min-w-[600px]">
              <thead>
                <tr className="text-left text-mute text-xs">
                  {["機種", "向いている人", "レンタル月額", "この機種との違い"].map((h) => (
                    <th key={h} className="p-2 border-b border-line font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.related.map((r) => {
                  const rd = getDevice(r.slug);
                  if (!rd) return null;
                  const rs = summarize(rd);
                  return (
                    <tr key={r.slug}>
                      <td className="px-2 py-2.5 border-b border-[#EEEEEA]">
                        <Link href={`/pc/${r.slug}`}>{rd.name}</Link>
                      </td>
                      <td className="px-2 py-2.5 border-b border-[#EEEEEA]">{r.who}</td>
                      <td className="px-2 py-2.5 border-b border-[#EEEEEA]">{rs.rentFrom ? `${yen(rs.rentFrom)}〜` : "—"}</td>
                      <td className="px-2 py-2.5 border-b border-[#EEEEEA]">{r.diff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {device.sources.length > 0 && (
        <section aria-labelledby="src-h" className="text-xs text-mute">
          <h2 id="src-h" className="text-xs font-bold m-0 mb-1">仕様・価格の出典</h2>
          <ul className="m-0 pl-4 list-disc">
            {device.sources.map((x) => (
              <li key={x.url}>
                <a href={x.url} rel="noopener" target="_blank">
                  {x.title}
                </a>
                （{x.accessed}確認）
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
