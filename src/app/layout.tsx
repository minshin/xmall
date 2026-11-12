import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Heart, History, Search } from "lucide-react";
import { UserMenu, UserMenuPlaceholder } from "@/components/UserMenu";
import { SITE_NAME, SITE_URL } from "@/lib/format";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "xmall｜法人向けPC・IT機器のレンタル・購入比較",
    template: "%s｜xmall",
  },
  description:
    "法人向けのノートPC・モニター・タブレットなどIT機器を、複数のレンタル会社と主要ショップで比較。品質グレードと設定テンプレートを標準化し、はじめての方にもわかる詳しい解説付き。",
  openGraph: { siteName: SITE_NAME, locale: "ja_JP", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 bg-[rgb(255_255_255/0.88)] backdrop-blur-xl backdrop-saturate-150 border-b border-black/5">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 h-12 flex items-center gap-4 sm:gap-6">
            <Link href="/" className="font-semibold text-[19px] text-ink tracking-tight hover:no-underline shrink-0">
              xmall
            </Link>
            <form action="/" role="search" className="flex-1 max-w-[420px] relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" aria-hidden="true" />
              <input
                name="q"
                type="search"
                placeholder="機種名・メーカーで探す"
                aria-label="製品を検索"
                className="w-full h-8 pl-9 pr-3 rounded-full bg-ground border border-transparent text-[13px] focus:outline-none focus:bg-white focus:border-brand transition-colors"
              />
            </form>
            <nav aria-label="メイン" className="hidden md:flex gap-5 text-[12px]">
              <Link href="/guide/grades" className="text-sub hover:text-ink hover:no-underline whitespace-nowrap">
                品質グレード
              </Link>
              <Link href="/partners" className="text-sub hover:text-ink hover:no-underline whitespace-nowrap">
                掲載について
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-4 shrink-0">
              <Link href="/account" aria-label="お気に入り" title="お気に入り" className="hidden sm:inline-flex flex-col items-center text-[10px] text-sub hover:text-ink hover:no-underline">
                <Heart size={18} strokeWidth={1.6} aria-hidden="true" />
                お気に入り
              </Link>
              <Link href="/account" aria-label="閲覧履歴" title="閲覧履歴" className="hidden sm:inline-flex flex-col items-center text-[10px] text-sub hover:text-ink hover:no-underline">
                <History size={18} strokeWidth={1.6} aria-hidden="true" />
                閲覧履歴
              </Link>
              <Suspense fallback={<UserMenuPlaceholder />}>
                <UserMenu />
              </Suspense>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mt-16 bg-ground border-t border-line">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-6 text-[12px] text-faint flex flex-col gap-2 leading-relaxed">
            <p className="m-0">レンタルの審査・契約・配送は各レンタル会社が、購入は各ショップが行います。リンク経由の購入で紹介料を受け取ることがあります。</p>
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
              <span>© ZUX Inc.</span>
              <Link href="/privacy" className="text-mute">個人情報の取り扱い</Link>
              <Link href="/guide/grades" className="text-mute">品質グレード基準</Link>
              <Link href="/partners" className="text-mute">掲載をご希望の方へ</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
