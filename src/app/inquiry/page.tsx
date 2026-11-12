import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InquiryForm } from "@/components/InquiryForm";
import { GRADES, SUPPLIERS, TEMPLATES } from "@/data/master";
import { getDevice } from "@/lib/catalog";
import { yen } from "@/lib/format";
import { findConfig, quote } from "@/lib/pricing";
import type { GradeCode, TemplateCode, Term } from "@/lib/types";
import { quoteSchema } from "@/lib/validation";

export const metadata: Metadata = {
  title: "レンタルの問い合わせ",
  robots: { index: false, follow: false },
};

export default function InquiryPage({ searchParams }: PageProps<"/inquiry">) {
  return (
    <main className="mx-auto max-w-[920px] px-6 py-6 flex flex-col gap-5">
      <nav aria-label="パンくず" className="text-xs text-mute">
        <Link href="/">トップ</Link> › レンタルの問い合わせ
      </nav>
      <h1 className="m-0 text-[24px] font-bold">レンタルの問い合わせ</h1>
      <ol className="m-0 p-0 list-none flex flex-wrap gap-2 text-xs">
        {["条件の確認", "連絡先の入力", "レンタル会社から連絡"].map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1.5 ${i < 2 ? "bg-brand-soft text-[#1F3F9C] font-bold" : "bg-white border border-line text-mute"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <Suspense fallback={<div className="card p-6 text-sm text-mute">見積を計算しています…</div>}>
        <InquiryBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InquiryBody({ searchParams }: { searchParams: PageProps<"/inquiry">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const parsed = quoteSchema.safeParse({
    deviceSlug: one("device"),
    configId: one("config"),
    grade: one("grade") ?? "A",
    term: one("term") ?? "24",
    template: one("template") ?? "OFFICE",
    quantity: one("qty") ?? "1",
    supplierId: one("supplier"),
  });

  if (!parsed.success) return <Invalid />;
  const q = parsed.data;
  const device = getDevice(q.deviceSlug)!;
  const priced = quote(device, {
    configId: q.configId,
    grade: q.grade as GradeCode,
    term: q.term as Term,
    template: q.template as TemplateCode,
    quantity: q.quantity,
    supplierId: q.supplierId,
  });
  if (!priced) return <Invalid />;
  const supplier = SUPPLIERS.find((s) => s.id === priced.supplierId)!;
  const cfg = findConfig(device, q.configId);

  return (
    <div className="flex flex-wrap gap-6 items-start">
      <section aria-labelledby="form-h" className="card p-6 flex-[999_1_480px] min-w-0">
        <h2 id="form-h" className="m-0 mb-4 text-[18px] font-bold">
          連絡先
        </h2>
        <InquiryForm quote={{ ...q, term: q.term as Term }} />
      </section>

      <aside aria-label="見積内容" className="card p-6 flex-[1_1_280px] flex flex-col gap-3 text-sm">
        <p className="m-0 text-[13px] text-mute">見積内容</p>
        <p className="m-0 font-bold text-base">
          <Link href={`/pc/${device.slug}`}>{device.name}</Link>
        </p>
        <dl className="m-0 flex flex-col gap-1.5">
          <Row k="構成" v={cfg.label} />
          <Row k="品質グレード" v={`${q.grade}（${GRADES[q.grade as GradeCode].label}）`} />
          <Row k="設定テンプレート" v={TEMPLATES[q.template as TemplateCode].label} />
          <Row k="契約期間" v={`${q.term}か月`} />
          <Row k="台数" v={`${q.quantity}台`} />
          <Row k="レンタル会社" v={supplier.name} />
          <Row k="納期の目安" v={`${supplier.leadDays}営業日`} />
        </dl>
        <dl className="m-0 border-t border-[#EEEEEA] pt-3 flex flex-col gap-1.5">
          <Row k="月額/台" v={yen(priced.monthlyPerUnit)} />
          <div className="flex justify-between text-lg">
            <dt>月額合計</dt>
            <dd className="m-0 font-bold">{yen(priced.monthlyTotal)}</dd>
          </div>
          <Row k="初期費用" v={priced.setupFeeTotal ? yen(priced.setupFeeTotal) : "無料"} />
          <Row k="契約期間の総額" v={yen(priced.contractTotal)} />
        </dl>
        <p className="m-0 text-[11px] text-mute">
          税込の目安です。正式な金額は審査のうえレンタル会社が提示します。{supplier.sample ? "※ レンタル会社名・金額はサンプルです。" : ""}
        </p>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-sub">{k}</dt>
      <dd className="m-0 font-bold text-right">{v}</dd>
    </div>
  );
}

function Invalid() {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <p className="m-0">見積条件が見つかりませんでした。機種ページで条件を選んでから「この内容で問い合わせる」を押してください。</p>
      <Link href="/" className="self-start bg-brand text-white no-underline px-4 py-2.5 rounded-lg text-sm font-bold">
        ノートPCの一覧へ
      </Link>
    </div>
  );
}
