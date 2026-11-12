import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Check, ChevronDown, CircleDot, Clapperboard, Code2, Palette, Presentation, X, type LucideIcon } from "lucide-react";
import { DeviceLike, DeviceReviews, RatingSummary } from "@/components/Community";
import { Gallery } from "@/components/Gallery";
import { Icon } from "@/components/icons";
import { PriceSection, type ListedOffer } from "@/components/PriceSection";
import { LikeButtonPlaceholder, ReviewForm, ViewCount } from "@/components/Social";
import { DeviceThumb } from "@/components/ui";
import { displaySpecs, summarize } from "@/lib/catalog";
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
      note: `${p.label.replace(/^月額制/, "").replace(/^[（(]|[）)]$/g, "")}${l.priceTax === "incl" ? "・税込" : l.priceTax === "excl" ? "・税抜" : ""}`.replace(/^・/, ""),
      url: l.url,
      inStock: l.inStock,
    };
    const k = `${l.companyId}|${spec}`;
    const cur = best.get(k);
    if (!cur || offer.monthly < cur.monthly) best.set(k, offer);
  }
  return [...best.values()].sort((a, b) => a.monthly - b.monthly);
}

/**
 * 見出しを 1 行に収める文字サイズ。文字の幅（em）を見積もり、画面幅（vw）に合わせて縮める。
 * 和文・全角は 1em、英数字は約 0.58em、空白は約 0.28em。最小 24px を下回るほど長い名前は折り返しを許す。
 */
function fitTitle(text: string, maxPx: number): { fontSize: string; nowrap: boolean } {
  let ems = 0;
  for (const ch of text) ems += /\s/.test(ch) ? 0.28 : /[\u0000-\u024f]/.test(ch) ? 0.58 : 1;
  const vw = 88 / Math.max(ems, 1); // 左右の余白を除いた幅 ≒ 88vw
  return { fontSize: `min(${maxPx}px, ${vw.toFixed(2)}vw)`, nowrap: (390 * vw) / 100 >= 24 };
}

/** 通しの帯（カードではなく、背景色の切り替えで区切る） */
function Band({ id, tone = "white", children, labelledBy }: { id?: string; tone?: "white" | "gray"; children: React.ReactNode; labelledBy?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${tone === "white" ? "bg-white" : "bg-ground"} scroll-mt-24`}>
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 py-16 sm:py-24">{children}</div>
    </section>
  );
}

function SectionTitle({ id, eyebrow, children }: { id: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="mb-10 sm:mb-14">
      {eyebrow && <p className="m-0 mb-2 text-[17px] font-semibold text-mute">{eyebrow}</p>}
      <h2 id={id} className="m-0 text-[32px] sm:text-[48px] font-semibold leading-[1.1]">
        {children}
      </h2>
    </div>
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
  const related = (c?.related ?? []).flatMap((r) => {
    const rd = all.find((x) => x.slug === r.slug);
    return rd ? [{ r, rd, rs: summarize(rd) }] : [];
  });
  const released = device.releaseDate ? `${device.releaseDate.slice(0, 4)}年${Number(device.releaseDate.slice(5, 7))}月発売` : null;
  const [lead, ...rest] = (c?.summary ?? "").split("。").filter(Boolean);
  const title = fitTitle(device.name, 64);

  const nav = [
    ["price", "価格"],
    ...(c ? [["overview", "概要"]] : []),
    ...(specs.length ? [["specs", "スペック"]] : []),
    ...(c?.faqs.length ? [["faq", "FAQ"]] : []),
    ["reviews", "口コミ"],
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(deviceJsonLd(device)) }} />

      {/* 製品サブナビ */}
      <div className="sticky top-12 z-30 bg-[rgb(255_255_255/0.72)] backdrop-blur-xl backdrop-saturate-150 border-b border-black/5">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 h-11 flex items-center gap-5">
          <p className="m-0 text-[15px] sm:text-[17px] font-semibold truncate">{device.name}</p>
          <nav aria-label="このページ" className="hidden md:flex gap-6 text-[12px] ml-auto">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-sub hover:text-ink hover:no-underline">
                {label}
              </a>
            ))}
          </nav>
          <a href="#price" className="btn btn-primary !py-1 !px-3 !text-[12px] ml-auto md:ml-0 shrink-0">
            価格を比べる
          </a>
        </div>
      </div>

      {/* ヒーロー */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20 flex flex-col items-center text-center gap-10">
          <div className="flex flex-col items-center gap-3 animate-rise">
            <p className="m-0 text-[15px] text-mute">
              <Link href="/" className="text-mute">
                {device.categoryName}
              </Link>
              ・{device.brand}
              {released ? `・${released}` : ""}
            </p>
            <h1
              className={`m-0 font-semibold leading-[1.08] tracking-[-0.03em] ${title.nowrap ? "whitespace-nowrap" : "text-balance"}`}
              style={{ fontSize: title.fontSize }}
            >
              {device.name}
            </h1>
            {device.subtitle && <p className="m-0 text-[24px] sm:text-[32px] font-semibold text-mute leading-tight">{device.subtitle}</p>}
            <p className="m-0 mt-3 text-[17px] sm:text-[19px] flex flex-col sm:flex-row sm:items-baseline items-center gap-x-2 gap-y-0.5">
              {s.rentFrom ? (
                <span className="whitespace-nowrap">
                  月額 <b className="font-semibold tabular-nums">{yen(s.rentFrom)}</b>〜で借りる
                </span>
              ) : null}
              {s.rentFrom && s.buyFrom ? <span className="hidden sm:inline text-faint">／</span> : null}
              {s.buyFrom ? (
                <span className="whitespace-nowrap">
                  <b className="font-semibold tabular-nums">{yen(s.buyFrom)}</b>〜で買う
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-5 mt-2">
              <a href="#price" className="btn btn-primary">
                価格を比べる
              </a>
              <a href="#reviews" className="text-[17px]">
                口コミを見る ›
              </a>
            </div>
            <div className="flex items-center gap-5 text-sm mt-1">
              <RatingSummary slug={device.slug} />
              <Suspense fallback={<LikeButtonPlaceholder likes={stats.likes} />}>
                <DeviceLike slug={device.slug} />
              </Suspense>
              <ViewCount slug={device.slug} views={stats.views} />
            </div>
            {!device.verified && <p className="m-0 text-xs text-faint">仕様は確認中です。最新の仕様はメーカー公式でご確認ください。</p>}
          </div>

          <div className="w-full max-w-[980px]">
            <Gallery device={device} />
          </div>

          {s.highlights.length > 0 && (
            <ul className="m-0 p-0 list-none grid grid-cols-3 w-full max-w-[720px] divide-x divide-hair">
              {s.highlights.slice(0, 3).map((h) => (
                <li key={h.key} className="flex flex-col items-center gap-2 px-2">
                  <Icon name={h.icon} size={28} strokeWidth={1.3} className="text-ink" />
                  <b className="text-[19px] sm:text-[24px] font-semibold leading-none tabular-nums">{h.text}</b>
                  <span className="text-xs text-mute">{h.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 価格 */}
      <section id="price" aria-labelledby="price-h" className="bg-ground scroll-mt-24">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 py-16 sm:py-24">
          <PriceSection device={device} listed={listed} favicons={favicons} />
        </div>
      </section>

      {c && (
        <Band id="overview" labelledBy="overview-h">
          <p className="m-0 mb-3 text-[17px] font-semibold text-mute">ひとことで言うと</p>
          <h2 id="overview-h" className="m-0 max-w-[860px] text-[26px] sm:text-[34px] font-semibold leading-[1.35]">
            {lead}。
          </h2>
          {rest.length > 0 && <p className="m-0 mt-5 mb-16 max-w-[760px] text-[17px] sm:text-[19px] leading-relaxed text-sub">{rest.join("。")}。</p>}

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 mb-16">
            <div>
              <h3 className="m-0 mb-4 text-[17px] font-semibold">こんな方に</h3>
              <ul className="m-0 p-0 list-none flex flex-col gap-3">
                {c.goodFor.map((x) => (
                  <li key={x} className="flex gap-3 text-[17px] leading-snug">
                    <Check size={20} strokeWidth={2.2} className="text-ok shrink-0 mt-0.5" aria-hidden="true" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="m-0 mb-4 text-[17px] font-semibold text-mute">向いていない方</h3>
              <ul className="m-0 p-0 list-none flex flex-col gap-3">
                {c.notFor.map((x) => (
                  <li key={x} className="flex gap-3 text-[17px] leading-snug text-mute">
                    <X size={20} strokeWidth={2.2} className="text-faint shrink-0 mt-0.5" aria-hidden="true" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {c.scenes.length > 0 && (
            <>
              <h3 className="m-0 mb-6 text-[24px] font-semibold">使い方の例</h3>
              <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {c.scenes.map((x) => {
                  const SceneIcon = sceneIcon(x.title);
                  return (
                    <div key={x.title} className="flex flex-col gap-2 border-t border-hair pt-5">
                      <SceneIcon size={28} strokeWidth={1.3} className="text-ink" aria-hidden="true" />
                      <p className="m-0 mt-1 text-[17px] font-semibold">{x.title}</p>
                      <p className="m-0 text-[15px] text-sub leading-relaxed">{x.body}</p>
                      <p className="m-0 mt-auto pt-1 text-[13px] text-mute">おすすめ：{x.recommend}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Band>
      )}

      {specs.length > 0 && (
        <Band id="specs" tone="gray" labelledBy="specs-h">
          <SectionTitle id="specs-h" eyebrow="スペック">
            数字の意味まで、
            <br className="sm:hidden" />
            やさしく。
          </SectionTitle>
          <dl className="m-0 border-b border-line">
            {specs.map((x) => (
              <div key={x.key} className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-8 gap-y-1.5 py-6 border-t border-line">
                <dt className="text-[17px] font-semibold">{x.label}</dt>
                <dd className="m-0">
                  <p className="m-0 text-[17px]">{x.display}</p>
                  {x.plain && <p className="m-0 mt-1.5 text-[15px] text-mute leading-relaxed max-w-[640px]">{x.plain}</p>}
                </dd>
              </div>
            ))}
          </dl>
          {c?.choose.length ? (
            <div className="mt-16">
              <h3 className="m-0 mb-6 text-[24px] font-semibold">構成の選び方</h3>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                {c.choose.map((x) => (
                  <div key={x.title}>
                    <p className="m-0 mb-1.5 text-[17px] font-semibold">{x.title}</p>
                    <p className="m-0 text-[15px] text-sub leading-relaxed">{x.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Band>
      )}

      {c?.faqs.length ? (
        <Band id="faq" labelledBy="faq-h">
          <SectionTitle id="faq-h" eyebrow="よくある質問">
            気になること。
          </SectionTitle>
          <div className="border-b border-line">
            {c.faqs.map((f) => (
              <details key={f.q} className="border-t border-line">
                <summary className="flex justify-between items-center gap-4 py-5 text-[17px] sm:text-[19px] font-semibold">
                  {f.q}
                  <ChevronDown size={22} className="chev text-mute shrink-0" aria-hidden="true" />
                </summary>
                <p className="m-0 pb-6 max-w-[760px] text-[17px] leading-relaxed text-sub">{f.a}</p>
              </details>
            ))}
          </div>
        </Band>
      ) : null}

      <Band id="reviews" tone="gray" labelledBy="reviews-h">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="m-0 mb-2 text-[17px] font-semibold text-mute">口コミ</p>
            <h2 id="reviews-h" className="m-0 text-[32px] sm:text-[48px] font-semibold leading-[1.1]">
              使っている人の声。
            </h2>
          </div>
          <RatingSummary slug={device.slug} large />
        </div>
        <div className="flex flex-col gap-6">
          <Suspense fallback={<p className="m-0 text-sm text-mute">読み込み中…</p>}>
            <DeviceReviews slug={device.slug} />
          </Suspense>
          <ReviewForm slug={device.slug} deviceName={device.name} />
        </div>
      </Band>

      {related.length ? (
        <Band labelledBy="related-h">
          <SectionTitle id="related-h" eyebrow="比べてみる">
            よく比較される製品。
          </SectionTitle>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {related.map(({ r, rd, rs }) => (
              <Link key={r.slug} href={`/pc/${r.slug}`} className="group text-ink hover:no-underline flex flex-col gap-4">
                <div className="aspect-[16/10] rounded-[20px] bg-ground overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
                  <DeviceThumb device={rd} sizes="(max-width: 640px) 100vw, 340px" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="m-0 text-[19px] font-semibold">{rd.name}</p>
                  <p className="m-0 text-[15px] text-mute leading-snug">{r.diff}</p>
                  <p className="m-0 mt-1 text-[15px]">
                    月額 <b className="font-semibold tabular-nums">{rs.rentFrom ? yen(rs.rentFrom) : "—"}</b>〜
                    <span className="text-link ml-2 group-hover:underline">詳しく見る ›</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Band>
      ) : null}

      {device.sources.length > 0 && (
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 py-8">
          <details className="text-xs text-faint">
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
        </div>
      )}
    </main>
  );
}
