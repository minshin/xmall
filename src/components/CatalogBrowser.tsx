"use client";

import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { DeviceSummary } from "@/lib/catalog";
import type { DeviceStats } from "@/lib/types";
import { Icon } from "./icons";
import { ProductCard } from "./ProductCard";

type Sort = "price" | "popular";
export interface FacetDef {
  key: string;
  label: string;
}

const NO_STATS: DeviceStats = { likes: 0, reviewCount: 0, rating: null, views: 0 };

type Props = {
  devices: DeviceSummary[];
  stats: Record<string, DeviceStats>;
  facetDefs: FacetDef[];
  categories: { id: string; name: string; icon: string | null }[];
};

/** URL の ?q=（ヘッダーの検索）と ?brand=（メーカーの製品一覧）を初期条件にする。Suspense の中で使う */
export function CatalogBrowserWithParams(props: Props) {
  const sp = useSearchParams();
  const q = sp.get("q")?.trim() ?? "";
  const brand = sp.get("brand") ?? "";
  return <CatalogBrowser key={`${q}|${brand}`} {...props} query={q} initialBrand={brand} />;
}

export function CatalogBrowser({ devices, stats, facetDefs, categories, query = "", initialBrand = "" }: Props & { query?: string; initialBrand?: string }) {
  const st = (slug: string) => stats[slug] ?? NO_STATS;
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [sel, setSel] = useState<Record<string, string[]>>(initialBrand ? { brand: [initialBrand] } : {});
  const [sort, setSort] = useState<Sort>("price");
  const q = query.toLowerCase();

  // 検索語があるときは品目をまたいで探す
  const inCat = useMemo(
    () =>
      devices.filter((d) =>
        q ? `${d.brand} ${d.name} ${d.subtitle} ${d.categoryName}`.toLowerCase().includes(q) : !cat || d.categoryId === cat,
      ),
    [devices, cat, q],
  );

  const options = useMemo(
    () =>
      [{ key: "brand", label: "ブランド" }, ...facetDefs]
        .map((f) => {
          const vals = new Set<string>();
          inCat.forEach((d) => (d.facets[f.key] ?? []).forEach((v) => vals.add(v)));
          return { ...f, opts: [...vals].sort((a, b) => a.localeCompare(b, "ja", { numeric: true })) };
        })
        .filter((f) => f.opts.length > 1),
    [inCat, facetDefs],
  );

  const list = useMemo(() => {
    const hit = inCat.filter((d) => Object.entries(sel).every(([k, vs]) => !vs.length || (d.facets[k] ?? []).some((v) => vs.includes(v))));
    return hit.sort((a, b) =>
      sort === "price"
        ? (a.rentFrom ?? Infinity) - (b.rentFrom ?? Infinity)
        : st(b.slug).likes + st(b.slug).views - (st(a.slug).likes + st(a.slug).views),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCat, sel, sort, stats]);

  const toggle = (k: string, v: string) =>
    setSel((s) => ({ ...s, [k]: (s[k] ?? []).includes(v) ? s[k].filter((x) => x !== v) : [...(s[k] ?? []), v] }));
  const active = Object.values(sel).some((v) => v.length);
  const catName = categories.find((c) => c.id === cat)?.name ?? "製品";

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] cursor-pointer transition-colors ${on ? "bg-ink text-white" : "bg-white text-ink hover:bg-hair"}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[32px] sm:text-[40px] font-semibold leading-tight">
          {q ? (
            <>
              「{query}」の検索結果
              <span className="block text-[17px] sm:text-[21px] font-medium text-mute mt-1">{list.length}件</span>
            </>
          ) : (
            <>
              {catName}
              <span className="text-faint">。</span>
              <span className="block text-[17px] sm:text-[21px] font-medium text-mute mt-1">借りるか、買うか。まとめて比べる。</span>
            </>
          )}
        </h1>
        <div role="tablist" aria-label="並び順" className="flex bg-hair rounded-full p-0.5 text-[13px]">
          {(
            [
              ["price", "安い順"],
              ["popular", "人気順"],
            ] as [Sort, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={sort === k}
              className={`rounded-full px-4 py-1.5 cursor-pointer transition-all ${sort === k ? "bg-white shadow-sm font-medium" : "text-mute"}`}
              onClick={() => setSort(k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 1 && !q && (
        <nav aria-label="品目" className="flex gap-6 overflow-x-auto snap-x-strip -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === cat}
              onClick={() => {
                setCat(c.id);
                setSel({});
              }}
              className={`shrink-0 flex flex-col items-center gap-1.5 text-xs cursor-pointer transition-colors ${c.id === cat ? "text-ink" : "text-faint hover:text-sub"}`}
            >
              <Icon name={c.icon} size={30} strokeWidth={1.3} />
              {c.name}
            </button>
          ))}
        </nav>
      )}

      <div aria-label="絞り込み" className="flex gap-2 overflow-x-auto snap-x-strip -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {options.flatMap((f) =>
          f.opts.map((v) => {
            const on = (sel[f.key] ?? []).includes(v);
            return (
              <button key={`${f.key}:${v}`} type="button" aria-pressed={on} title={f.label} className={chip(on)} onClick={() => toggle(f.key, v)}>
                {v}
              </button>
            );
          }),
        )}
        {active && (
          <button type="button" className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-link cursor-pointer" onClick={() => setSel({})}>
            <X size={14} aria-hidden="true" />
            クリア
          </button>
        )}
      </div>

      {list.length === 0 && <div className="card p-12 text-center text-mute">条件に合う機種がありません</div>}

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d, k) => (
          <ProductCard key={d.slug} d={d} stats={st(d.slug)} index={k} />
        ))}
      </div>
      <p className="m-0 text-[11px] text-faint">月額は各レンタル会社の掲載価格の最安（税抜表示は税込に換算）。</p>
    </div>
  );
}
