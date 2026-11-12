"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDevice } from "@/lib/catalog-server";
import { currentUserId } from "@/lib/auth";
import { ensureVisitorId, TAG } from "@/lib/community";
import { getSql } from "@/lib/db";
import * as repo from "@/lib/repo";
import { consultSchema, contactSchema, firstErrors, HONEYPOT, reviewSchema } from "@/lib/validation";

export type FormState = { ok: boolean; errors: Record<string, string>; values?: Record<string, string> };

const DB_DOWN: FormState = { ok: false, errors: { _: "ただいま送信できません。時間をおいてもう一度お試しください。" } };
const LIMIT = { reviews: 3, inquiries: 10 };

const valuesOf = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;

// ───────── いいね ─────────

export async function toggleLikeAction(slug: string): Promise<{ liked: boolean; likes: number } | null> {
  const sql = getSql();
  if (!sql || !(await getDevice(slug))) return null;
  const vid = await ensureVisitorId();
  const r = await repo.toggleLike(sql, slug, vid, await currentUserId());
  updateTag(TAG.stats);
  return r;
}

// ───────── 閲覧者数 ─────────

/** 機種ページを開いたときに 1 回呼ぶ。キャッシュは更新しない（数は返り値で本人に見せる） */
export async function recordViewAction(slug: string): Promise<number | null> {
  const sql = getSql();
  if (!sql || !(await getDevice(slug))) return null;
  const vid = await ensureVisitorId();
  return repo.recordView(sql, slug, vid, await currentUserId());
}

// ───────── 参考になった ─────────

export async function toggleHelpfulAction(reviewId: string): Promise<{ helped: boolean; helpful: number } | null> {
  const sql = getSql();
  if (!sql || !/^[0-9a-f-]{36}$/i.test(reviewId)) return null;
  const vid = await ensureVisitorId();
  const r = await repo.toggleHelpful(sql, reviewId, vid);
  if (!r) return null;
  updateTag(TAG.reviews(r.deviceSlug));
  return { helped: r.helped, helpful: r.helpful };
}

// ───────── 口コミ投稿（審査後に公開） ─────────

export async function submitReviewAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = valuesOf(fd);
  if (fd.get(HONEYPOT)) return { ok: true, errors: {} }; // bot には成功に見せる
  const parsed = reviewSchema.safeParse({
    deviceSlug: fd.get("deviceSlug"),
    rating: fd.get("rating") ?? "",
    author: fd.get("author") ?? "",
    use: fd.get("use") ?? "",
    acquisition: fd.get("acquisition") ?? "",
    via: fd.get("via") ?? "",
    body: fd.get("body") ?? "",
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error), values };
  if (!(await getDevice(parsed.data.deviceSlug))) return { ok: false, errors: { deviceSlug: "機種が見つかりません" }, values };

  const sql = getSql();
  if (!sql) return { ...DB_DOWN, values };
  const vid = await ensureVisitorId();
  if ((await repo.recentCount(sql, "reviews", vid)) >= LIMIT.reviews)
    return { ok: false, errors: { _: "口コミの投稿は1日3件までです。" }, values };
  await repo.insertReview(sql, parsed.data, vid, await currentUserId());
  return { ok: true, errors: {} };
}

// ───────── レンタルの相談（金額は持たない） ─────────

export async function submitInquiryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = valuesOf(fd);
  if (fd.get(HONEYPOT)) redirect("/inquiry/thanks");

  const q = consultSchema.safeParse({
    deviceSlug: fd.get("deviceSlug"),
    configId: fd.get("configId"),
    months: fd.get("months"),
    quantity: fd.get("quantity"),
  });
  if (!q.success) return { ok: false, errors: firstErrors(q.error), values };
  const device = await getDevice(q.data.deviceSlug);
  if (!device) return { ok: false, errors: { _: "機種が見つかりません。機種ページからやり直してください。" }, values };
  if (q.data.configId && !device.configs.some((x) => x.id === q.data.configId)) q.data.configId = null;

  const c = contactSchema.safeParse({
    company: fd.get("company") ?? "",
    contactName: fd.get("contactName") ?? "",
    email: fd.get("email") ?? "",
    phone: fd.get("phone") ?? "",
    prefecture: fd.get("prefecture") ?? "",
    startMonth: fd.get("startMonth") ?? "",
    message: fd.get("message") ?? "",
    agree: fd.get("agree") ?? "",
  });
  if (!c.success) return { ok: false, errors: firstErrors(c.error), values };

  const sql = getSql();
  if (!sql) return { ...DB_DOWN, values };
  const vid = await ensureVisitorId();
  if ((await repo.recentCount(sql, "inquiries", vid)) >= LIMIT.inquiries)
    return { ok: false, errors: { _: "本日の問い合わせ数の上限に達しました。お急ぎの場合はお電話ください。" }, values };

  await repo.insertInquiry(sql, q.data, c.data, vid, await currentUserId());
  // TODO: 運営への通知メール
  redirect(`/inquiry/thanks?device=${encodeURIComponent(device.slug)}`);
}
