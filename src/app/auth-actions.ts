"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import * as accounts from "@/lib/repo-accounts";
import { supabaseServer } from "@/lib/supabase/server";
import { emailSchema, firstErrors, passwordSchema, profileSchema, safeNext, signInSchema, signUpSchema } from "@/lib/validation";

export type AuthState = { ok: boolean; errors: Record<string, string>; values?: Record<string, string>; message?: string };

/** 確認メール・OAuth の戻り先に使うサイトの URL（リクエストのホストを優先） */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

const AUTH_ERROR: Record<string, string> = {
  invalid_credentials: "メールアドレスまたはパスワードが違います",
  email_not_confirmed: "メールアドレスの確認が済んでいません。届いたメールのリンクを開いてください",
  user_already_exists: "このメールアドレスは登録済みです。ログインしてください",
  weak_password: "パスワードが弱すぎます。別のパスワードにしてください",
  over_email_send_rate_limit: "メールの送信回数が上限に達しました。しばらくしてからお試しください",
  provider_disabled: "このログイン方法は現在利用できません",
  validation_failed: "このログイン方法は現在利用できません",
};
const authMessage = (e: { code?: string; message: string }) => AUTH_ERROR[e.code ?? ""] ?? "処理できませんでした。時間をおいてお試しください";

export async function signInAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const values = { email: String(fd.get("email") ?? "") };
  const parsed = signInSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error), values };
  const { error } = await (await supabaseServer()).auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, errors: { _: authMessage(error) }, values };
  redirect(safeNext(fd.get("next")));
}

export async function signUpAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const values = { email: String(fd.get("email") ?? "") };
  const parsed = signUpSchema.safeParse({ email: fd.get("email"), password: fd.get("password"), agree: fd.get("agree") ?? "" });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error), values };
  const next = safeNext(fd.get("next"));
  const { data, error } = await (await supabaseServer()).auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { ok: false, errors: { _: authMessage(error) }, values };
  // 確認メールが不要な設定ならそのままログイン状態
  if (data.session) redirect(next);
  return { ok: true, errors: {}, values, message: `${parsed.data.email} に確認メールを送りました。メールのリンクを開くと登録が完了します。` };
}

export async function googleSignInAction(fd: FormData): Promise<void> {
  const next = safeNext(fd.get("next"));
  const { data, error } = await (await supabaseServer()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.code ?? "provider_disabled")}&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  await (await supabaseServer()).auth.signOut();
  redirect("/");
}

export async function resetPasswordAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const values = { email: String(fd.get("email") ?? "") };
  const email = emailSchema.safeParse(fd.get("email"));
  if (!email.success) return { ok: false, errors: { email: "メールアドレスの形式が正しくありません" }, values };
  await (await supabaseServer()).auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent("/account/password")}`,
  });
  // 登録の有無は答えない（メールアドレスの存在確認に使われないように）
  return { ok: true, errors: {}, values, message: "登録されているメールアドレスなら、パスワード再設定のメールを送りました。" };
}

export async function updatePasswordAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await currentUser())) redirect("/login?next=/account/password");
  const pw = passwordSchema.safeParse(fd.get("password"));
  if (!pw.success) return { ok: false, errors: { password: pw.error.issues[0].message } };
  if (fd.get("password") !== fd.get("confirm")) return { ok: false, errors: { confirm: "確認用のパスワードが一致しません" } };
  const { error } = await (await supabaseServer()).auth.updateUser({ password: pw.data });
  if (error) return { ok: false, errors: { _: authMessage(error) } };
  return { ok: true, errors: {}, message: "パスワードを変更しました。" };
}

export async function updateProfileAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const raw = Object.fromEntries(["fullName", "companyName", "department", "phone", "companySize"].map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error), values: raw };
  const sql = getSql();
  if (!sql) return { ok: false, errors: { _: "ただいま保存できません" }, values: raw };
  await accounts.updateProfile(sql, user.id, parsed.data);
  return { ok: true, errors: {}, values: raw, message: "保存しました。" };
}
