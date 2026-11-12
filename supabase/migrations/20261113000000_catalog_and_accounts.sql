-- xmall v0.4：商品カタログを DB に移す ＋ 会員（Supabase Auth）＋ 管理画面
--
-- 商品モデル
--   categories        品目（ノートPC・モニター・タブレット…）
--   spec_attributes   品目ごとのスペック項目の定義（型・単位・絞り込み可否・一覧に出すか・アイコン）
--                     scope = product：機種で 1 つ（画面サイズなど）／ variant：構成ごと（メモリ・ストレージなど）
--   sites             メーカー・購入先・レンタル会社（favicon つき）。products.brand_id はメーカー（kind = maker）
--   products          機種（SPU）。解説コンテンツは content（jsonb、アプリ側で zod 検証）
--   product_specs     機種 × スペック項目の値（value）＋表示用の文（display）＋やさしい説明（plain）
--   product_variants  構成（SKU 相当）。attrs に variant スコープの値
--   media             Storage（バケット media）に置いた画像。product_media で機種に並び順つきで紐づけ
--
-- 会員
--   profiles          auth.users と 1:1（サインアップ時にトリガーで作成）。role = user / editor / admin
--   既存の行動テーブル（閲覧・お気に入り・口コミ・問い合わせ）に user_id を追加（ログイン中のみ記録）
--
-- 方針は従来どおり：アクセスはサーバー（postgres ロール）だけ。全テーブル RLS 有効・ポリシーなし。

-- ───────── 品目・スペック定義 ─────────

create table public.categories (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  name       text not null,
  icon       text,                                   -- lucide のアイコン名（例：laptop）
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.spec_type as enum ('text', 'number', 'boolean', 'enum');
create type public.spec_scope as enum ('product', 'variant');

create table public.spec_attributes (
  id          uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories (id) on delete cascade,
  key         text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label       text not null,
  unit        text,
  type        public.spec_type not null default 'text',
  scope       public.spec_scope not null default 'product',
  options     text[] not null default '{}',          -- enum の選択肢
  icon        text,
  filterable  boolean not null default false,        -- 一覧の絞り込みに出す
  highlight   boolean not null default false,        -- 一覧カード・機種ページ上部に出す
  sort        integer not null default 0,
  unique (category_id, key)
);

-- ───────── サイト（メーカー・購入先・レンタル会社）と画像 ─────────

create table public.media (
  id         uuid primary key default gen_random_uuid(),
  path       text not null unique,                   -- バケット media 内のパス
  mime       text not null,
  bytes      integer not null check (bytes > 0),
  width      integer,
  height     integer,
  alt        text not null default '',
  credit     text,                                   -- 権利表記・出典
  kind       text not null default 'other' check (kind in ('product', 'favicon', 'other')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.sites (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  name       text not null,
  kind       text not null check (kind in ('maker', 'shop', 'rental', 'other')),
  url        text,
  favicon_id uuid references public.media (id) on delete set null,
  sort       integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ───────── 機種 ─────────

create type public.product_status as enum ('draft', 'published', 'archived');

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_id  text not null references public.categories (id),
  brand_id     text not null references public.sites (id),
  name         text not null,
  subtitle     text,                                 -- 例：M5、Core Ultra 7
  release_date date,
  status       public.product_status not null default 'draft',
  verified     boolean not null default false,       -- 仕様・価格を出典で確認済み
  body_color   text not null default '#8a8d93' check (body_color ~ '^#[0-9a-fA-F]{6}$'),
  uses         text[] not null default '{}',
  supplier_ids text[] not null default '{}',         -- 見積を出すレンタル会社（現状は src/data/master.ts のサンプル）
  content      jsonb,                                -- summary / goodFor / notFor / scenes / choose / faqs / related
  sources      jsonb not null default '[]',
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
create index products_category_status_idx on public.products (category_id, status);

create table public.product_specs (
  product_id   uuid not null references public.products (id) on delete cascade,
  attribute_id uuid not null references public.spec_attributes (id) on delete cascade,
  value        jsonb not null,                       -- 数値・文字列・真偽
  display      text,                                 -- 表示用の文（空なら value と単位から作る）
  plain        text,                                 -- 「つまりどういうこと？」
  primary key (product_id, attribute_id)
);

create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  code           text not null check (code ~ '^[a-z0-9-]+$'),   -- 例：16-512（URL・問い合わせに使う）
  label          text not null,
  attrs          jsonb not null default '{}',
  official_price integer check (official_price > 0),
  rent_base      integer not null check (rent_base > 0),
  note           text,
  sort           integer not null default 0,
  unique (product_id, code)
);

create table public.product_media (
  product_id uuid not null references public.products (id) on delete cascade,
  media_id   uuid not null references public.media (id) on delete cascade,
  sort       integer not null default 0,
  primary key (product_id, media_id)
);

-- ───────── 会員 ─────────

create type public.user_role as enum ('user', 'editor', 'admin');

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  role         public.user_role not null default 'user',
  full_name    text check (char_length(full_name) <= 50),
  company_name text check (char_length(company_name) <= 100),
  department   text check (char_length(department) <= 50),
  phone        text check (char_length(phone) <= 30),
  company_size text check (company_size in ('1-9', '10-49', '50-299', '300-999', '1000+')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- サインアップ（メール・Google）で auth.users に行ができたら profiles を作る
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 50))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- メールアドレス変更を profiles に反映
create function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, ''), updated_at = now() where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.handle_user_email_change();

-- 行動データにログイン中の会員 ID を残す（未ログインは null のまま）
alter table public.device_views add column user_id uuid references public.profiles (id) on delete set null;
alter table public.device_views add column last_viewed_at timestamptz not null default now();
alter table public.device_views add column view_count integer not null default 1;
alter table public.device_likes add column user_id uuid references public.profiles (id) on delete set null;
alter table public.reviews      add column user_id uuid references public.profiles (id) on delete set null;
alter table public.inquiries    add column user_id uuid references public.profiles (id) on delete set null;
create index device_views_user_idx on public.device_views (user_id, last_viewed_at desc) where user_id is not null;
create index device_likes_user_idx on public.device_likes (user_id) where user_id is not null;

-- ───────── RLS（ポリシーなし＝サーバー以外から読めない） ─────────

alter table public.categories       enable row level security;
alter table public.spec_attributes  enable row level security;
alter table public.media            enable row level security;
alter table public.sites            enable row level security;
alter table public.products         enable row level security;
alter table public.product_specs    enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media    enable row level security;
alter table public.profiles         enable row level security;

-- ───────── 初期の品目とスペック項目（管理画面で追加・変更できる） ─────────

insert into public.categories (id, name, icon, sort) values
  ('laptop',  'ノートPC',   'laptop',     1),
  ('monitor', 'モニター',   'monitor',    2),
  ('tablet',  'タブレット', 'tablet',     3);

insert into public.spec_attributes (category_id, key, label, unit, type, scope, options, icon, filterable, highlight, sort) values
  ('laptop', 'chip',          'チップ',          null,   'text',   'product', '{}', 'cpu',          false, false, 10),
  ('laptop', 'cpu_family',    'CPU',             null,   'enum',   'product', '{"Apple M","Intel Core Ultra","Intel Core i","AMD Ryzen","Snapdragon"}', 'cpu', true, false, 11),
  ('laptop', 'memory_gb',     'メモリ',          'GB',   'number', 'variant', '{}', 'memory-stick', true,  true,  20),
  ('laptop', 'storage_gb',    'ストレージ',      'GB',   'number', 'variant', '{}', 'hard-drive',   false, false, 21),
  ('laptop', 'memory_note',   'メモリ（詳細）',  null,   'text',   'product', '{}', 'memory-stick', false, false, 22),
  ('laptop', 'storage_note',  'ストレージ（詳細）', null, 'text',  'product', '{}', 'hard-drive',   false, false, 23),
  ('laptop', 'screen_inch',   '画面サイズ',      'インチ', 'number', 'product', '{}', 'monitor',    false, true,  30),
  ('laptop', 'display',       '画面',            null,   'text',   'product', '{}', 'monitor',      false, false, 31),
  ('laptop', 'battery',       'バッテリー',      null,   'text',   'product', '{}', 'battery-full', false, false, 40),
  ('laptop', 'ports',         '端子',            null,   'text',   'product', '{}', 'usb',          false, false, 50),
  ('laptop', 'wireless',      '無線',            null,   'text',   'product', '{}', 'wifi',         false, false, 51),
  ('laptop', 'dimensions',    '大きさ・重さ',    null,   'text',   'product', '{}', 'ruler',        false, false, 60),
  ('laptop', 'weight_kg',     '重さ',            'kg',   'number', 'product', '{}', 'weight',       false, true,  61),
  ('laptop', 'os',            'OS',              null,   'enum',   'product', '{"macOS","Windows","ChromeOS"}', 'app-window', true, false, 70),
  ('laptop', 'os_note',       'OS（詳細）',      null,   'text',   'product', '{}', 'app-window',   false, false, 71),
  ('laptop', 'launch',        '発売・メーカー価格', null, 'text',  'product', '{}', 'calendar',     false, false, 80),

  ('monitor', 'size_inch',    '画面サイズ',      'インチ', 'number', 'product', '{}', 'monitor',    true,  true,  10),
  ('monitor', 'resolution',   '解像度',          null,   'enum',   'product', '{"フルHD","WQHD","4K","5K"}', 'scan', true, true, 20),
  ('monitor', 'refresh_hz',   'リフレッシュレート', 'Hz', 'number', 'product', '{}', 'activity',     false, false, 30),
  ('monitor', 'panel',        'パネル',          null,   'enum',   'product', '{"IPS","VA","TN","有機EL"}', 'layers', true, false, 40),
  ('monitor', 'usb_c_power',  'USB-C給電',       'W',    'number', 'product', '{}', 'usb',          false, true,  50),
  ('monitor', 'ports',        '端子',            null,   'text',   'product', '{}', 'usb',          false, false, 60),

  ('tablet', 'chip',          'チップ',          null,   'text',   'product', '{}', 'cpu',          false, false, 10),
  ('tablet', 'storage_gb',    'ストレージ',      'GB',   'number', 'variant', '{}', 'hard-drive',   true,  true,  20),
  ('tablet', 'cellular',      'モバイル通信',    null,   'boolean', 'variant', '{}', 'signal',      true,  false, 21),
  ('tablet', 'screen_inch',   '画面サイズ',      'インチ', 'number', 'product', '{}', 'tablet',     false, true,  30),
  ('tablet', 'weight_kg',     '重さ',            'kg',   'number', 'product', '{}', 'weight',       false, true,  40),
  ('tablet', 'os',            'OS',              null,   'enum',   'product', '{"iPadOS","Android","Windows"}', 'app-window', true, false, 50);
