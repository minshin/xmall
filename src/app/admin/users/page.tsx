import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Eye, Heart, Inbox, MessageSquareText, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import * as accounts from "@/lib/repo-accounts";
import { ROLE_LABEL } from "../labels";
import { NoDb } from "../NoDb";

export const metadata: Metadata = { title: "会員" };

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  await requireRole("editor", "/admin/users");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const { users, total } = await accounts.listUsers(sql, { q, limit: 50, offset: (page - 1) * 50 });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[32px] font-semibold">
          会員 <span className="text-[19px] font-normal text-faint">{total}</span>
        </h1>
        <form className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="メール・会社名・名前" className="pl-9 pr-3 py-2 rounded-full bg-white border border-line text-sm w-64" />
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-mute">
              {["会員", "会社", "権限", "登録", "最終利用", ""].map((h) => (
                <th key={h} className="font-normal px-4 py-3 border-b border-hair">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-ground transition-colors">
                <td className="px-4 py-3 border-b border-hair">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-ink">
                    {u.email}
                  </Link>
                  <span className="block text-xs text-faint">
                    {u.provider === "google" ? "Google" : "メール"}
                    {!u.confirmed && " ・未確認"}
                    {u.fullName ? ` ・${u.fullName}` : ""}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-hair">
                  {u.companyName ?? <span className="text-faint">—</span>}
                  {u.companySize && <span className="block text-xs text-faint">{u.companySize}名</span>}
                </td>
                <td className="px-4 py-3 border-b border-hair">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${u.role === "user" ? "bg-ground text-mute" : "bg-brand-soft text-brand"}`}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td className="px-4 py-3 border-b border-hair tabular-nums text-mute">{fmt(u.createdAt)}</td>
                <td className="px-4 py-3 border-b border-hair tabular-nums text-mute">{fmt(u.lastSeenAt)}</td>
                <td className="px-4 py-3 border-b border-hair">
                  <span className="flex gap-3 text-xs text-mute tabular-nums">
                    <span title="閲覧した製品" className="inline-flex items-center gap-1">
                      <Eye size={13} aria-hidden="true" />
                      {u.views}
                    </span>
                    <span title="お気に入り" className="inline-flex items-center gap-1">
                      <Heart size={13} aria-hidden="true" />
                      {u.likes}
                    </span>
                    <span title="口コミ" className="inline-flex items-center gap-1">
                      <MessageSquareText size={13} aria-hidden="true" />
                      {u.reviews}
                    </span>
                    <span title="問い合わせ" className="inline-flex items-center gap-1">
                      <Inbox size={13} aria-hidden="true" />
                      {u.inquiries}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="m-0 p-6 text-sm text-mute">該当する会員はいません</p>}
      </div>
      {total > 50 && (
        <nav className="flex gap-3 text-sm">
          {page > 1 && <Link href={`/admin/users?q=${encodeURIComponent(q)}&page=${page - 1}`}>← 前へ</Link>}
          {page * 50 < total && <Link href={`/admin/users?q=${encodeURIComponent(q)}&page=${page + 1}`}>次へ →</Link>}
        </nav>
      )}
    </>
  );
}
