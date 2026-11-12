# xmall.jp

法人向けIT機器（ノートPCほか）の **レンタル＋購入 比較サイト**。

- 標準化された機種カタログ（SPU × 構成 × 品質グレード × 設定テンプレート）
- 複数レンタル会社の月額比較、Amazon・楽天などの購入価格比較、「買う vs 借りる」計算
- はじめての方向けの詳しい解説（スペックのやさしい説明、使い方の例、構成の選び方、FAQ）と口コミ
- SEO / GEO：JSON-LD（Product・FAQPage・BreadcrumbList）、sitemap、robots、llms.txt
- AI向け：MCPエンドポイント `/api/mcp`、JSON API `/api/devices`

開発方針・構成は [CLAUDE.md](./CLAUDE.md)、詳細は [docs/](./docs) を参照。

## 開発

前提：Node.js 20.9+、Docker Desktop（ローカルの Supabase 用）、Supabase CLI（`brew install supabase/tap/supabase`）

```sh
npm install
cp .env.example .env.local
npm run db:start   # ローカル Supabase 起動。初回は migrations と seed（サンプル口コミ）を自動で流す
npm run dev        # http://localhost:3000
```

- 管理画面：http://localhost:3000/admin（`.env.local` の ADMIN_USER / ADMIN_PASSWORD）
- Supabase Studio：http://127.0.0.1:54323
- DB を作り直す：`npm run db:reset`　止める：`npm run db:stop`
- DB なし（DATABASE_URL 未設定）でも閲覧はできる（いいね・口コミ・問い合わせは保存されない）

## テスト

```sh
npm test
# DB のテストも実行する場合（DB 名は _test で終わること。毎回 public スキーマを作り直す）
createdb -h 127.0.0.1 -p 54322 -U postgres xmall_test
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/xmall_test npm test
```

## 現状

v0.2。いいね・口コミ（審査制）・問い合わせ・管理画面が DB で動く。
レンタル会社・月額・公式以外のショップ価格はサンプル。仕様・公式価格を出典で確認済みなのは MacBook Pro 14インチ（M5）のみ。
