import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'xmall — アフィリエイト商品発見プラットフォーム',
  description: '楽天・Amazon・Yahoo! のアフィリエイト商品をPinterest風にブラウズ',
  metadataBase: new URL('https://www.xmall.jp'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  )
}
