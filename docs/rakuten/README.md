# 楽天API リファレンス

> 公式ドキュメント: https://webservice.rakuten.co.jp/documentation

## 認証情報

| 項目 | 値 |
|------|-----|
| アプリケーションURL | https://www.xmall.jp |
| アプリケーションID | `4996a68e-fd45-4cfd-bcda-d5194c189c86` |
| アクセスキー | `pk_VM0uXWoRRtjXclrK8k5edeU07YVJCr8z02yGf6oOXT4` |
| アフィリエイトID | `545d4880.482f649b.545d4881.66442df0` |

## API一覧

### 1. 楽天商品検索API (Ichiba Item Search)

**エンドポイント:** `GET https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220607`

**パラメータ:**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `keyword` | 条件必須 | 検索キーワード |
| `genreId` | 条件必須 | 楽天ジャンルID |
| `shopCode` | 任意 | 特定店舗コード |
| `page` | 任意 | 1-100 |
| `hits` | 任意 | 1-30 |
| `sort` | 任意 | `standard`, `-affiliateRate`, `+price` 等 |
| `minPrice`/`maxPrice` | 任意 | 価格範囲 |
| `postageFlag` | 任意 | 送料無料=1 |
| `availability` | 任意 | 在庫のみ=1 |

**レスポンス:** `Items[].Item` に商品情報。`affiliateUrl` がアフィリエイトリンク。

### 2. 楽天商品ランキングAPI (Ichiba Item Ranking)

**エンドポイント:** `GET https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220607`

**パラメータ:** `genreId`, `period` (realtime/daily/weekly/monthly)

### 3. 楽天ジャンルAPI (Ichiba Genre)

**エンドポイント:** `GET https://app.rakuten.co.jp/services/api/IchibaGenre/Search/20220607`

**主要ジャンルID:**
- `100433` — スポーツ・アウトドア
- `565392` — サーフィン
- `200162` — ゴルフ
- `565430` — スノーボード
- `100227` — アパレル・ファッション

## 実装メモ

- レート制限: 1リクエスト/秒推奨
- `affiliateUrl` をそのままリンクとして使う
- 画像: `mediumImageUrls[0].imageUrl` に `?type=o` でオリジナルサイズ
- `itemPrice` は税抜き整数
