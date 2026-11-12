import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { getSql } from "./db";
import * as repo from "./repo";
import type { DeviceStats, Review } from "./types";

/**
 * 画面から使う読み取り（キャッシュ付き）と訪問者 ID。
 * 書き込み後は actions.ts で updateTag して、書いた本人にはすぐ反映させる。
 */

export const TAG = {
  stats: "stats",
  reviews: (slug: string) => `reviews:${slug}`,
};

const EMPTY_STATS: DeviceStats = { likes: 0, reviewCount: 0, rating: null };

async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[db]", e instanceof Error ? e.message : e);
    return fallback;
  }
}

export async function getAllStats(): Promise<Record<string, DeviceStats>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAG.stats);
  const sql = getSql();
  if (!sql) return {};
  return safe({}, () => repo.deviceStats(sql));
}

export async function getStats(slug: string): Promise<DeviceStats> {
  return (await getAllStats())[slug] ?? EMPTY_STATS;
}

export async function getReviews(slug: string): Promise<Review[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAG.reviews(slug));
  const sql = getSql();
  if (!sql) return [];
  return safe([], () => repo.approvedReviews(sql, slug));
}

// ───────── 訪問者 ID（匿名・ログイン不要） ─────────

export const VISITOR_COOKIE = "xm_vid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 読み取り用：Cookie があれば返す（無ければ null。ここでは発行しない） */
export async function readVisitorId(): Promise<string | null> {
  const v = (await cookies()).get(VISITOR_COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

/** 書き込み用（Server Action 内）：無ければ発行して Cookie に保存 */
export async function ensureVisitorId(): Promise<string> {
  const existing = await readVisitorId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  (await cookies()).set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return id;
}

/** この訪問者がいいね済みか・参考になったを押した口コミ（リクエストごと、キャッシュしない） */
export async function viewerState(slug: string): Promise<{ liked: boolean; helped: string[] }> {
  const vid = await readVisitorId();
  const sql = getSql();
  if (!vid || !sql) return { liked: false, helped: [] };
  return safe({ liked: false, helped: [] }, async () => ({
    liked: await repo.hasLiked(sql, slug, vid),
    helped: await repo.helpedReviewIds(sql, slug, vid),
  }));
}
