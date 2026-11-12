# xmall.jp

法人向けIT機器（ノートPCほか）の **レンタル＋購入 比較サイト**。

- 標準化された機種カタログ（SPU × 構成 × 品質グレード × 設定テンプレート）
- 複数レンタル会社の月額比較、Amazon・楽天などの購入価格比較、「買う vs 借りる」計算
- はじめての方向けの詳しい解説（スペックのやさしい説明、使い方の例、構成の選び方、FAQ）と口コミ
- SEO / GEO：JSON-LD（Product・FAQPage・BreadcrumbList）、sitemap、robots、llms.txt
- AI向け：MCPエンドポイント `/api/mcp`、JSON API `/api/devices`

開発方針・構成は [CLAUDE.md](./CLAUDE.md)、詳細は [docs/](./docs) を参照。

## 開発

```sh
npm install
npm run dev     # http://localhost:3000
npm test
npm run build
```

## 現状

v0.1。レンタル会社・月額・公式以外のショップ価格・口コミはサンプルデータ。仕様・公式価格を出典で確認済みなのは MacBook Pro 14インチ（M5）のみ。
