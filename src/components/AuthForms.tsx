"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import {
  googleSignInAction, resetPasswordAction, signInAction, signUpAction, updatePasswordAction, updateProfileAction, type AuthState,
} from "@/app/auth-actions";
import type { Profile } from "@/lib/repo-accounts";

const INIT: AuthState = { ok: false, errors: {} };
export const field =
  "w-full border border-line rounded-[12px] px-4 py-3 text-[17px] bg-white focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition";
const Err = ({ msg }: { msg?: string }) => (msg ? <span className="text-[13px] text-[#d70015] animate-fade">{msg}</span> : null);

function Password({ name = "password", autoComplete, placeholder = "パスワード" }: { name?: string; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} className={`${field} pr-12`} />
      <button
        type="button"
        aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-sub cursor-pointer p-1"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}

function GoogleButton({ next }: { next: string }) {
  return (
    <form action={googleSignInAction}>
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="btn w-full bg-white border border-line text-ink hover:bg-ground !py-3">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Google で続ける
      </button>
    </form>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-faint">
      <span className="h-px flex-1 bg-line" />
      または
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function LoginForm({ next, google, error }: { next: string; google: boolean; error?: string }) {
  const [state, action, pending] = useActionState(signInAction, INIT);
  return (
    <div className="flex flex-col gap-5">
      {error && <p className="m-0 text-sm text-[#d70015] bg-[#fff1f0] rounded-[12px] px-4 py-3">{error}</p>}
      {google && (
        <>
          <GoogleButton next={next} />
          <Divider />
        </>
      )}
      <form action={action} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <input name="email" type="email" autoComplete="email" placeholder="メールアドレス" defaultValue={state.values?.email} className={field} />
        <Err msg={state.errors.email} />
        <Password autoComplete="current-password" />
        <Err msg={state.errors.password ?? state.errors._} />
        <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3 mt-1 disabled:opacity-60">
          {pending ? "ログイン中…" : "ログイン"}
        </button>
      </form>
      <p className="m-0 flex justify-between text-sm">
        <Link href="/auth/reset">パスワードを忘れた</Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`}>アカウントを作成</Link>
      </p>
    </div>
  );
}

function Sent({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4 animate-rise">
      <span className="size-14 rounded-full bg-brand-soft text-brand flex items-center justify-center">
        <Mail size={26} />
      </span>
      <p className="m-0 text-[15px] leading-relaxed">{message}</p>
    </div>
  );
}

export function SignupForm({ next, google }: { next: string; google: boolean }) {
  const [state, action, pending] = useActionState(signUpAction, INIT);
  if (state.ok && state.message) return <Sent message={state.message} />;
  return (
    <div className="flex flex-col gap-5">
      {google && (
        <>
          <GoogleButton next={next} />
          <Divider />
        </>
      )}
      <form action={action} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <input name="email" type="email" autoComplete="email" placeholder="メールアドレス（会社のアドレス推奨）" defaultValue={state.values?.email} className={field} />
        <Err msg={state.errors.email} />
        <Password autoComplete="new-password" placeholder="パスワード（8文字以上）" />
        <Err msg={state.errors.password} />
        <label className="flex items-start gap-2.5 text-sm text-sub mt-1">
          <input type="checkbox" name="agree" className="mt-0.5 size-4 accent-[#0071e3]" />
          <span>
            <Link href="/privacy" target="_blank">
              個人情報の取り扱い
            </Link>
            に同意する
          </span>
        </label>
        <Err msg={state.errors.agree ?? state.errors._} />
        <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3 mt-1 disabled:opacity-60">
          {pending ? "送信中…" : "アカウントを作成"}
        </button>
      </form>
      <p className="m-0 text-sm text-center text-mute">
        アカウントをお持ちの方は <Link href={`/login?next=${encodeURIComponent(next)}`}>ログイン</Link>
      </p>
    </div>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, INIT);
  if (state.ok && state.message) return <Sent message={state.message} />;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input name="email" type="email" autoComplete="email" placeholder="メールアドレス" defaultValue={state.values?.email} className={field} />
      <Err msg={state.errors.email} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3 disabled:opacity-60">
        再設定メールを送る
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, INIT);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Password autoComplete="new-password" placeholder="新しいパスワード（8文字以上）" />
      <Err msg={state.errors.password} />
      <Password name="confirm" autoComplete="new-password" placeholder="もう一度" />
      <Err msg={state.errors.confirm ?? state.errors._} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3 disabled:opacity-60">
        変更する
      </button>
      {state.ok && (
        <p className="m-0 inline-flex items-center gap-1.5 text-sm text-ok animate-fade">
          <CheckCircle2 size={16} /> {state.message}
        </p>
      )}
    </form>
  );
}

const SIZES: [string, string][] = [
  ["", "選択しない"],
  ["1-9", "1〜9名"],
  ["10-49", "10〜49名"],
  ["50-299", "50〜299名"],
  ["300-999", "300〜999名"],
  ["1000+", "1000名以上"],
];

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfileAction, INIT);
  const v = (k: string, fallback: string | null) => state.values?.[k] ?? fallback ?? "";
  const row = (name: string, label: string, def: string | null, autoComplete: string, type = "text") => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-mute">{label}</span>
      <input name={name} type={type} autoComplete={autoComplete} defaultValue={v(name, def)} className={field} />
      <Err msg={state.errors[name]} />
    </label>
  );
  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
      {row("companyName", "会社名", profile.companyName, "organization")}
      {row("department", "部署", profile.department, "organization-title")}
      {row("fullName", "お名前", profile.fullName, "name")}
      {row("phone", "電話番号", profile.phone, "tel", "tel")}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-mute">従業員数</span>
        <select name="companySize" defaultValue={v("companySize", profile.companySize)} className={field}>
          {SIZES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2 flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "保存中…" : "保存"}
        </button>
        {state.ok && (
          <span className="inline-flex items-center gap-1.5 text-sm text-ok animate-fade">
            <CheckCircle2 size={16} /> {state.message}
          </span>
        )}
        <Err msg={state.errors._} />
      </div>
    </form>
  );
}
