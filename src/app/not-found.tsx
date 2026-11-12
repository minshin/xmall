import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-16 text-center flex flex-col gap-3">
      <h1 className="m-0 text-2xl font-bold">ページが見つかりません</h1>
      <p className="m-0 text-sub">お探しの機種は掲載されていないか、URLが変わった可能性があります。</p>
      <Link href="/">ノートPCの一覧へ</Link>
    </main>
  );
}
