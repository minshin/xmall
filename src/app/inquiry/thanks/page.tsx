import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SUPPLIERS } from "@/data/master";

export const metadata: Metadata = {
  title: "問い合わせを受け付けました",
  robots: { index: false, follow: false },
};

export default function ThanksPage({ searchParams }: PageProps<"/inquiry/thanks">) {
  return (
    <main className="mx-auto max-w-[720px] px-6 py-10 flex flex-col gap-5">
      <div className="card p-8 flex flex-col gap-4">
        <h1 className="m-0 text-[24px] font-bold">問い合わせを受け付けました</h1>
        <Suspense fallback={<p className="m-0">ありがとうございました。</p>}>
          <SupplierLine searchParams={searchParams} />
        </Suspense>
        <ol className="m-0 pl-5 text-sm leading-loose">
          <li>レンタル会社が内容を確認し、メールまたはお電話で連絡します（通常1〜2営業日）。</li>
          <li>正式な見積と審査に必要な書類の案内があります。</li>
          <li>審査が通ったら契約・お届けです。設定テンプレートを選んだ場合は設定済みで届きます。</li>
        </ol>
        <p className="m-0 text-xs text-mute">3営業日たっても連絡がない場合は、お手数ですがxmallまでお知らせください。</p>
        <Link href="/" className="self-start bg-brand text-white no-underline px-4 py-2.5 rounded-lg text-sm font-bold">
          ほかの機種も見る
        </Link>
      </div>
    </main>
  );
}

async function SupplierLine({ searchParams }: { searchParams: PageProps<"/inquiry/thanks">["searchParams"] }) {
  const id = (await searchParams).supplier;
  const s = SUPPLIERS.find((x) => x.id === id);
  return <p className="m-0">{s ? `${s.name}に内容をお送りしました。` : "ありがとうございました。"}</p>;
}
