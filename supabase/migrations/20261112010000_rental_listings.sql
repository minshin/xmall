-- xmall v0.3：実在レンタル会社の掲載価格
-- 方針：
--   * 各社の公開ページから scripts/rentals/scrape.ts で取得 → supabase/data/rental-listings.json（git で差分を確認）
--     → scripts/rentals/import.ts でこのテーブルに upsert する。
--   * 提携先ではないので、サイトでは「各社サイトの掲載価格」として出典・取得日を添えて表示し、各社ページへリンクする。
--   * 価格の税区分はページの表記どおり（記載が無ければ unknown）。読み取れない項目は null。
--   * 他のテーブルと同じく RLS 有効・ポリシーなし（サーバーの postgres ロールからのみ読む）。

create table public.rental_companies (
  id         text primary key,                                  -- 例：rentio, tamaya
  name       text not null,                                     -- サービス名
  operator   text,                                              -- 運営会社
  url        text not null,
  audience   text not null check (audience in ('business', 'mixed')),
  note       text,
  updated_at timestamptz not null default now()
);

create table public.rental_listings (
  id              uuid primary key default gen_random_uuid(),
  company_id      text not null references public.rental_companies (id) on delete cascade,
  external_id     text not null,                                -- 会社側の商品コード／URL の識別子
  url             text not null,
  title           text not null,
  maker           text,
  model           text,
  cpu             text,
  memory_gb       integer,
  storage_gb      integer,
  os              text,
  condition       text check (condition in ('new', 'used', 'selectable')),
  office_included boolean,
  in_stock        boolean,                                      -- false：ページに在庫なしの表示。null：記載なし
  price_tax       text not null check (price_tax in ('incl', 'excl', 'unknown')),
  terms           text,
  device_slug     text,                                         -- src/data/devices.ts の slug（対応しなければ null）
  config_id       text,
  fetched_at      date not null,                                -- ページを取得した日
  active          boolean not null default true,                -- 最新の取得で見つからなかったら false
  updated_at      timestamptz not null default now(),
  unique (company_id, external_id)
);
create index rental_listings_device_idx on public.rental_listings (device_slug) where active and device_slug is not null;

create table public.rental_prices (
  listing_id uuid not null references public.rental_listings (id) on delete cascade,
  term_unit  text not null check (term_unit in ('day', 'month')),
  term_value integer not null check (term_value > 0),
  price_yen  integer not null check (price_yen > 0),
  basis      text not null check (basis in ('total', 'per_month')),  -- total：期間合計／per_month：その期間での月額
  label      text not null,                                           -- ページ上の表記
  primary key (listing_id, term_unit, term_value)
);

alter table public.rental_companies enable row level security;
alter table public.rental_listings  enable row level security;
alter table public.rental_prices    enable row level security;
