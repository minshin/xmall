import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ご相談を受け付けました",
  robots: { index: false, follow: false },
};

export default function ThanksPage() {
  return (
    <main className="mx-auto max-w-[720px] px-4 sm:px-6 py-10 flex flex-col gap-5">
      <div className="card p-8 flex flex-col gap-4">
        <h1 className="m-0 text-[24px] font-semibold">ご相談を受け付けました</h1>
        <p className="m-0">ありがとうございました。</p>
        <ol className="m-0 pl-5 text-sm leading-loose">
          <li>xmall が内容を確認し、メールでご連絡します（通常1〜2営業日）。</li>
          <li>条件に合うレンタル会社と、見積・審査の進め方をご案内します。</li>
          <li>レンタル会社へ情報をお渡しする場合は、事前にご確認します。</li>
        </ol>
        <p className="m-0 text-xs text-mute">3営業日たっても連絡がない場合は、お手数ですが xmall までお知らせください。</p>
        <Link href="/" className="self-start btn btn-primary">
          ほかの機種も見る
        </Link>
      </div>
    </main>
  );
}
