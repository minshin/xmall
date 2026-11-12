import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/format";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "xmall｜法人向けPC・IT機器のレンタル・購入比較",
    template: "%s｜xmall",
  },
  description:
    "法人向けノートPC・IT機器を、複数のレンタル会社と主要ショップで比較。品質グレードと設定テンプレートを標準化し、はじめての方にもわかる詳しい解説付き。",
  openGraph: { siteName: SITE_NAME, locale: "ja_JP", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="bg-white border-b border-line">
          <div className="mx-auto max-w-[1240px] px-6 py-3 flex flex-wrap items-center gap-5">
            <Link href="/" className="font-bold text-xl text-ink no-underline tracking-tight">
              x<span className="text-brand">mall</span>
            </Link>
            <nav aria-label="メイン" className="flex flex-wrap gap-5 text-sm flex-1">
              <Link href="/" className="text-ink no-underline">ノートPC</Link>
              <Link href="/guide/grades" className="text-ink no-underline">品質グレード基準</Link>
              <Link href="/partners" className="text-ink no-underline">掲載をご希望の方へ</Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line bg-white mt-12">
          <div className="mx-auto max-w-[1240px] px-6 py-8 text-xs text-mute flex flex-col gap-2">
            <p>xmallは法人向けIT機器のレンタル・購入を比較するサイトです。レンタルの審査・契約・配送は各レンタル会社が、購入は各ショップが行います。</p>
            <p>当サイトはAmazonアソシエイトなどのアフィリエイトプログラムに参加しており、リンク経由の購入で紹介料を受け取ることがあります。</p>
            <p>© ZUX Inc.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
