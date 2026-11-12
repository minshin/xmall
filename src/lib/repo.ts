import type { Sql } from "./db";
import type { ContactInput, QuoteInput, ReviewInput } from "./validation";
import type { DeviceStats, Review, ReviewStatus, Use } from "./types";

/**
 * DB アクセス（SQL のみ）。Next.js に依存しないのでテストから直接呼べる。
 * キャッシュ・Cookie・再検証は community.ts / actions.ts 側で行う。
 */

// ───────── 集計 ─────────

export async function deviceStats(sql: Sql): Promise<Record<string, DeviceStats>> {
  const rows = await sql<{ device_slug: string; likes: number; review_count: number; rating_avg: number | null }[]>`
    select device_slug, likes, review_count, rating_avg from public.device_stats`;
  return Object.fromEntries(rows.map((r) => [r.device_slug, { likes: r.likes, reviewCount: r.review_count, rating: r.rating_avg }]));
}

// ───────── いいね ─────────

export async function hasLiked(sql: Sql, slug: string, visitorId: string): Promise<boolean> {
  const [r] = await sql`select 1 from public.device_likes where device_slug = ${slug} and visitor_id = ${visitorId}`;
  return !!r;
}

/** いいねを切り替え、切り替え後の状態と件数を返す */
export async function toggleLike(sql: Sql, slug: string, visitorId: string): Promise<{ liked: boolean; likes: number }> {
  return sql.begin(async (tx) => {
    const del = await tx`delete from public.device_likes where device_slug = ${slug} and visitor_id = ${visitorId}`;
    if (del.count === 0) await tx`insert into public.device_likes (device_slug, visitor_id) values (${slug}, ${visitorId})`;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from public.device_likes where device_slug = ${slug}`;
    return { liked: del.count === 0, likes: n };
  });
}

// ───────── 口コミ ─────────

type ReviewRow = {
  id: string;
  device_slug: string;
  rating: number;
  author: string;
  use_case: Use;
  acquisition: "rent" | "buy";
  via: string | null;
  body: string;
  helpful: number;
  created_at: Date;
  is_sample: boolean;
};

const toReview = (r: ReviewRow): Review => ({
  id: r.id,
  deviceSlug: r.device_slug,
  rating: r.rating,
  author: r.author,
  use: r.use_case,
  acquisition: r.acquisition,
  via: r.via,
  body: r.body,
  helpful: r.helpful,
  createdAt: r.created_at.toISOString(),
  sample: r.is_sample,
});

export async function approvedReviews(sql: Sql, slug: string, limit = 50): Promise<Review[]> {
  const rows = await sql<ReviewRow[]>`
    select r.*, (select count(*)::int from public.review_helpful h where h.review_id = r.id) as helpful
    from public.reviews r
    where r.device_slug = ${slug} and r.status = 'approved'
    order by r.created_at desc
    limit ${limit}`;
  return rows.map(toReview);
}

export async function helpedReviewIds(sql: Sql, slug: string, visitorId: string): Promise<string[]> {
  const rows = await sql<{ review_id: string }[]>`
    select h.review_id from public.review_helpful h
    join public.reviews r on r.id = h.review_id
    where r.device_slug = ${slug} and h.visitor_id = ${visitorId}`;
  return rows.map((r) => r.review_id);
}

export async function toggleHelpful(sql: Sql, reviewId: string, visitorId: string): Promise<{ helped: boolean; helpful: number; deviceSlug: string } | null> {
  return sql.begin(async (tx) => {
    const [rev] = await tx<{ device_slug: string }[]>`select device_slug from public.reviews where id = ${reviewId} and status = 'approved'`;
    if (!rev) return null;
    const del = await tx`delete from public.review_helpful where review_id = ${reviewId} and visitor_id = ${visitorId}`;
    if (del.count === 0) await tx`insert into public.review_helpful (review_id, visitor_id) values (${reviewId}, ${visitorId})`;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from public.review_helpful where review_id = ${reviewId}`;
    return { helped: del.count === 0, helpful: n, deviceSlug: rev.device_slug };
  });
}

/** 同じ訪問者の直近24時間の投稿数（連投対策） */
export async function recentCount(sql: Sql, table: "reviews" | "inquiries", visitorId: string): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from ${sql("public." + table)}
    where visitor_id = ${visitorId} and created_at > now() - interval '24 hours'`;
  return n;
}

export async function insertReview(sql: Sql, input: ReviewInput, visitorId: string): Promise<string> {
  const [{ id }] = await sql<{ id: string }[]>`
    insert into public.reviews (device_slug, visitor_id, rating, author, use_case, acquisition, via, body)
    values (${input.deviceSlug}, ${visitorId}, ${input.rating}, ${input.author}, ${input.use}, ${input.acquisition}, ${input.via}, ${input.body})
    returning id`;
  return id;
}

// ───────── 問い合わせ ─────────

export async function insertInquiry(
  sql: Sql,
  q: QuoteInput,
  priced: { monthlyPerUnit: number; contractTotal: number },
  c: ContactInput,
  visitorId: string,
): Promise<string> {
  const [{ id }] = await sql<{ id: string }[]>`
    insert into public.inquiries (
      visitor_id, device_slug, config_id, grade, term_months, template, quantity, supplier_id,
      monthly_per_unit, contract_total, company, contact_name, email, phone, prefecture, start_month, message)
    values (
      ${visitorId}, ${q.deviceSlug}, ${q.configId}, ${q.grade}, ${q.term}, ${q.template}, ${q.quantity}, ${q.supplierId},
      ${priced.monthlyPerUnit}, ${priced.contractTotal}, ${c.company}, ${c.contactName}, ${c.email}, ${c.phone},
      ${c.prefecture}, ${c.startMonth}, ${c.message})
    returning id`;
  return id;
}

// ───────── 管理画面 ─────────

export interface AdminReview extends Review {
  status: ReviewStatus;
}

export async function reviewsByStatus(sql: Sql, status: ReviewStatus, limit = 100): Promise<AdminReview[]> {
  const rows = await sql<(ReviewRow & { status: ReviewStatus })[]>`
    select r.*, 0 as helpful from public.reviews r
    where r.status = ${status}
    order by r.created_at ${status === "pending" ? sql`asc` : sql`desc`}
    limit ${limit}`;
  return rows.map((r) => ({ ...toReview(r), status: r.status }));
}

export async function moderateReview(sql: Sql, id: string, status: "approved" | "rejected", note?: string | null): Promise<string | null> {
  const [r] = await sql<{ device_slug: string }[]>`
    update public.reviews set status = ${status}, reject_note = ${note ?? null}, moderated_at = now()
    where id = ${id} returning device_slug`;
  return r?.device_slug ?? null;
}

export type InquiryStatus = "new" | "forwarded" | "closed";

export interface Inquiry {
  id: string;
  createdAt: string;
  deviceSlug: string;
  configId: string;
  grade: string;
  term: number;
  template: string;
  quantity: number;
  supplierId: string;
  monthlyPerUnit: number;
  contractTotal: number;
  company: string;
  contactName: string;
  email: string;
  phone: string | null;
  prefecture: string | null;
  startMonth: string | null;
  message: string | null;
  status: InquiryStatus;
  adminNote: string | null;
}

export async function listInquiries(sql: Sql, status?: InquiryStatus, limit = 200): Promise<Inquiry[]> {
  const rows = await sql`
    select * from public.inquiries
    ${status ? sql`where status = ${status}` : sql``}
    order by created_at desc limit ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    createdAt: (r.created_at as Date).toISOString(),
    deviceSlug: r.device_slug,
    configId: r.config_id,
    grade: r.grade,
    term: r.term_months,
    template: r.template,
    quantity: r.quantity,
    supplierId: r.supplier_id,
    monthlyPerUnit: r.monthly_per_unit,
    contractTotal: r.contract_total,
    company: r.company,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    prefecture: r.prefecture,
    startMonth: r.start_month,
    message: r.message,
    status: r.status,
    adminNote: r.admin_note,
  }));
}

export async function updateInquiry(sql: Sql, id: string, status: InquiryStatus, note: string | null): Promise<boolean> {
  const r = await sql`update public.inquiries set status = ${status}, admin_note = ${note}, updated_at = now() where id = ${id}`;
  return r.count > 0;
}

export async function adminCounts(sql: Sql) {
  const [r] = await sql<{ pending_reviews: number; new_inquiries: number; inquiries_30d: number; likes_total: number }[]>`
    select
      (select count(*)::int from public.reviews where status = 'pending') as pending_reviews,
      (select count(*)::int from public.inquiries where status = 'new') as new_inquiries,
      (select count(*)::int from public.inquiries where created_at > now() - interval '30 days') as inquiries_30d,
      (select count(*)::int from public.device_likes) as likes_total`;
  return r;
}
