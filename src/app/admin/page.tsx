import Link from "next/link";
import { Suspense } from "react";
import { Boxes, Eye, Heart, Inbox, MessageSquareText, UserPlus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import * as repo from "@/lib/repo";
import * as accounts from "@/lib/repo-accounts";
import * as admin from "@/lib/repo-admin";
import { NoDb } from "./NoDb";

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const me = await requireRole("editor", "/admin");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const [c, a, k, top] = await Promise.all([repo.adminCounts(sql), accounts.accountCounts(sql), admin.catalogCounts(sql), accounts.deviceEngagement(sql, 10)]);
  const names = Object.fromEntries((await admin.listProducts(sql)).map((p) => [p.slug, p.name]));
  const cards: { label: string; n: number; sub?: string; href?: string; icon: typeof Users; tone?: string }[] = [
    { label: "会員", n: a.users, sub: `7日で +${a.users_7d}`, href: "/admin/users", icon: Users },
    { label: "閲覧（7日）", n: a.views_7d, sub: `${a.viewers_7d} 人`, icon: Eye },
    { label: "お気に入り", n: a.likes, icon: Heart },
    { label: "公開中の製品", n: k.published, sub: k.drafts ? `下書き ${k.drafts}` : undefined, href: "/admin/products", icon: Boxes },
    { label: "審査待ちの口コミ", n: c.pending_reviews, href: "/admin/reviews", icon: MessageSquareText, tone: c.pending_reviews ? "text-warn" : undefined },
    { label: "未対応の問い合わせ", n: c.new_inquiries, sub: `30日で ${c.inquiries_30d} 件`, href: "/admin/inquiries", icon: Inbox, tone: c.new_inquiries ? "text-warn" : undefined },
  ];
  const max = Math.max(1, ...top.map((t) => t.viewers));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="m-0 text-[32px] font-semibold">概要</h1>
        <p className="m-0 text-sm text-mute">
          {me.email}・{me.role}
        </p>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, n, sub, href, icon: Icon, tone }) => {
          const body = (
            <>
              <Icon size={20} strokeWidth={1.6} className="text-faint" aria-hidden="true" />
              <p className="m-0 mt-2 text-xs text-mute">{label}</p>
              <p className={`m-0 text-[32px] font-semibold tabular-nums leading-tight ${tone ?? ""}`}>{n.toLocaleString("ja-JP")}</p>
              {sub && <p className="m-0 text-xs text-faint">{sub}</p>}
            </>
          );
          return href ? (
            <Link key={label} href={href} className="card lift p-5 text-ink hover:no-underline">
              {body}
            </Link>
          ) : (
            <div key={label} className="card p-5">
              {body}
            </div>
          );
        })}
      </div>

      <section className="card p-6 flex flex-col gap-3">
        <h2 className="m-0 text-[19px] font-semibold inline-flex items-center gap-2">
          <UserPlus size={18} className="text-faint" aria-hidden="true" />
          よく見られている製品
        </h2>
        {top.length ? (
          <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
            {top.map((t) => (
              <li key={t.device_slug} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 text-sm">
                <Link href={`/pc/${t.device_slug}`} className="truncate text-ink">
                  {names[t.device_slug] ?? t.device_slug}
                </Link>
                <span className="h-2 bg-ground rounded-full overflow-hidden">
                  <span className="block h-full bg-brand rounded-full" style={{ width: `${(t.viewers / max) * 100}%` }} />
                </span>
                <span className="tabular-nums text-mute text-xs whitespace-nowrap">
                  <Eye size={12} className="inline -mt-0.5" aria-hidden="true" /> {t.viewers}（会員 {t.members}）・<Heart size={12} className="inline -mt-0.5" aria-hidden="true" /> {t.likes}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-mute">まだ閲覧データがありません</p>
        )}
      </section>
    </>
  );
}
