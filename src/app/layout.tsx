import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
        <header className="sticky top-0 z-40 bg-[rgb(251_251_253/0.8)] backdrop-blur-xl backdrop-saturate-150 border-b border-black/5">
          <div className="mx-auto max-w-[1080px] px-4 sm:px-6 h-12 flex items-center gap-7">
            <Link href="/" className="font-semibold text-[19px] text-ink tracking-tight hover:no-underline">
              xmall
            </Link>
            <nav aria-label="メイン" className="flex gap-6 text-[12px] text-sub overflow-x-auto">
              <Link href="/" className="text-sub hover:text-ink hover:no-underline whitespace-nowrap">
                製品
              </Link>
              <Link href="/guide/grades" className="text-sub hover:text-ink hover:no-underline whitespace-nowrap">
                品質グレード
              </Link>
              <Link href="/partners" className="text-sub hover:text-ink hover:no-underline whitespace-nowrap">
                掲載について
              </Link>
            </nav>
            <div className="ml-auto flex items-center">
              <Suspense fallback={<UserMenuPlaceholder />}>
                <UserMenu />
              </Suspense>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mt-16 bg-ground border-t border-line">
          <div className="mx-auto max-w-[1080px] px-4 sm:px-6 py-6 text-[12px] text-faint flex flex-col gap-2 leading-relaxed">
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
