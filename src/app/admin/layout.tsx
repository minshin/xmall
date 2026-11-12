import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "管理画面",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-[1240px] px-6 py-5 flex flex-col gap-5">
      <nav aria-label="管理メニュー" className="flex flex-wrap gap-2 text-sm">
        <b className="mr-2">管理画面</b>
        <Link href="/admin">概要</Link>
        <Link href="/admin/reviews">口コミの審査</Link>
        <Link href="/admin/inquiries">問い合わせ</Link>
      </nav>
      {children}
    </div>
  );
}
