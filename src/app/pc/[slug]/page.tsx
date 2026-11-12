import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Check, ChevronDown, CircleDot, Clapperboard, Code2, Palette, Presentation, Sparkles, X, type LucideIcon } from "lucide-react";
import { DeviceLike, DeviceReviews, RatingSummary } from "@/components/Community";
import { Gallery } from "@/components/Gallery";
import { PriceSection, type ListedOffer } from "@/components/PriceSection";
import { LikeButtonPlaceholder, ReviewForm, ViewCount } from "@/components/Social";
import { Icon } from "@/components/icons";
import { DeviceThumb } from "@/components/ui";
import { summarize } from "@/lib/catalog";
import { getDevice, getDevices, getFavicons, getVariantAttrs } from "@/lib/catalog-server";
import { getRentalListings, getStats } from "@/lib/community";
import { yen } from "@/lib/format";
import { deviceJsonLd } from "@/lib/jsonld";
import type { RentalListing } from "@/lib/types";

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
    openGraph: d.images?.[0] ? { images: [{ url: d.images[0].src, width: d.images[0].width, height: d.images[0].height }] } : undefined,
  };
}

const SCENE_ICON: [RegExp, LucideIcon][] = [
  [/デザイン|画像/, Palette],
  [/動画|SNS/, Clapperboard],
  [/開発|ソフトウェア/, Code2],
  [/プレゼン|営業|経営/, Presentation],
];
const iconFor = (table: [RegExp, LucideIcon][], text: string) => table.find(([re]) => re.test(text))?.[1] ?? CircleDot;

/** 実在レンタル会社の掲載を、価格欄に出す最小限の形にする（月額表示があるものだけ・安い順） */
function toListed(listings: RentalListing[]): ListedOffer[] {
  const out: ListedOffer[] = [];
  for (const l of listings) {
    const p = l.prices.filter((x) => x.basis === "per_month").sort((a, b) => a.priceYen - b.priceYen)[0];
    if (!p) continue;
    const storage = l.storageGb ? (l.storageGb >= 1024 ? `${l.storageGb / 1024}TB` : `${l.storageGb}GB`) : null;
    out.push({
      key: `${l.companyId}:${l.externalId}`,
      companyId: l.companyId,
      companyName: l.companyName,
      spec: [l.memoryGb ? `${l.memoryGb}GB` : null, storage].filter(Boolean).join(" / ") || l.title,
      monthly: p.priceYen,
      note: `${p.label.replace(/^月額制/, "")}・${l.priceTax === "incl" ? "税込" : l.priceTax === "excl" ? "税抜" : "税区分不明"}`.replace(/^・/, ""),
      url: l.url,
      inStock: l.inStock,
    });
  }
  return out.sort((a, b) => a.monthly - b.monthly);
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
  const listed = toListed(listings);
  const related = (c?.related ?? []).flatMap((r) => {
    const rd = all.find((x) => x.slug === r.slug);
    return rd ? [{ r, rd, rs: summarize(rd) }] : [];
  });

  const nav = [
    ["price", "価格"],
    ...(c ? [["overview", "概要"]] : []),
    ...(device.specs.length ? [["specs", "スペック"]] : []),
    ...(c?.faqs.length ? [["faq", "FAQ"]] : []),
    ["reviews", "口コミ"],
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(deviceJsonLd(device)) }} />

      {/* 製品サブナビ（Apple 風・スクロールで固定） */}
      <div className="sticky top-12 z-30 bg-[rgb(255_255_255/0.72)] backdrop-blur-xl backdrop-saturate-150 border-b border-black/5">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 h-13 flex items-center gap-5">
          <p className="m-0 text-[17px] sm:text-[19px] font-semibold truncate">{device.name}</p>
          <nav aria-label="このページ" className="hidden sm:flex gap-5 text-[12px] ml-auto">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-sub hover:text-ink hover:no-underline">
                {label}
              </a>
            ))}
          </nav>
          <a href="#price" className="btn btn-primary !py-1 !px-3.5 !text-[12px] ml-auto sm:ml-0">
            比較する
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 py-8 flex flex-col gap-8">
        <nav aria-label="パンくず" className="text-xs text-faint -mb-4">
          <Link href="/" className="text-faint">
            {device.categoryName}
          </Link>{" "}
          › {device.brand}
        </nav>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1.25fr_1fr] items-start">
          <Gallery device={device} />
          <div className="flex flex-col gap-5 animate-rise">
            <div>
              <p className="m-0 text-sm text-buy font-medium">
                {device.releaseDate ? `${device.releaseDate.slice(0, 4)}年${Number(device.releaseDate.slice(5, 7))}月発売` : device.brand}
              </p>
              <h1 className="m-0 mt-1 text-[34px] sm:text-[44px] font-semibold leading-[1.08]">
                {device.name}
                {device.subtitle && <span className="block text-[21px] sm:text-[24px] font-medium text-mute mt-1">{device.subtitle}</span>}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-sm">
              <ViewCount slug={device.slug} views={stats.views} />
              <Suspense fallback={<LikeButtonPlaceholder likes={stats.likes} />}>
                <DeviceLike slug={device.slug} />
              </Suspense>
              <RatingSummary slug={device.slug} />
            </div>

            {s.highlights.length > 0 && (
              <ul className="m-0 p-0 list-none grid grid-cols-3 gap-2 text-center">
                {s.highlights.slice(0, 3).map((h) => (
                  <li key={h.key} className="bg-white rounded-[14px] py-3 px-1 flex flex-col items-center gap-1">
                    <Icon name={h.icon} size={20} strokeWidth={1.6} className="text-mute" />
                    <b className="text-[15px] font-semibold">{h.text}</b>
                    <span className="text-[11px] text-faint">{h.label}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2">
              <a href="#price" className="card lift p-4 text-ink hover:no-underline">
                <p className="m-0 text-xs text-brand font-medium">借りる</p>
                <p className="m-0 mt-1">
                  <b className="text-[24px] font-semibold tabular-nums">{s.rentFrom ? yen(s.rentFrom) : "—"}</b>
                  <span className="text-xs text-mute">/月〜</span>
                </p>
              </a>
              <a href="#price" className="card lift p-4 text-ink hover:no-underline">
                <p className="m-0 text-xs text-buy font-medium">買う</p>
                <p className="m-0 mt-1">
                  <b className="text-[24px] font-semibold tabular-nums">{s.buyFrom ? yen(s.buyFrom) : "—"}</b>
                  {s.buyFrom ? <span className="text-xs text-mute">〜</span> : null}
                </p>
              </a>
            </div>

            {!device.verified && (
              <p className="m-0 text-xs text-warn bg-warn-soft rounded-[12px] px-3.5 py-2.5">仕様は確認中です。メーカー公式をご確認ください。</p>
            )}
          </div>
        </section>

        <PriceSection device={device} listed={listed} favicons={favicons} />

        {c && (
          <>
            <section id="overview" aria-labelledby="overview-h" className="card p-6 sm:p-8 flex flex-col gap-6 scroll-mt-28">
              <h2 id="overview-h" className="m-0 text-[28px] font-semibold">
                ひとことで言うと
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-sub max-w-[760px]">{c.summary}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
                  {c.goodFor.map((x) => (
                    <li key={x} className="flex gap-2.5 text-[15px]">
                      <span className="mt-0.5 size-5 shrink-0 rounded-full bg-ok-soft text-ok flex items-center justify-center">
                        <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      {x}
                    </li>
                  ))}
                </ul>
                <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
                  {c.notFor.map((x) => (
                    <li key={x} className="flex gap-2.5 text-[15px] text-mute">
                      <span className="mt-0.5 size-5 shrink-0 rounded-full bg-ground text-faint flex items-center justify-center">
                        <X size={13} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {c.scenes.map((x) => {
                  const SceneIcon = iconFor(SCENE_ICON, x.title);
                  return (
                    <div key={x.title} className="bg-ground rounded-[14px] p-4 flex flex-col gap-2">
                      <SceneIcon size={24} strokeWidth={1.5} className="text-brand" aria-hidden="true" />
                      <p className="m-0 font-semibold">{x.title}</p>
                      <p className="m-0 text-[13px] text-mute leading-relaxed line-clamp-3">{x.body}</p>
                      <p className="m-0 mt-auto text-xs text-brand font-medium">{x.recommend}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {device.specs.length > 0 && (
          <section id="specs" aria-labelledby="specs-h" className="card p-6 sm:p-8 scroll-mt-28">
            <h2 id="specs-h" className="m-0 mb-4 text-[28px] font-semibold">
              スペック
            </h2>
            <div className="divide-y divide-hair">
              {device.specs.map((x) =>
                x.plain ? (
                  <details key={x.key}>
                    <summary className="flex items-center gap-4 py-4">
                      <Icon name={x.icon} size={22} strokeWidth={1.5} className="text-mute shrink-0" />
                      <span className="w-24 shrink-0 text-sm text-mute">{x.label}</span>
                      <span className="flex-1 text-[15px]">{x.display}</span>
                      <ChevronDown size={18} className="chev text-faint shrink-0" aria-label="説明を表示" />
                    </summary>
                    <p className="m-0 mb-4 ml-[42px] sm:ml-[136px] text-sm text-sub leading-relaxed bg-ground rounded-[12px] px-4 py-3">{x.plain}</p>
                  </details>
                ) : (
                  <div key={x.key} className="flex items-center gap-4 py-4">
                    <Icon name={x.icon} size={22} strokeWidth={1.5} className="text-mute shrink-0" />
                    <span className="w-24 shrink-0 text-sm text-mute">{x.label}</span>
                    <span className="flex-1 text-[15px]">{x.display}</span>
                  </div>
                ),
              )}
            </div>
            {c?.choose.length ? (
              <details className="mt-4 bg-ground rounded-[14px] px-5">
                <summary className="flex items-center justify-between py-4 font-semibold">
                  構成の選び方
                  <ChevronDown size={18} className="chev text-faint" aria-hidden="true" />
                </summary>
                <div className="pb-4 flex flex-col gap-3">
                  {c.choose.map((x) => (
                    <p key={x.title} className="m-0 text-sm leading-relaxed text-sub">
                      <b className="text-ink">{x.title}</b>
                      <br />
                      {x.body}
                    </p>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        )}

        {c?.faqs.length ? (
          <>

            <section id="faq" aria-labelledby="faq-h" className="card p-6 sm:p-8 scroll-mt-28">
              <h2 id="faq-h" className="m-0 mb-2 text-[28px] font-semibold">
                よくある質問
              </h2>
              <div className="divide-y divide-hair">
                {c.faqs.map((f) => (
                  <details key={f.q}>
                    <summary className="flex justify-between items-center gap-3 py-4 text-[17px] font-medium">
                      {f.q}
                      <ChevronDown size={20} className="chev text-faint shrink-0" aria-hidden="true" />
                    </summary>
                    <p className="m-0 mb-4 text-[15px] leading-relaxed text-sub">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <section id="reviews" aria-labelledby="reviews-h" className="card p-6 sm:p-8 flex flex-col gap-5 scroll-mt-28">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h2 id="reviews-h" className="m-0 text-[28px] font-semibold">
              口コミ
            </h2>
            <RatingSummary slug={device.slug} large />
          </div>
          <Suspense fallback={<p className="m-0 text-sm text-mute">読み込み中…</p>}>
            <DeviceReviews slug={device.slug} />
          </Suspense>
          <ReviewForm slug={device.slug} deviceName={device.name} />
        </section>

        {related.length ? (
          <section aria-labelledby="related-h" className="flex flex-col gap-4">
            <h2 id="related-h" className="m-0 text-[28px] font-semibold">
              よく比較される製品
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {related.map(({ r, rd, rs }) => (
                <Link key={r.slug} href={`/pc/${r.slug}`} className="card lift overflow-hidden text-ink hover:no-underline flex flex-col">
                  <div className="aspect-[16/10] bg-white overflow-hidden">
                    <DeviceThumb device={rd} sizes="(max-width: 640px) 100vw, 340px" />
                  </div>
                  <div className="p-4 flex flex-col gap-1.5 flex-1">
                    <p className="m-0 font-semibold">{rd.name}</p>
                    <p className="m-0 text-[13px] text-mute leading-snug">{r.diff}</p>
                    <p className="m-0 mt-auto pt-1 text-sm">
                      <b className="font-semibold tabular-nums">{rs.rentFrom ? yen(rs.rentFrom) : "—"}</b>
                      <span className="text-xs text-mute">/月〜</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {device.sources.length > 0 && (
          <details className="text-xs text-faint">
            <summary className="inline-flex items-center gap-1">
              <Sparkles size={12} aria-hidden="true" />
              出典（{device.sources.length}）
            </summary>
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
