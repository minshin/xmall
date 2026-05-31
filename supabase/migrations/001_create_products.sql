-- supabase/migrations/001_create_products.sql

-- 商品テーブル
create table if not exists xmall_products (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('rakuten', 'amazon', 'yahoo', 'a8net')),
  source_id text not null,
  title text not null,
  description text not null default '',
  price integer not null,
  currency text not null default 'JPY',
  image_url text not null default '',
  image_urls text[] not null default '{}',
  affiliate_url text not null,
  product_url text not null,
  category text not null default '',
  category_id text not null default '',
  tags text[] not null default '{}',
  region text not null default 'jp' check (region in ('jp', 'au', 'us', 'global')),
  shop_name text not null default '',
  shop_code text not null default '',
  source_updated_at timestamptz,
  review_count integer not null default 0,
  review_average real not null default 0,
  affiliate_rate real not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_id)
);

create index if not exists idx_xmall_products_category on xmall_products(category);
create index if not exists idx_xmall_products_source on xmall_products(source);
create index if not exists idx_xmall_products_region on xmall_products(region);
create index if not exists idx_xmall_products_created_at on xmall_products(created_at desc);
create index if not exists idx_xmall_products_affiliate_rate on xmall_products(affiliate_rate desc);
create index if not exists idx_xmall_products_tags on xmall_products using gin(tags);

-- カテゴリマスタ
create table if not exists xmall_categories (
  id text primary key,
  name text not null,
  parent_id text references xmall_categories(id),
  source text not null default 'rakuten',
  level integer not null default 0,
  created_at timestamptz not null default now()
);

-- 更新日時自動更新
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_xmall_products_updated_at
  before update on xmall_products
  for each row execute function update_updated_at();
