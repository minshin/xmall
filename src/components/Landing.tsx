import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { summarize } from "@/lib/catalog";
import { getCategories, getDevices } from "@/lib/catalog-server";
import { getAllStats } from "@/lib/community";
import { SITE_NAME, SITE_URL, yen } from "@/lib/format";
import { landingFacets, landingLead, landingStats, sortForLanding } from "@/lib/landing";
import type { Device } from "@/lib/types";
import { brandPath, categoryPath, pricePath, purposePath } from "@/lib/urls";
import { ProductCard } from "./ProductCard";

/**
 * 一覧ページ（品目・メーカー・価格帯・用途）の共通レイアウト。
 * ページごとに違うのは：見出し、実データの集計（機種数・掲載社数・月額の範囲）、機種の並び。
 */
export async function Landing({
  categoryId,
  title,
  subject,
  devices,
  crumbs,
  current,
}: {
  categoryId: string;
  /** 見出し（例：Lenovo のノートPCレンタル） */
  title: string;
  /** 説明文の主語（例：Lenovo のノートPC） */
  subject: string;
  devices: Device[];
  /** パンくず（トップ・品目の後ろに続くもの） */
  crumbs: { name: string; href: string }[];
  /** いま表示している絞り込み（ナビで強調する） */
  current?: string;
}) {
  const [all, categories, stats] = await Promise.all([getDevices(), getCategories(), getAllStats()]);
  const cat = categories.find((c) => c.id === categoryId)!;
  const variantAttrs = cat.attributes.filter((a) => a.scope === "variant" && (a.highlight || a.filterable));
  const list = sortForLanding(devices);
  const st = landingStats(devices);
  const facets = landingFacets(all, categoryId);
  const trail = [{ name: "トップ", href: "/" }, { name: cat.name, href: categoryPath(categoryId) }, ...crumbs];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: i === 0 ? SITE_NAME : t.name, item: SITE_URL + t.href })),
      },
      {
        "@type": "ItemList",
        name: title,
        numberOfItems: list.length,
        itemListElement: list.map((d, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/${d.categoryId}/${d.slug}`, name: `${d.brand} ${d.name}` })),
      },
    ],
  };

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] hover:no-underline transition-colors ${on ? "bg-ink text-white" : "bg-white text-ink border border-line hover:bg-hair"}`;
  const nav: { label: string; items: { key: string; name: string; href: string; count: number }[] }[] = [
    { label: "メーカー", items: facets.brands.map((b) => ({ key: `brand:${b.id}`, name: b.name, href: brandPath(categoryId, b.id), count: b.count })) },
    { label: "月額", items: facets.prices.map((p) => ({ key: `price:${p.band.id}`, name: p.band.label.replace(/^月額/, ""), href: pricePath(categoryId, p.band.id), count: p.count })) },
    { label: "用途", items: facets.uses.map((u) => ({ key: `use:${u.use}`, name: u.label, href: purposePath(categoryId, u.use), count: u.count })) },
  ].filter((g) => g.items.length);

  return (
    <main className="mx-auto max-w-[1240px] px-4 sm:px-6 py-6 flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="パンくず" className="text-xs text-mute flex flex-wrap items-center gap-1">
        {trail.map((t, i) => (
          <span key={t.href} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
            {i < trail.length - 1 ? (
              <Link href={t.href} className="text-mute">
                {t.name}
              </Link>
            ) : (
              <span className="text-sub">{t.name}</span>
            )}
          </span>
        ))}
      </nav>

      <header className="flex flex-col gap-4">
        <h1 className="m-0 text-[30px] sm:text-[40px] font-semibold leading-tight">{title}</h1>
        <p className="m-0 max-w-[860px] text-[15px] sm:text-[17px] text-sub leading-relaxed">{landingLead(subject, st, yen)}</p>
        <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-[860px]">
          {[
            ["機種", `${st.products}`],
            ["レンタル会社", st.companies ? `${st.companies}社` : "—"],
            ["最安の月額", st.minMonthly ? yen(st.minMonthly) : "—"],
            ["月額の中央値", st.medianMonthly ? yen(st.medianMonthly) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[12px] bg-white border border-hair px-4 py-3">
              <dt className="text-xs text-mute">{k}</dt>
              <dd className="m-0 text-[22px] font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {nav.length > 0 && (
        <nav aria-label="絞り込み" className="flex flex-col gap-3">
          {nav.map((g) => (
            <div key={g.label} className="flex items-center gap-3">
              <span className="shrink-0 w-14 text-xs text-mute">{g.label}</span>
              <div className="flex gap-2 overflow-x-auto snap-x-strip -mr-4 pr-4 sm:mr-0 sm:pr-0 sm:flex-wrap">
                {g.items.map((it) => (
                  <Link key={it.key} href={it.href} aria-current={current === it.key ? "page" : undefined} className={chip(current === it.key)}>
                    {it.name}
                    <span className={`ml-1.5 text-[11px] ${current === it.key ? "text-white/70" : "text-faint"}`}>{it.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}

      <section aria-label="機種" className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d, k) => (
          <ProductCard key={d.slug} d={summarize(d, variantAttrs)} stats={stats[d.slug]} index={k} />
        ))}
      </section>
      <p className="m-0 text-[11px] text-faint">
        月額は各レンタル会社の公開ページに掲載されている価格の最安（税抜表示は税込に換算）{st.fetchedAt ? `。${st.fetchedAt.replaceAll("-", "/")} 時点` : ""}。
        並びは掲載している会社の多い順です。
      </p>
    </main>
  );
}
