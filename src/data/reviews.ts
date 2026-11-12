import type { Review } from "../lib/types";

/** 口コミ（すべてサンプル） */
export const REVIEWS: Review[] = [
  { id: "r1", deviceSlug: "macbook-pro-14-m5", rating: 5, author: "デザイン会社・情報システム担当", use: "design", acquisition: "rent", via: "ベイサイドレンタル・24か月", body: "グレードAで届いた3台とも外観はほぼ新品。Adobe CCとフォントの設定まで済んでいて、入社初日からそのまま使えました。", helpful: 24, replies: 2, sample: true },
  { id: "r2", deviceSlug: "macbook-pro-14-m5", rating: 4, author: "IT企業・開発リーダー", use: "dev", acquisition: "rent", via: "テックリース東京・12か月", body: "開発テンプレートでDockerとSSH鍵の設定が済んでいるのが助かる。16GBだとコンテナを多く動かすと足りないので、24GBを選んで正解でした。", helpful: 17, replies: 1, sample: true },
  { id: "r3", deviceSlug: "macbook-pro-14-m5", rating: 5, author: "日本法人（中国本社）・総務", use: "office", acquisition: "rent", via: "ノースITサービス・24か月", body: "設立直後でしたが、親会社保証で審査が通りました。中国語で相談できたのが大きかったです。翌日に届きました。", helpful: 31, replies: 0, sample: true },
  { id: "r4", deviceSlug: "macbook-pro-14-m5", rating: 4, author: "フリーランス映像クリエイター", use: "design", acquisition: "buy", via: "ヨドバシ.comで購入", body: "4K動画の書き出しが以前のIntel Macより大幅に速い。画面が明るく屋外でも見やすい。重さは少し気になる。", helpful: 12, replies: 1, sample: true },
];
