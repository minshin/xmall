import type { Sql } from "./db";

/** 会員（profiles）と行動データの SQL。Next.js に依存しない */

export type Role = "user" | "editor" | "admin";
export const ROLES: Role[] = ["user", "editor", "admin"];
const RANK: Record<Role, number> = { user: 0, editor: 1, admin: 2 };
/** role が min 以上か（editor：カタログ・口コミ・問い合わせ、admin：さらに会員と権限） */
export const hasRole = (p: Pick<Profile, "role"> | null | undefined, min: Role) => !!p && RANK[p.role] >= RANK[min];
export const COMPANY_SIZES = ["1-9", "10-49", "50-299", "300-999", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export interface Profile {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
  companyName: string | null;
  department: string | null;
  phone: string | null;
  companySize: CompanySize | null;
  createdAt: Date;
  lastSeenAt: Date | null;
}

type ProfileRow = {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
  company_name: string | null;
  department: string | null;
  phone: string | null;
  company_size: CompanySize | null;
  created_at: Date;
  last_seen_at: Date | null;
};

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  email: r.email,
  role: r.role,
  fullName: r.full_name,
  companyName: r.company_name,
  department: r.department,
  phone: r.phone,
  companySize: r.company_size,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
});

export async function getProfile(sql: Sql, id: string): Promise<Profile | null> {
  const [r] = await sql<ProfileRow[]>`select * from public.profiles where id = ${id}`;
  return r ? toProfile(r) : null;
}

export async function updateProfile(
  sql: Sql,
  id: string,
  p: { fullName: string | null; companyName: string | null; department: string | null; phone: string | null; companySize: CompanySize | null },
): Promise<void> {
  await sql`
    update public.profiles set full_name = ${p.fullName}, company_name = ${p.companyName}, department = ${p.department},
      phone = ${p.phone}, company_size = ${p.companySize}, updated_at = now()
    where id = ${id}`;
}

export async function touchLastSeen(sql: Sql, id: string): Promise<void> {
  await sql`update public.profiles set last_seen_at = now() where id = ${id} and (last_seen_at is null or last_seen_at < now() - interval '10 minutes')`;
}

export async function setRole(sql: Sql, id: string, role: Role): Promise<boolean> {
  const r = await sql`update public.profiles set role = ${role}, updated_at = now() where id = ${id}`;
  return r.count > 0;
}

// ───────── 管理画面：会員一覧・詳細 ─────────

export interface UserListItem extends Profile {
  views: number;
  likes: number;
  reviews: number;
  inquiries: number;
  confirmed: boolean;
  provider: string | null;
}

export async function listUsers(sql: Sql, opts: { q?: string; limit?: number; offset?: number } = {}): Promise<{ users: UserListItem[]; total: number }> {
  const q = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const where = q ? sql`where p.email ilike ${q} or p.company_name ilike ${q} or p.full_name ilike ${q}` : sql``;
  const rows = await sql<(ProfileRow & { views: number; likes: number; reviews: number; inquiries: number; confirmed: boolean; provider: string | null })[]>`
    select p.*,
      (select count(*)::int from public.device_views v where v.user_id = p.id) as views,
      (select count(*)::int from public.device_likes l where l.user_id = p.id) as likes,
      (select count(*)::int from public.reviews r where r.user_id = p.id) as reviews,
      (select count(*)::int from public.inquiries i where i.user_id = p.id) as inquiries,
      (u.email_confirmed_at is not null) as confirmed,
      u.raw_app_meta_data ->> 'provider' as provider
    from public.profiles p join auth.users u on u.id = p.id
    ${where}
    order by p.created_at desc
    limit ${opts.limit ?? 50} offset ${opts.offset ?? 0}`;
  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from public.profiles p ${where}`;
  return {
    users: rows.map((r) => ({ ...toProfile(r), views: r.views, likes: r.likes, reviews: r.reviews, inquiries: r.inquiries, confirmed: r.confirmed, provider: r.provider })),
    total,
  };
}

export interface UserActivity {
  views: { deviceSlug: string; viewCount: number; lastViewedAt: Date }[];
  likes: { deviceSlug: string; createdAt: Date }[];
  reviews: { id: string; deviceSlug: string; rating: number; status: string; createdAt: Date }[];
  inquiries: { id: string; deviceSlug: string; quantity: number; status: string; createdAt: Date }[];
}

export async function userActivity(sql: Sql, userId: string): Promise<UserActivity> {
  const [views, likes, reviews, inquiries] = await Promise.all([
    sql<{ device_slug: string; view_count: number; last_viewed_at: Date }[]>`
      select device_slug, view_count, last_viewed_at from public.device_views where user_id = ${userId} order by last_viewed_at desc limit 100`,
    sql<{ device_slug: string; created_at: Date }[]>`
      select device_slug, created_at from public.device_likes where user_id = ${userId} order by created_at desc`,
    sql<{ id: string; device_slug: string; rating: number; status: string; created_at: Date }[]>`
      select id, device_slug, rating, status::text, created_at from public.reviews where user_id = ${userId} order by created_at desc`,
    sql<{ id: string; device_slug: string; quantity: number; status: string; created_at: Date }[]>`
      select id, device_slug, quantity, status::text, created_at from public.inquiries where user_id = ${userId} order by created_at desc`,
  ]);
  return {
    views: views.map((r) => ({ deviceSlug: r.device_slug, viewCount: r.view_count, lastViewedAt: r.last_viewed_at })),
    likes: likes.map((r) => ({ deviceSlug: r.device_slug, createdAt: r.created_at })),
    reviews: reviews.map((r) => ({ id: r.id, deviceSlug: r.device_slug, rating: r.rating, status: r.status, createdAt: r.created_at })),
    inquiries: inquiries.map((r) => ({ id: r.id, deviceSlug: r.device_slug, quantity: r.quantity, status: r.status, createdAt: r.created_at })),
  };
}

/** 管理画面の概要：会員・行動の集計 */
export async function accountCounts(sql: Sql) {
  const [r] = await sql<{ users: number; users_7d: number; views_7d: number; viewers_7d: number; likes: number }[]>`
    select
      (select count(*)::int from public.profiles) as users,
      (select count(*)::int from public.profiles where created_at > now() - interval '7 days') as users_7d,
      (select coalesce(sum(view_count), 0)::int from public.device_views where last_viewed_at > now() - interval '7 days') as views_7d,
      (select count(*)::int from public.device_views where last_viewed_at > now() - interval '7 days') as viewers_7d,
      (select count(*)::int from public.device_likes) as likes`;
  return r;
}

/** 機種ごとの閲覧・お気に入り（管理画面の人気ランキング） */
export async function deviceEngagement(sql: Sql, limit = 20) {
  return sql<{ device_slug: string; viewers: number; views: number; members: number; likes: number }[]>`
    select v.device_slug, count(*)::int as viewers, sum(v.view_count)::int as views,
      count(v.user_id)::int as members,
      (select count(*)::int from public.device_likes l where l.device_slug = v.device_slug) as likes
    from public.device_views v group by v.device_slug order by viewers desc limit ${limit}`;
}
