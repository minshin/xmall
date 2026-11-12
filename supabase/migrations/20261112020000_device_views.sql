-- xmall v0.3：機種ページの閲覧者数（「◯人が見ています」）
-- 訪問者 ID（httpOnly Cookie の匿名 ID）ごとに 1 回だけ数える。追跡には使わない。

create table public.device_views (
  device_slug text not null,
  visitor_id  uuid not null,
  created_at  timestamptz not null default now(),
  primary key (device_slug, visitor_id)
);
alter table public.device_views enable row level security;

-- 集計ビューに閲覧者数を追加（列は末尾に足すので create or replace で置き換えられる）
create or replace view public.device_stats with (security_invoker = true) as
select s.device_slug,
       coalesce(l.likes, 0)         as likes,
       coalesce(r.review_count, 0)  as review_count,
       r.rating_avg,
       coalesce(v.views, 0)         as views
from (select device_slug from public.device_likes
      union select device_slug from public.reviews where status = 'approved'
      union select device_slug from public.device_views) s
left join (select device_slug, count(*)::int as likes
           from public.device_likes group by device_slug) l using (device_slug)
left join (select device_slug, count(*)::int as review_count, round(avg(rating)::numeric, 1)::float8 as rating_avg
           from public.reviews where status = 'approved' group by device_slug) r using (device_slug)
left join (select device_slug, count(*)::int as views
           from public.device_views group by device_slug) v using (device_slug);
