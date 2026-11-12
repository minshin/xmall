import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, CircleDot, Clapperboard, Code2, Info, Palette, Presentation, X, type LucideIcon } from "lucide-react";
import { DeviceLike, DeviceReviews, RatingSummary } from "@/components/Community";
import { Gallery } from "@/components/Gallery";
import { Icon } from "@/components/icons";
import { ProductPurchase } from "@/components/ProductPurchase";
import { LikeButtonPlaceholder, ReviewForm, ViewCount } from "@/components/Social";
import { DeviceThumb, SiteIcon } from "@/components/ui";
import { displaySpecs, summarize } from "@/lib/catalog";
import { getDevices, getFavicons, getSites, getVariantAttrs } from "@/lib/catalog-server";
import { getStats } from "@/lib/community";
import { yen } from "@/lib/format";
import { deviceJsonLd } from "@/lib/jsonld";
import { landingFacets } from "@/lib/landing";
import { cheapestPerCompany, companyCount, lowestMonthly, offerSpec, TAX_LABEL } from "@/lib/pricing";
import type { Device } from "@/lib/types";
import { brandPath, categoryPath, productPath } from "@/lib/urls";

type Props = PageProps<"/[category]/[slug]">;

async function load(params: Props["params"]) {
  const { category, slug } = await params;
  return (await getDevices()).find((d) => d.slug === slug && d.categoryId === category);
}

export async function generateStaticParams() {
  return (await getDevices()).map((d) => ({ category: d.categoryId, slug: d.slug }));
}

/** 解説が無い機種の説明文（実データの集計から作る） */
function autoSummary(d: Device): string {
  const n = companyCount(d);
  const low = lowestMonthly(d);
  const cpus = [...new Set(d.rentals.map((o) => o.cpu).filter(Boolean))].slice(0, 3);
  const mems = [...new Set(d.rentals.map((o) => o.memoryGb).filter((x): x is number => !!x))].sort((a, b) => a - b);
  const parts = [`${d.brand} ${d.name}は、法人向けの${d.categoryName}です。`];
  if (n) parts.push(`${n}社のレンタル会社が${d.rentals.length}件掲載しており、月額は${yen(low!)}から借りられます（各社の掲載価格・税込換算）。`);
  if (cpus.length) parts.push(`掲載されている構成のCPUは${cpus.join("、")}${mems.length ? `、メモリは${mems.join("・")}GB` : ""}です。`);
  return parts.join("");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load(params);
  if (!d) return {};
  const low = lowestMonthly(d);
  const n = companyCount(d);
  return {
    title: `${d.brand} ${d.name}のレンタル${low ? `｜月額${yen(low)}〜・${n}社比較` : "・購入価格比較"}`,
    description: (d.content?.summary ?? autoSummary(d)).slice(0, 120),
    alternates: { canonical: productPath(d) },
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
    <Link href={productPath(d)} className="group shrink-0 w-[200px] sm:w-auto text-ink hover:no-underline flex flex-col gap-2">
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

export default async function DevicePage({ params }: Props) {
  const device = await load(params);
  if (!device) notFound();
  const [stats, favicons, variantAttrs, all, sites] = await Promise.all([
    getStats(device.slug),
    getFavicons(),
    getVariantAttrs(device.categoryId),
    getDevices(),
    getSites(),
  ]);
  const s = summarize(device, variantAttrs);
  const c = device.content;
  const specs = displaySpecs(device.specs);
  const makerUrl = sites.find((x) => x.id === device.brandId)?.url ?? null;
  const facets = landingFacets(all, device.categoryId);
  const brandHref = facets.brands.some((b) => b.id === device.brandId) ? brandPath(device.categoryId, device.brandId) : categoryPath(device.categoryId);
  // 期間別の料金表：会社ごと・仕様ごと（同じ会社の同じ仕様は最安の 1 件）
  const priceRows = device.rentals;
  const termCols = [1, 3, 6, 12, 24, 36].filter((t) => priceRows.some((o) => o.plans.some((p) => p.months === t)));
  const perCompany = cheapestPerCompany(device.rentals);
  const relatedFromContent = (c?.related ?? []).flatMap((r) => {
    const rd = all.find((x) => x.slug === r.slug);
    return rd ? [{ d: rd, note: r.diff }] : [];
  });
  // 関連商品：解説で指定したもの → 同じメーカー → 月額が近い同じ品目の機種（最大 6）
  const myLow = lowestMonthly(device) ?? 0;
  const related = [
    ...relatedFromContent,
    ...all
      .filter((x) => x.categoryId === device.categoryId && x.slug !== device.slug && !relatedFromContent.some((r) => r.d.slug === x.slug))
      .sort(
        (a, b) =>
          Number(b.brandId === device.brandId) - Number(a.brandId === device.brandId) ||
          Math.abs((lowestMonthly(a) ?? 1e9) - myLow) - Math.abs((lowestMonthly(b) ?? 1e9) - myLow),
      )
      .map((d) => ({ d, note: undefined as string | undefined })),
  ].slice(0, 6);
  const released = device.releaseDate ? `${device.releaseDate.slice(0, 4)}年${Number(device.releaseDate.slice(5, 7))}月発売` : null;

  const tabs = [
    ["purchase", "料金・プラン"],
    ...(priceRows.length ? [["prices", "期間別の料金"]] : []),
    ["overview", "商品説明"],
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
            <Link href={categoryPath(device.categoryId)} className="text-mute">
              {device.categoryName}
            </Link>
            <ChevronRight size={12} aria-hidden="true" />
            <Link href={brandHref} className="text-mute">
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
                <Link href={brandHref}>{device.brand} の製品一覧</Link>
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
              favicons={favicons}
              makerUrl={makerUrl}
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
                { href: brandHref, label: `他の${device.brand}製品を探す` },
                { href: categoryPath(device.categoryId), label: `他の${device.categoryName}を探す` },
                ...facets.prices.slice(0, 2).map((p) => ({ href: `/${device.categoryId}/price/${p.band.id}`, label: `${p.band.label}の${device.categoryName}` })),
              ]}
            />
          </div>
        </div>

        {/* 価格について */}
        <section aria-label="価格について" className="rounded-[12px] bg-ground px-5 py-4 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
          <p className="m-0 inline-flex items-center gap-2 font-semibold text-[15px]">
            <Info size={18} className="text-link" aria-hidden="true" />
            価格について
          </p>
          <ul className="m-0 pl-4 list-disc text-[13px] leading-relaxed text-sub">
            <li>レンタル月額は各レンタル会社の公開ページに掲載されている価格です（取得日を表示）。xmall の提携先ではありません。</li>
            <li>税込・税抜は各社の表記どおりです。「安い順」は税抜表示を税込に換算して並べています。</li>
            <li>送料・初期費用・オプションは会社ごとに異なります。契約前に各社のサイトでご確認ください。</li>
          </ul>
        </section>

        {priceRows.length > 0 && (
          <Section id="prices" title="期間別の料金" aside={<span className="text-xs text-mute">{perCompany.length}社・{priceRows.length}件の掲載（1台あたりの月額）</span>}>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink text-left text-xs text-mute">
                    <th className="font-medium py-2 pr-3">レンタル会社・掲載内容</th>
                    {termCols.map((t) => (
                      <th key={t} className="font-medium py-2 px-2 text-right whitespace-nowrap">
                        {t}か月〜
                      </th>
                    ))}
                    <th className="font-medium py-2 pl-2 text-right">取得日</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRows.map((o) => (
                    <tr key={o.key} className="border-b border-hair align-top">
                      <td className="py-3 pr-3">
                        <a href={o.url} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-ink">
                          <SiteIcon src={favicons[o.companyId]} name={o.companyName} size={18} />
                          {o.companyName}
                          <ArrowUpRight size={13} className="text-faint" aria-hidden="true" />
                        </a>
                        <span className="block mt-0.5 text-xs text-mute">
                          {offerSpec(o) || o.title}・{TAX_LABEL[o.priceTax]}
                        </span>
                      </td>
                      {termCols.map((t) => {
                        const p = o.plans.find((x) => x.months === t);
                        return (
                          <td key={t} className={`py-3 px-2 text-right tabular-nums whitespace-nowrap ${p && p.monthly === o.monthly ? "font-semibold" : ""}`}>
                            {p ? yen(p.monthly) : <span className="text-faint">—</span>}
                          </td>
                        );
                      })}
                      <td className="py-3 pl-2 text-right text-xs text-mute whitespace-nowrap">{o.fetchedAt.replaceAll("-", "/")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 text-xs text-mute">「◯か月〜」はその期間以上の契約での月額です。太字は掲載ごとの最安。</p>
          </Section>
        )}

        {related.length > 0 && (
          <Section id="related" title="関連商品">
            <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto snap-x-strip -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
              {related.map(({ d, note }) => (
                <RelatedCard key={d.slug} d={d} rent={lowestMonthly(d)} note={note} />
              ))}
            </div>
          </Section>
        )}

        {!c && (
          <Section id="overview" title="商品説明">
            <p className="m-0 max-w-[880px] text-[17px] leading-relaxed">{autoSummary(device)}</p>
            <p className="m-0 text-xs text-mute">画面サイズ・重さなどの詳しい仕様は、メーカーの公式情報で確認でき次第追加します。</p>
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
