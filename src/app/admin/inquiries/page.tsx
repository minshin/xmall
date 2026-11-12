import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDevices } from "@/lib/catalog-server";
import { getSql } from "@/lib/db";
import { findConfig } from "@/lib/pricing";
import * as repo from "@/lib/repo";
import { updateInquiryAction } from "../actions";
import { NoDb } from "../NoDb";

const STATUS: Record<repo.InquiryStatus, string> = { new: "未対応", forwarded: "案内済み", closed: "完了" };

export default function AdminInquiries({ searchParams }: PageProps<"/admin/inquiries">) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="m-0 text-[22px] font-bold">問い合わせ</h1>
      <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
        <List searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/inquiries">["searchParams"] }) {
  await connection();
  const raw = (await searchParams).status;
  const status = typeof raw === "string" && raw in STATUS ? (raw as repo.InquiryStatus) : undefined;
  const sql = getSql();
  if (!sql) return <NoDb />;
  const rows = await repo.listInquiries(sql, status);
  const devices = await getDevices();

  return (
    <>
      <nav className="flex flex-wrap gap-1.5 text-sm">
        {([[undefined, "すべて"], ...Object.entries(STATUS)] as [string | undefined, string][]).map(([k, label]) => (
          <Link
            key={label}
            href={k ? `/admin/inquiries?status=${k}` : "/admin/inquiries"}
            className={`rounded-full px-3 py-1.5 no-underline ${k === status ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!rows.length && <p className="m-0 text-sm text-sub">該当する問い合わせはありません。</p>}
      {rows.map((q) => {
        const device = devices.find((d) => d.slug === q.deviceSlug);
        return (
          <details key={q.id} className="card p-5" open={q.status === "new"}>
            <summary className="flex flex-wrap gap-3 items-baseline">
              <span className={`text-xs rounded-full px-2 py-0.5 ${q.status === "new" ? "bg-[#FFF1DD] text-[#8A4B00]" : "bg-[#F0F0EC] text-sub"}`}>
                {STATUS[q.status]}
              </span>
              <b>{q.company}</b>
              <span className="text-sm">
                {device?.name ?? q.deviceSlug} × {q.quantity}台{q.months ? ` ／ ${q.months}か月` : ""}
              </span>
              <span className="text-xs text-mute ml-auto">{new Date(q.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
            </summary>
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 text-sm">
              <dl className="m-0 flex flex-col gap-1">
                <Row k="担当者" v={q.contactName} />
                <Row k="メール" v={<a href={`mailto:${q.email}`}>{q.email}</a>} />
                <Row k="電話" v={q.phone ?? "—"} />
                <Row k="都道府県" v={q.prefecture ?? "—"} />
                <Row k="利用開始" v={q.startMonth ?? "未定"} />
              </dl>
              <dl className="m-0 flex flex-col gap-1">
                <Row k="構成" v={q.configId ? (device ? findConfig(device, q.configId).label : q.configId) : "指定なし"} />
                <Row k="台数" v={`${q.quantity}台`} />
                <Row k="利用期間" v={q.months ? `${q.months}か月` : "未定"} />
              </dl>
            </div>
            {q.message && <p className="mt-3 mb-0 text-sm whitespace-pre-line bg-ground rounded-lg p-3">{q.message}</p>}
            <form action={updateInquiryAction} className="mt-3 flex flex-wrap gap-2 items-center">
              <input type="hidden" name="id" value={q.id} />
              <select name="status" defaultValue={q.status} className="border border-[#D6D6D0] rounded-lg px-3 py-2 text-sm bg-white">
                {Object.entries(STATUS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="note"
                defaultValue={q.adminNote ?? ""}
                placeholder="内部メモ"
                className="flex-1 min-w-[200px] border border-[#D6D6D0] rounded-lg px-3 py-2 text-sm"
              />
              <button className="min-h-9 px-4 rounded-lg text-sm cursor-pointer bg-brand text-white">保存</button>
            </form>
          </details>
        );
      })}
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="text-mute w-24 shrink-0">{k}</dt>
      <dd className="m-0">{v}</dd>
    </div>
  );
}
