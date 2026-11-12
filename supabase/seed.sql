-- ローカル開発用のサンプルデータ（supabase db reset で投入）。本番には投入しない。
insert into public.reviews (device_slug, rating, author, use_case, acquisition, via, body, status, is_sample, moderated_at) values
  ('macbook-pro-14-m5', 5, 'デザイン会社・情報システム担当', 'design', 'rent', 'ベイサイドレンタル・24か月', 'グレードAで届いた3台とも外観はほぼ新品。Adobe CCとフォントの設定まで済んでいて、入社初日からそのまま使えました。', 'approved', true, now()),
  ('macbook-pro-14-m5', 4, 'IT企業・開発リーダー', 'dev', 'rent', 'テックリース東京・12か月', '開発テンプレートでDockerとSSH鍵の設定が済んでいるのが助かる。16GBだとコンテナを多く動かすと足りないので、24GBを選んで正解でした。', 'approved', true, now()),
  ('macbook-pro-14-m5', 5, '日本法人（中国本社）・総務', 'office', 'rent', 'ノースITサービス・24か月', '設立直後でしたが、親会社保証で審査が通りました。中国語で相談できたのが大きかったです。翌日に届きました。', 'approved', true, now()),
  ('macbook-pro-14-m5', 4, 'フリーランス映像クリエイター', 'design', 'buy', 'ヨドバシ.comで購入', '4K動画の書き出しが以前のIntel Macより大幅に速い。画面が明るく屋外でも見やすい。重さは少し気になる。', 'approved', true, now());
