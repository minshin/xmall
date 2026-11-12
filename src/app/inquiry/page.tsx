import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InquiryForm } from "@/components/InquiryForm";
import { currentProfile } from "@/lib/auth";
import { getDevice } from "@/lib/catalog-server";
import { yen } from "@/lib/format";
import { cheapestPerCompany, rentalOffers } from "@/lib/pricing";
import { productPath } from "@/lib/urls";
import { consultSchema } from "@/lib/validation";

export const metadata: Metadata = {
  title: "レンタルの相談",
  robots: { index: false, follow: false },
};

export default function InquiryPage({ searchParams }: PageProps<"/inquiry">) {
  return (
    <main className="mx-auto max-w-[920px] px-4 sm:px-6 py-6 flex flex-col gap-5">
      <nav aria-label="パンくず" className="text-xs text-mute">
        <Link href="/">トップ</Link> › レンタルの相談
      </nav>
      <h1 className="m-0 text-[24px] font-semibold">レンタルの相談（無料）</h1>
      <p className="m-0 text-sm text-sub leading-relaxed">
        台数がまとまる・審査が不安・どの会社がよいかわからない、といったご相談を xmall がお受けします。
        内容を確認し、条件に合うレンタル会社の選び方をメールでご案内します。
      </p>
      <Suspense fallback={<div className="card p-6 text-sm text-mute">読み込み中…</div>}>
        <InquiryBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InquiryBody({ searchParams }: { searchParams: PageProps<"/inquiry">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const parsed = consultSchema.safeParse({ deviceSlug: one("device"), configId: one("config"), months: one("term"), quantity: one("qty") ?? "1" });
  const device = parsed.success ? await getDevice(parsed.data.deviceSlug) : undefined;
  if (!parsed.success || !device) return <Invalid />;
  const q = parsed.data;
  const cfg = q.configId ? device.configs.find((c) => c.id === q.configId) : undefined;
  const me = await currentProfile();
  const prefill: Record<string, string> = me
    ? Object.fromEntries(
        Object.entries({ company: me.companyName, contactName: me.fullName, email: me.email, phone: me.phone }).filter((e): e is [string, string] => !!e[1]),
      )
    : {};
  const offers = cheapestPerCompany(rentalOffers(device, cfg?.id));

  return (
    <div className="flex flex-wrap gap-6 items-start">
      <section aria-labelledby="form-h" className="card p-6 flex-[999_1_480px] min-w-0">
        <h2 id="form-h" className="m-0 mb-4 text-[18px] font-semibold">
          ご相談内容と連絡先
        </h2>
        <InquiryForm consult={{ deviceSlug: device.slug, configId: cfg?.id ?? "", months: q.months ? String(q.months) : "", quantity: String(q.quantity) }} prefill={prefill} />
      </section>

      <aside aria-label="対象の機種" className="card p-6 flex-[1_1_280px] flex flex-col gap-3 text-sm">
        <p className="m-0 text-[13px] text-mute">対象の機種</p>
        <p className="m-0 font-semibold text-base">
          <Link href={productPath(device)}>
            {device.brand} {device.name}
          </Link>
        </p>
        <p className="m-0 text-sub">{cfg ? cfg.label : device.configs.length > 1 ? "構成：指定なし" : device.configs[0].label}</p>
        {offers.length > 0 && (
          <>
            <p className="m-0 mt-2 text-[13px] text-mute">掲載中のレンタル会社（最安の月額）</p>
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {offers.slice(0, 5).map((o) => (
                <li key={o.key} className="flex justify-between gap-3">
                  <span className="truncate">{o.companyName}</span>
                  <span className="tabular-nums">{yen(o.monthly)}〜</span>
                </li>
              ))}
            </ul>
            <p className="m-0 text-[11px] text-mute">各社の公開ページの掲載価格です。正式な金額は各社の見積でご確認ください。</p>
          </>
        )}
      </aside>
    </div>
  );
}

function Invalid() {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <p className="m-0">相談する機種が見つかりませんでした。機種ページの「まとめて相談する」からお進みください。</p>
      <Link href="/" className="self-start btn btn-primary">
        機種の一覧へ
      </Link>
    </div>
  );
}
