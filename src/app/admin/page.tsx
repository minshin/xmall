import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSql } from "@/lib/db";
import * as repo from "@/lib/repo";
import { NoDb } from "./NoDb";

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Counts />
    </Suspense>
  );
}

async function Counts() {
  await connection();
  const sql = getSql();
  if (!sql) return <NoDb />;
  const c = await repo.adminCounts(sql);
  const items: [string, number, string?][] = [
    ["審査待ちの口コミ", c.pending_reviews, "/admin/reviews"],
    ["未対応の問い合わせ", c.new_inquiries, "/admin/inquiries"],
    ["問い合わせ（30日）", c.inquiries_30d],
    ["いいね（累計）", c.likes_total],
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
      {items.map(([label, n, href]) => (
        <div key={label} className="card p-5">
          <p className="m-0 text-xs text-mute">{label}</p>
          <p className="m-0 mt-1 text-[28px] font-bold">{n.toLocaleString("ja-JP")}</p>
          {href && n > 0 && <Link href={href} className="text-sm">確認する →</Link>}
        </div>
      ))}
    </div>
  );
}
