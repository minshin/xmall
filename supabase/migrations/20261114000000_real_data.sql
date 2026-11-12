-- xmall v0.5：サンプルデータをやめて、実在レンタル会社の掲載価格だけで比較する
--
--   * 架空のレンタル会社（products.supplier_ids）と、そこから月額を計算する基準額（product_variants.rent_base）を廃止。
--     レンタル月額は rental_listings（各社の公開ページから取得）だけを使う。
--   * 掲載商品と機種の対応づけを DB に移す：products.listing_match（JavaScript の正規表現。大文字小文字を区別しない）。
--     取り込み時・機種の保存時に lib/rental-match.ts が device_slug / config_id を付け直す。
--     管理画面で手で決めたもの（match_manual）は自動では上書きしない。
--   * 問い合わせはサンプル見積（グレード・テンプレート・会社・金額）を持たない「相談」にする。
--   * サンプル口コミを削除。

-- ───────── 機種 ─────────
alter table public.products add column listing_match text;
alter table public.products drop column supplier_ids;
alter table public.product_variants drop column rent_base;

comment on column public.products.listing_match is
  'レンタル会社の掲載商品（メーカー＋型番＋タイトル、NFKC 正規化済み）に当てる正規表現（JavaScript、i フラグ）。空なら対応づけない';

-- 旧 scripts/rentals/lib.ts の RULES を移す
update public.products set listing_match = v.re
from (values
  ('macbook-pro-14-m5',  '^(?=.*MacBook ?Pro 14)(?=.*\bM5\b(?! ?(Pro|Max))).*'),
  ('macbook-air-13',     '^(?=.*MacBook ?Air 13)(?=.*\bM[2-5]\b).*'),
  ('thinkpad-x1-carbon', '^(?=.*X1 ?Carbon)(?=.*(Gen ?1[23]\b|Aura|Core ?Ultra)).*'),
  ('thinkpad-e14',       'ThinkPad ?E14'),
  ('latitude-5450',      'Latitude ?5450'),
  ('lets-note-sr',       'CF-SR|Let.?s ?note ?SR\b'),
  ('precision-5690',     'Precision ?5690')
) as v(slug, re)
where products.slug = v.slug;

-- ───────── 掲載商品 ─────────
alter table public.rental_listings add column match_manual boolean not null default false;
comment on column public.rental_listings.device_slug is 'products.slug（対応しなければ null）';
create index rental_listings_unmatched_idx on public.rental_listings (company_id) where active and device_slug is null;

-- ───────── 問い合わせ（相談） ─────────
alter table public.inquiries alter column config_id drop not null;
alter table public.inquiries alter column grade drop not null;
alter table public.inquiries alter column template drop not null;
alter table public.inquiries alter column supplier_id drop not null;
alter table public.inquiries alter column monthly_per_unit drop not null;
alter table public.inquiries alter column contract_total drop not null;
alter table public.inquiries alter column term_months drop not null;
alter table public.inquiries drop constraint if exists inquiries_term_months_check;
alter table public.inquiries add constraint inquiries_term_months_check check (term_months is null or term_months between 1 and 60);

-- ───────── 口コミ ─────────
delete from public.reviews where is_sample;
