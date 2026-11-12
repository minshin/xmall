import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDevices } from "@/lib/catalog-server";
import { getSql } from "@/lib/db";
import { USE_LABEL } from "@/lib/labels";
import * as repo from "@/lib/repo";
import type { ReviewStatus } from "@/lib/types";
import { moderateReviewAction } from "../actions";
import { NoDb } from "../NoDb";

const TABS: [ReviewStatus, string][] = [
  ["pending", "審査待ち"],
  ["approved", "掲載中"],
  ["rejected", "非掲載"],
];

export default function AdminReviews({ searchParams }: PageProps<"/admin/reviews">) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="m-0 text-[22px] font-bold">口コミの審査</h1>
      <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
        <List searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/reviews">["searchParams"] }) {
  await connection();
  const raw = (await searchParams).status;
  const status: ReviewStatus = raw === "approved" || raw === "rejected" ? raw : "pending";
  const sql = getSql();
  if (!sql) return <NoDb />;
  const reviews = await repo.reviewsByStatus(sql, status);
  const names = Object.fromEntries((await getDevices()).map((d) => [d.slug, d.name]));

  return (
    <>
      <nav className="flex gap-1.5 text-sm">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/reviews?status=${k}`}
            className={`rounded-full px-3 py-1.5 no-underline ${k === status ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!reviews.length && <p className="m-0 text-sm text-sub">該当する口コミはありません。</p>}
      {reviews.map((r) => (
        <article key={r.id} className="card p-5 flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2 text-xs text-mute">
            <Link href={`/pc/${r.deviceSlug}#reviews`} className="font-bold">
              {names[r.deviceSlug] ?? r.deviceSlug}
            </Link>
            <span>{"★".repeat(r.rating)}</span>
            <span>{r.author}</span>
            <span>・{USE_LABEL[r.use]}</span>
            <span>・{r.acquisition === "rent" ? "レンタル" : "購入"}</span>
            {r.via && <span>・{r.via}</span>}
            <span>・{new Date(r.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
            {r.sample && <span>・サンプル</span>}
          </div>
          <p className="m-0 text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
          <form action={moderateReviewAction} className="flex flex-wrap gap-2 items-center">
            <input type="hidden" name="id" value={r.id} />
            <input name="note" placeholder="非掲載の理由（任意・内部メモ）" className="flex-1 min-w-[200px] border border-[#D6D6D0] rounded-lg px-3 py-2 text-sm" />
            {r.status !== "approved" && (
              <button name="decision" value="approved" className="min-h-9 px-4 rounded-lg text-sm cursor-pointer bg-ok text-white">
                掲載する
              </button>
            )}
            {r.status !== "rejected" && (
              <button name="decision" value="rejected" className="min-h-9 px-4 rounded-lg text-sm cursor-pointer border border-[#B42318] text-[#B42318] bg-white">
                非掲載にする
              </button>
            )}
          </form>
        </article>
      ))}
    </>
  );
}
