-- xmall v0.2：ユーザー投稿・問い合わせ
-- 方針：
--   * 機種カタログ・解説コンテンツは repo（src/data）で管理し、ここには置かない。
--   * DB はユーザーが書き込むもの（いいね・口コミ・参考になった・問い合わせ）だけ。
--   * アクセスはサーバー（Next.js）から postgres ロールで行う。
--     Supabase の anon / authenticated から直接読めないよう、全テーブルで RLS を有効にし、ポリシーは作らない。
--   * visitor_id は httpOnly Cookie に入れた匿名 ID（ログイン不要）。

-- ───────── いいね（気になる） ─────────
create table public.device_likes (
  device_slug text not null,
  visitor_id  uuid not null,
  created_at  timestamptz not null default now(),
  primary key (device_slug, visitor_id)
);

-- ───────── 口コミ ─────────
create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  device_slug  text not null,
  visitor_id   uuid,
  rating       smallint not null check (rating between 1 and 5),
  author       text not null check (char_length(author) between 2 and 40),   -- 肩書き（例：IT企業・総務）
  use_case     text not null check (use_case in ('office', 'design', 'dev', 'sales', 'cad')),
  acquisition  text not null check (acquisition in ('rent', 'buy')),
  via          text check (char_length(via) <= 60),                          -- 例：ベイサイドレンタル・24か月
  body         text not null check (char_length(body) between 30 and 2000),
  status       public.review_status not null default 'pending',
  is_sample    boolean not null default false,
  reject_note  text,
  created_at   timestamptz not null default now(),
  moderated_at timestamptz
);
create index reviews_device_status_idx on public.reviews (device_slug, status, created_at desc);
create index reviews_pending_idx on public.reviews (created_at) where status = 'pending';

create table public.review_helpful (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_id, visitor_id)
);

-- ───────── 問い合わせ（レンタル見積） ─────────
create type public.inquiry_status as enum ('new', 'forwarded', 'closed');

create table public.inquiries (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  visitor_id      uuid,
  -- 見積条件（サーバー側で再計算した値を保存）
  device_slug     text not null,
  config_id       text not null,
  grade           text not null,
  term_months     smallint not null check (term_months in (12, 24, 36)),
  template        text not null,
  quantity        integer not null check (quantity between 1 and 1000),
  supplier_id     text not null,
  monthly_per_unit integer not null,
  contract_total  integer not null,
  -- 連絡先
  company         text not null check (char_length(company) between 1 and 100),
  contact_name    text not null check (char_length(contact_name) between 1 and 50),
  email           text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text check (char_length(phone) <= 30),
  prefecture      text check (char_length(prefecture) <= 10),
  start_month     text check (start_month ~ '^\d{4}-\d{2}$'),
  message         text check (char_length(message) <= 2000),
  -- 運用
  status          public.inquiry_status not null default 'new',
  admin_note      text,
  updated_at      timestamptz not null default now()
);
create index inquiries_status_idx on public.inquiries (status, created_at desc);

-- ───────── 集計ビュー ─────────
create view public.device_stats with (security_invoker = true) as
select s.device_slug,
       coalesce(l.likes, 0)         as likes,
       coalesce(r.review_count, 0)  as review_count,
       r.rating_avg
from (select device_slug from public.device_likes
      union select device_slug from public.reviews where status = 'approved') s
left join (select device_slug, count(*)::int as likes
           from public.device_likes group by device_slug) l using (device_slug)
left join (select device_slug, count(*)::int as review_count, round(avg(rating)::numeric, 1)::float8 as rating_avg
           from public.reviews where status = 'approved' group by device_slug) r using (device_slug);

-- ───────── RLS（ポリシーなし＝サーバー以外から読めない） ─────────
alter table public.device_likes   enable row level security;
alter table public.reviews        enable row level security;
alter table public.review_helpful enable row level security;
alter table public.inquiries      enable row level security;
