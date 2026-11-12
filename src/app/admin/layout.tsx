import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Globe, Images, Inbox, LayoutDashboard, Link2, ListTree, MessageSquareText, Users } from "lucide-react";

export const metadata: Metadata = {
  title: { default: "管理画面", template: "%s｜管理画面" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "概要", icon: LayoutDashboard },
  { href: "/admin/products", label: "製品", icon: Boxes },
  { href: "/admin/rentals", label: "レンタル掲載", icon: Link2 },
  { href: "/admin/categories", label: "品目・スペック", icon: ListTree },
  { href: "/admin/sites", label: "サイト・favicon", icon: Globe },
  { href: "/admin/media", label: "画像", icon: Images },
  { href: "/admin/users", label: "会員", icon: Users },
  { href: "/admin/reviews", label: "口コミ", icon: MessageSquareText },
  { href: "/admin/inquiries", label: "相談", icon: Inbox },
];

/** 権限の確認は各ページ（requireRole）と各 Server Action で行う。ここは枠だけ */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
      <nav aria-label="管理メニュー" className="flex lg:flex-col gap-1 overflow-x-auto snap-x-strip lg:sticky lg:top-20 lg:self-start -mx-4 px-4 lg:mx-0 lg:px-0">
        <p className="hidden lg:block m-0 mb-2 px-3 text-xs font-semibold text-faint uppercase tracking-wider">管理画面</p>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="shrink-0 inline-flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm text-sub hover:bg-white hover:text-ink hover:no-underline transition-colors"
          >
            <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex flex-col gap-5">{children}</div>
    </div>
  );
}
