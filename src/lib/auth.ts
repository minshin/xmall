import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getSql } from "./db";
import * as accounts from "./repo-accounts";
import { hasRole, type Profile, type Role } from "./repo-accounts";
import { authConfigured, supabaseServer } from "./supabase/server";

/**
 * ログイン中の会員。Cookie を読むので、cacheComponents では <Suspense> の中か Server Action から呼ぶ。
 * getUser() は Auth サーバーでトークンを検証する（Cookie の中身だけを信用しない）。
 */
export async function currentUser(): Promise<{ id: string; email: string } | null> {
  // リクエストごとの値（Cookie・トークンの有効期限＝現在時刻）を使うので、事前レンダリングの対象外にする
  await connection();
  if (!authConfigured()) return null;
  try {
    const { data } = await (await supabaseServer()).auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
  } catch {
    return null;
  }
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}

export async function currentProfile(): Promise<Profile | null> {
  const user = await currentUser();
  const sql = getSql();
  if (!user || !sql) return null;
  return accounts.getProfile(sql, user.id);
}

/** 管理画面・管理用 Action の入口。未ログインはログイン画面へ、権限不足は 404（管理画面の存在を見せない） */
export async function requireRole(min: Role, next = "/admin"): Promise<Profile> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const sql = getSql();
  const profile = sql ? await accounts.getProfile(sql, user.id) : null;
  if (!profile || !hasRole(profile, min)) notFound();
  return profile;
}

export { hasRole };
