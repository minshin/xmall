import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, CircleDot, Clapperboard, Code2, Palette, Presentation, X, type LucideIcon } from "lucide-react";
import { DeviceLike, DeviceReviews, RatingSummary } from "@/components/Community";
import { Gallery } from "@/components/Gallery";
import { Icon } from "@/components/icons";
import { ProductPurchase, type ListedOffer } from "@/components/ProductPurchase";
import { LikeButtonPlaceholder, ReviewForm, ViewCount } from "@/components/Social";
import { DeviceThumb } from "@/components/ui";
import { GRADE_CODES, GRADES, TEMPLATE_CODES, TEMPLATES } from "@/data/master";
import { displaySpecs, summarize } from "@/lib/catalog";
import { getDevice, getDevices, getFavicons, getVariantAttrs } from "@/lib/catalog-server";
import { getRentalListings, getStats } from "@/lib/community";
import { yen } from "@/lib/format";
import { deviceJsonLd } from "@/lib/jsonld";
import type { Device, RentalListing } from "@/lib/types";

export async function generateStaticParams() {
  return (await getDevices()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/pc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDevice(slug);
  if (!d) return {};
  return {
    title: `${d.name}${d.subtitle ? `（${d.subtitle}）` : ""}のレンタル・購入価格比較`,
    description:
      d.content?.summary.slice(0, 110) ??
      `${d.brand} ${d.name}のレンタル月額を複数のレンタル会社で比較。購入価格・品質グレード・設定テンプレートもまとめて確認できます。`,
    alternates: { canonical: `/pc/${d.slug}` },
    openGraph: d.images[0] ? { images: [{ url: d.images[0].src, width: d.images[0].width, height: d.images[0].height }] } : undefined,
  };
}

const SCENE_ICON: [RegExp, LucideIcon][] = [
  [/デザイン|画像/, Palette],
  [/動画|SNS/, Clapperboard],
  [/開発|ソフトウェア/, Code2],
  [/プレゼン|営業|経営/, Presentation],
];
const sceneIcon = (title: string) => SCENE_ICON.find(([re]) => re.test(title))?.[1] ?? CircleDot;

/** 実在レンタル会社の掲載：月額表示があるものだけ、同じ会社・同じ構成は最安の 1 件に絞る */
function toListed(listings: RentalListing[]): ListedOffer[] {
  const best = new Map<string, ListedOffer>();
  for (const l of listings) {
    const p = l.prices.filter((x) => x.basis === "per_month").sort((a, b) => a.priceYen - b.priceYen)[0];
    if (!p) continue;
    const storage = l.storageGb ? (l.storageGb >= 1024 ? `${l.storageGb / 1024}TB` : `${l.storageGb}GB`) : null;
    const spec = [l.memoryGb ? `${l.memoryGb}GB` : null, storage].filter(Boolean).join(" / ") || l.title;
    const offer: ListedOffer = {
      key: `${l.companyId}:${l.externalId}`,
      companyId: l.companyId,
      companyName: l.companyName,
      spec,
      monthly: p.priceYen,
      note: [spec, p.label.replace(/^月額制/, "").replace(/^[（(]|[）)]$/g, ""), l.priceTax === "incl" ? "税込" : l.priceTax === "excl" ? "税抜" : "", l.inStock === false ? "在庫なし" : ""]
        .filter(Boolean)
        .join("・"),
      url: l.url,
      inStock: l.inStock,
    };
    const k = `${l.companyId}|${spec}`;
    const cur = best.get(k);
    if (!cur || offer.monthly < cur.monthly) best.set(k, offer);
  }
  return [...best.values()].sort((a, b) => a.monthly - b.monthly);
}

function Section({ id, title, children, aside }: { id: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
        <h2 id={`${id}-h`} className="m-0 text-[22px] font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function RelatedCard({ d, rent, note }: { d: Device; rent?: number; note?: string }) {
  return (
    <Link href={`/pc/${d.slug}`} className="group shrink-0 w-[200px] sm:w-auto text-ink hover:no-underline flex flex-col gap-2">
      <div className="aspect-[4/3] rounded-[12px] border border-hair bg-white overflow-hidden">
        <div className="size-full transition-transform duration-300 group-hover:scale-[1.03]">
          <DeviceThumb device={d} sizes="240px" />
        </div>
      </div>
      <p className="m-0 text-[13px] leading-snug line-clamp-2">
        {d.brand} {d.name}
        {d.subtitle ? `（${d.subtitle}）` : ""}
      </p>
      <div className="bg-ground rounded-[8px] px-2.5 py-1.5 text-xs">
        月額 <b className="text-[15px] font-semibold tabular-nums">{rent ? yen(rent) : "—"}</b>〜
      </div>
      {note && <p className="m-0 text-[11px] text-mute leading-snug">{note}</p>}
    </Link>
  );
}

export default async function DevicePage({ params }: PageProps<"/pc/[slug]">) {
  const { slug } = await params;
  const device = await getDevice(slug);
  if (!device) notFound();
  const [listings, stats, favicons, variantAttrs, all] = await Promise.all([
    getRentalListings(device.slug),
    getStats(device.slug),
    getFavicons(),
    getVariantAttrs(device.categoryId),
    getDevices(),
  ]);
  const s = summarize(device, variantAttrs);
  const c = device.content;
  const specs = displaySpecs(device.specs);
  const listed = toListed(listings);
  const relatedFromContent = (c?.related ?? []).flatMap((r) => {
    const rd = all.find((x) => x.slug === r.slug);
    return rd ? [{ d: rd, note: r.diff }] : [];
  });
  // 関連商品：解説で指定したもの → 同じ品目の他機種で補う（最大 6）
  const related = [
    ...relatedFromContent,
    ...all
      .filter((x) => x.categoryId === device.categoryId && x.slug !== device.slug && !relatedFromContent.some((r) => r.d.slug === x.slug))
      .map((d) => ({ d, note: undefined as string | undefined })),
  ].slice(0, 6);
  const released = device.releaseDate ? `${device.releaseDate.slice(0, 4)}年${Number(device.releaseDate.slice(5, 7))}月発売` : null;

  const tabs = [
    ["purchase", "料金・プラン"],
    ["included", "含まれるもの"],
    ...(c ? [["overview", "商品説明"]] : []),
    ...(specs.length ? [["specs", "スペック"]] : []),
    ...(c?.faqs.length ? [["faq", "よくある質問"]] : []),
    ["reviews", "口コミ"],
  ];

  return (
    <main className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(deviceJsonLd(device)) }} />

      {/* ページ内タブ */}
      <div className="sticky top-12 z-30 bg-[rgb(255_255_255/0.85)] backdrop-blur-xl border-b border-hair">
        <nav aria-label="このページ" className="mx-auto max-w-[1240px] px-4 sm:px-6 h-11 flex items-center gap-6 overflow-x-auto snap-x-strip text-[13px]">
          {tabs.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 text-sub hover:text-ink hover:no-underline">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-5 flex flex-col gap-12 sm:gap-16">
        <div className="flex flex-col gap-4">
          <nav aria-label="パンくず" className="text-xs text-mute flex flex-wrap items-center gap-1">
            <Link href="/" className="text-mute">
              トップ
            </Link>
            <ChevronRight size={12} aria-hidden="true" />
            <Link href="/" className="text-mute">
              {device.categoryName}
            </Link>
            <ChevronRight size={12} aria-hidden="true" />
            <Link href={`/?brand=${encodeURIComponent(device.brand)}`} className="text-mute">
              {device.brand}
            </Link>
            <ChevronRight size={12} aria-hidden="true" />
            <span className="text-sub truncate max-w-[60vw]">{device.name}</span>
          </nav>

          {/* 上段：画像 ／ 商品情報・選択肢 ／ 申し込み */}
          <div id="purchase" className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-8 scroll-mt-28">
            <div className="flex flex-col gap-4 lg:sticky lg:top-[124px] lg:self-start">
              <Gallery device={device} />
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="border border-line rounded-[6px] px-2 py-0.5 text-xs text-sub">メーカー</span>
                <Link href={`/?brand=${encodeURIComponent(device.brand)}`}>{device.brand} の製品一覧</Link>
                {released && <span className="text-mute ml-auto">{released}</span>}
              </div>
              {s.highlights.length > 0 && (
                <ul className="m-0 p-0 list-none grid grid-cols-3 border border-hair rounded-[12px] divide-x divide-hair">
                  {s.highlights.slice(0, 3).map((h) => (
                    <li key={h.key} className="flex flex-col items-center gap-1 py-3 px-1 text-center">
                      <Icon name={h.icon} size={20} strokeWidth={1.5} className="text-mute" />
                      <b className="text-[15px] font-semibold tabular-nums">{h.text}</b>
                      <span className="text-[11px] text-mute">{h.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ProductPurchase
              device={device}
              listed={listed}
              favicons={favicons}
              meta={
                <div className="flex flex-wrap items-center gap-4 text-[13px]">
                  <RatingSummary slug={device.slug} />
                  <ViewCount slug={device.slug} views={stats.views} />
                  {!device.verified && <span className="text-xs text-warn">仕様は確認中です</span>}
                </div>
              }
              likeSlot={
                <Suspense fallback={<LikeButtonPlaceholder likes={stats.likes} variant="button" />}>
                  <DeviceLike slug={device.slug} variant="button" />
                </Suspense>
              }
              links={[
                { href: `/?brand=${encodeURIComponent(device.brand)}`, label: `他の${device.brand}製品を探す` },
                { href: "/", label: `他の${device.categoryName}を探す` },
                { href: "/guide/grades", label: "品質グレードの基準を見る" },
              ]}
            />
          </div>
        </div>

        {/* 必ずご確認ください */}
        <section aria-label="ご確認ください" className="rounded-[12px] border border-[#f5c2c7] bg-[#fdf3f4] px-5 py-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
          <p className="m-0 inline-flex items-center gap-2 font-semibold text-[15px]">
            <AlertCircle size={18} className="text-[#d70015]" aria-hidden="true" />
            必ずご確認ください
          </p>
          <ul className="m-0 pl-4 list-disc text-[13px] leading-relaxed text-sub">
            <li>レンタルの審査・契約・配送・請求は各レンタル会社が行います。xmall はお見積りの取り次ぎ（無料）です。</li>
            <li>
              表示中のレンタル会社名・月額・在庫は<b className="text-[#d70015] font-semibold">サンプル</b>です。正式な金額は見積でご確認ください。
            </li>
            <li>「他社サイトの掲載価格」は各社の公開ページから取得した参考価格で、xmall の提携先ではありません。</li>
          </ul>
        </section>

        {/* 含まれるもの */}
        <Section id="included" title="レンタルに含まれるもの">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-[15px] font-semibold">品質グレード（xmall 基準）</h3>
              <table className="w-full text-[13px] border-collapse">
                <tbody>
                  {GRADE_CODES.map((g) => (
                    <tr key={g} className="border-t border-hair">
                      <th className="text-left font-semibold py-2 pr-3 w-10 align-top">{g}</th>
                      <td className="py-2 text-sub">
                        {GRADES[g].label}・{GRADES[g].appearance}
                        <span className="block text-xs text-mute">
                          バッテリー {GRADES[g].batteryMin}・保証 {GRADES[g].warranty}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-[15px] font-semibold">セットアップ（届いてすぐ使える）</h3>
              <ul className="m-0 p-0 list-none flex flex-col">
                {TEMPLATE_CODES.map((t) => (
                  <li key={t} className="border-t border-hair py-2 text-[13px]">
                    <b className="font-semibold">{TEMPLATES[t].label}</b>
                    <span className="block text-xs text-mute">{TEMPLATES[t].items.join("・")}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-[15px] font-semibold">サービス</h3>
              <ul className="m-0 p-0 list-none flex flex-col">
                {[
                  ["故障時の修理・交換", "通常使用による故障は各社が対応（対応速度は会社ごと）"],
                  ["返却時のデータ消去", "端末ごとの消去証明書を発行"],
                  ["MDM 登録・ディスク暗号化", "一般事務・デザイン・開発テンプレートに含まれます"],
                  ["配送・回収", "送料は会社・地域により異なります（サンプル）"],
                ].map(([k, v]) => (
                  <li key={k} className="border-t border-hair py-2 text-[13px] flex gap-2">
                    <Check size={15} className="text-ok shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      <b className="font-semibold">{k}</b>
                      <span className="block text-xs text-mute">{v}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {related.length > 0 && (
          <Section id="related" title="関連商品">
            <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto snap-x-strip -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
              {related.map(({ d, note }) => (
                <RelatedCard key={d.slug} d={d} rent={summarize(d).rentFrom} note={note} />
              ))}
            </div>
          </Section>
        )}

        {c && (
          <Section id="overview" title="商品説明">
            <p className="m-0 max-w-[880px] text-[17px] leading-relaxed">{c.summary}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-[12px] bg-ok-soft/60 px-5 py-4">
                <h3 className="m-0 mb-2.5 text-[15px] font-semibold text-ok">こんな方におすすめ</h3>
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {c.goodFor.map((x) => (
                    <li key={x} className="flex gap-2 text-sm">
                      <Check size={16} className="text-ok shrink-0 mt-0.5" aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[12px] bg-ground px-5 py-4">
                <h3 className="m-0 mb-2.5 text-[15px] font-semibold text-sub">向いていない方</h3>
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {c.notFor.map((x) => (
                    <li key={x} className="flex gap-2 text-sm text-sub">
                      <X size={16} className="text-faint shrink-0 mt-0.5" aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {c.scenes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {c.scenes.map((x) => {
                  const SceneIcon = sceneIcon(x.title);
                  return (
                    <div key={x.title} className="border border-hair rounded-[12px] p-4 flex flex-col gap-1.5">
                      <SceneIcon size={22} strokeWidth={1.5} className="text-mute" aria-hidden="true" />
                      <p className="m-0 text-[15px] font-semibold">{x.title}</p>
                      <p className="m-0 text-[13px] text-sub leading-relaxed">{x.body}</p>
                      <p className="m-0 mt-auto pt-1 text-xs text-link">おすすめ：{x.recommend}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {specs.length > 0 && (
          <Section id="specs" title="スペック" aside={<span className="text-xs text-mute">数値の下に「つまりどういうこと？」を添えています</span>}>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {specs.map((x) => (
                  <tr key={x.key} className="border-b border-hair">
                    <th className="bg-ground text-left font-semibold align-top px-4 py-3.5 w-[34%] sm:w-[220px]">
                      <span className="inline-flex items-center gap-2">
                        <Icon name={x.icon} size={16} className="text-mute shrink-0" />
                        {x.label}
                      </span>
                    </th>
                    <td className="px-4 py-3.5 align-top">
                      {x.display}
                      {x.plain && <span className="block mt-1 text-[13px] text-mute leading-relaxed">{x.plain}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {c?.choose.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {c.choose.map((x) => (
                  <div key={x.title} className="rounded-[12px] bg-ground px-5 py-4">
                    <p className="m-0 mb-1 text-[15px] font-semibold">{x.title}</p>
                    <p className="m-0 text-[13px] text-sub leading-relaxed">{x.body}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>
        )}

        {c?.faqs.length ? (
          <Section id="faq" title="よくある質問">
            <div>
              {c.faqs.map((f) => (
                <details key={f.q} className="border-b border-hair">
                  <summary className="flex justify-between items-center gap-4 py-4 text-[15px] font-semibold">
                    <span>
                      <span className="text-brand mr-2">Q</span>
                      {f.q}
                    </span>
                    <ChevronDown size={18} className="chev text-mute shrink-0" aria-hidden="true" />
                  </summary>
                  <p className="m-0 pb-4 pl-6 text-sm leading-relaxed text-sub">{f.a}</p>
                </details>
              ))}
            </div>
          </Section>
        ) : null}

        <Section id="reviews" title="口コミ" aside={<RatingSummary slug={device.slug} large />}>
          <Suspense fallback={<p className="m-0 text-sm text-mute">読み込み中…</p>}>
            <DeviceReviews slug={device.slug} />
          </Suspense>
          <ReviewForm slug={device.slug} deviceName={device.name} />
        </Section>

        {device.sources.length > 0 && (
          <details className="text-xs text-faint -mt-6">
            <summary>仕様・価格の出典（{device.sources.length}）</summary>
            <ul className="m-0 mt-2 pl-4 list-disc flex flex-col gap-1">
              {device.sources.map((x) => (
                <li key={x.url}>
                  <a href={x.url} rel="noopener" target="_blank" className="text-mute">
                    {x.title}
                  </a>
                  （{x.accessed}）
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}
