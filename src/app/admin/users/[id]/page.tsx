import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Eye, Heart, Inbox, MessageSquareText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import * as accounts from "@/lib/repo-accounts";
import * as admin from "@/lib/repo-admin";
import { UUID } from "@/lib/validation-admin";
import { setRoleAction } from "../../catalog-actions";
import { ROLE_LABEL } from "../../labels";
import { NoDb } from "../../NoDb";

export const metadata: Metadata = { title: "会員の詳細" };

const dt = (d: Date | null) => (d ? new Date(d).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body params={params} />
    </Suspense>
  );
}

function Panel({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <section className="card p-5 flex flex-col gap-3">
      <h2 className="m-0 text-[17px] font-semibold inline-flex items-center gap-2">
        {icon}
        {title}
        <span className="text-sm font-normal text-faint">{count}</span>
      </h2>
      {count ? children : <p className="m-0 text-sm text-faint">なし</p>}
    </section>
  );
}

async function Body({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireRole("editor", `/admin/users/${id}`);
  if (!UUID.test(id)) notFound();
  const sql = getSql();
  if (!sql) return <NoDb />;
  const [u, act, products] = await Promise.all([accounts.getProfile(sql, id), accounts.userActivity(sql, id), admin.listProducts(sql)]);
  if (!u) notFound();
  const name = Object.fromEntries(products.map((p) => [p.slug, p.name]));
  const rows: [string, string | null][] = [
    ["会社名", u.companyName],
    ["部署", u.department],
    ["お名前", u.fullName],
    ["電話", u.phone],
    ["従業員数", u.companySize],
    ["登録", dt(u.createdAt)],
    ["最終利用", dt(u.lastSeenAt)],
  ];

  return (
    <>
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-mute">
        <ArrowLeft size={15} aria-hidden="true" /> 会員
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-[28px] font-semibold">{u.email}</h1>
        <span className={`text-xs rounded-full px-2.5 py-0.5 ${u.role === "user" ? "bg-ground text-mute" : "bg-brand-soft text-brand"}`}>{ROLE_LABEL[u.role]}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
        <section className="card p-5">
          <dl className="m-0 grid grid-cols-[100px_1fr] gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-mute">{k}</dt>
                <dd className="m-0">{v ?? <span className="text-faint">—</span>}</dd>
              </div>
            ))}
          </dl>
        </section>
        {me.role === "admin" && me.id !== u.id && (
          <section className="card p-5 flex flex-col gap-3">
            <h2 className="m-0 text-[15px] font-semibold">権限</h2>
            <form action={setRoleAction} className="flex gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <select name="role" defaultValue={u.role} className="flex-1 border border-line rounded-[10px] px-3 py-2 text-sm bg-white">
                {Object.entries(ROLE_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary !py-2 !text-sm">変更</button>
            </form>
            <p className="m-0 text-xs text-faint">編集者：製品・口コミ・問い合わせ。管理者：さらに会員の権限と削除。</p>
          </section>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="閲覧した製品" icon={<Eye size={17} className="text-faint" />} count={act.views.length}>
          <ul className="m-0 p-0 list-none divide-y divide-hair text-sm">
            {act.views.map((v) => (
              <li key={v.deviceSlug} className="flex justify-between gap-3 py-2">
                <Link href={`/pc/${v.deviceSlug}`} className="truncate">
                  {name[v.deviceSlug] ?? v.deviceSlug}
                </Link>
                <span className="text-xs text-faint tabular-nums whitespace-nowrap">
                  {v.viewCount}回・{dt(v.lastViewedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="お気に入り" icon={<Heart size={17} className="text-faint" />} count={act.likes.length}>
          <ul className="m-0 p-0 list-none divide-y divide-hair text-sm">
            {act.likes.map((l) => (
              <li key={l.deviceSlug} className="flex justify-between gap-3 py-2">
                <Link href={`/pc/${l.deviceSlug}`}>{name[l.deviceSlug] ?? l.deviceSlug}</Link>
                <span className="text-xs text-faint">{dt(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="口コミ" icon={<MessageSquareText size={17} className="text-faint" />} count={act.reviews.length}>
          <ul className="m-0 p-0 list-none divide-y divide-hair text-sm">
            {act.reviews.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 py-2">
                <span>
                  {name[r.deviceSlug] ?? r.deviceSlug} <span className="text-[#ff9f0a]">{"★".repeat(r.rating)}</span>
                </span>
                <span className="text-xs text-faint">
                  {r.status}・{dt(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="問い合わせ" icon={<Inbox size={17} className="text-faint" />} count={act.inquiries.length}>
          <ul className="m-0 p-0 list-none divide-y divide-hair text-sm">
            {act.inquiries.map((q) => (
              <li key={q.id} className="flex justify-between gap-3 py-2">
                <Link href="/admin/inquiries">
                  {name[q.deviceSlug] ?? q.deviceSlug} × {q.quantity}台
                </Link>
                <span className="text-xs text-faint">
                  {q.status}・{dt(q.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
