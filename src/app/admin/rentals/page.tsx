import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { yen } from "@/lib/format";
import * as cat from "@/lib/repo-catalog";
import * as admin from "@/lib/repo-admin";
import { NoDb } from "../NoDb";
import { rematchListingsAction, setListingMatchAction } from "../catalog-actions";
import { ActionForm, input } from "../ui";

export const metadata: Metadata = { title: "レンタル掲載" };

const FILTERS: [admin.ListingFilter, string][] = [
  ["unmatched", "未対応"],
  ["matched", "対応済み"],
  ["manual", "手で設定"],
  ["all", "すべて"],
];

export default function RentalsPage({ searchParams }: PageProps<"/admin/rentals">) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/rentals">["searchParams"] }) {
  await requireRole("editor", "/admin/rentals");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const filter = FILTERS.find(([k]) => k === one("f"))?.[0] ?? "unmatched";
  const q = one("q").trim().slice(0, 60);
  const [rows, counts, products] = await Promise.all([
    admin.listRentalListings(sql, filter, q),
    admin.listingCounts(sql),
    cat.loadProducts(sql, { statuses: ["draft", "published"] }),
  ]);
  const options = products.flatMap((p) => [
    { value: `${p.slug}|`, label: `${p.brand} ${p.name}（構成なし）` },
    ...p.configs.map((c) => ({ value: `${p.slug}|${c.id}`, label: `${p.brand} ${p.name} ／ ${c.label}` })),
  ]);
  const nameOf = new Map(products.map((p) => [p.slug, `${p.brand} ${p.name}`]));
  const countOf: Record<admin.ListingFilter, number> = { unmatched: counts.unmatched, matched: counts.matched, manual: counts.manual, all: counts.all };

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[32px] font-semibold">レンタル掲載</h1>
        <p className="m-0 text-sm text-sub">
          各社の公開ページから取得した商品（npm run rentals:scrape → rentals:import）。機種との対応は、機種の「対応づけの正規表現」で自動で決まります。
          うまく当たらないものだけ、ここで手で設定してください（手で設定したものは自動では変わりません）。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-1.5 text-sm">
          {FILTERS.map(([k, label]) => (
            <Link
              key={k}
              href={`/admin/rentals?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-3 py-1.5 hover:no-underline ${k === filter ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}
            >
              {label} <span className="opacity-60 tabular-nums">{countOf[k]}</span>
            </Link>
          ))}
        </nav>
        <form className="relative flex-1 min-w-[200px] max-w-[320px]">
          <input type="hidden" name="f" value={filter} />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="商品名・機種で絞り込み" className={`${input} pl-9`} />
        </form>
        <ActionForm action={rematchListingsAction} submit="自動の対応づけをやり直す" className="ml-auto flex items-center gap-3">
          {null}
        </ActionForm>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {rows.map((l) => (
          <li key={l.id} className="card p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs text-mute">{l.companyName}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ink inline-flex items-center gap-1">
                {l.title}
                <ExternalLink size={12} className="text-faint" aria-hidden="true" />
              </a>
              <span className="text-xs text-mute tabular-nums ml-auto">
                {[l.memoryGb && `${l.memoryGb}GB`, l.storageGb && `${l.storageGb}GB`].filter(Boolean).join(" / ")}
                {l.minMonthly ? `・${yen(l.minMonthly)}/月〜` : ""}・{l.fetchedAt}
              </span>
            </div>
            <ActionForm action={setListingMatchAction} className="flex flex-wrap items-center gap-2" submit="設定">
              <input type="hidden" name="id" value={l.id} />
              <select name="target" defaultValue={l.deviceSlug ? `${l.deviceSlug}|${l.configId ?? ""}` : ""} className={`${input} !w-auto max-w-full flex-1`}>
                <option value="">対応なし</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className={`text-xs ${l.matchManual ? "text-warn" : "text-mute"}`}>
                {l.matchManual ? "手で設定" : l.deviceSlug ? `自動：${nameOf.get(l.deviceSlug) ?? l.deviceSlug}` : "自動：なし"}
              </span>
              {l.matchManual && (
                <button type="submit" name="op" value="auto" className="text-xs text-link cursor-pointer">
                  自動に戻す
                </button>
              )}
            </ActionForm>
          </li>
        ))}
        {!rows.length && <li className="text-sm text-mute">該当する掲載はありません。</li>}
      </ul>
    </>
  );
}
