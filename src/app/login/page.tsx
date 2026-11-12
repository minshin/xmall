import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "@/components/AuthForms";
import { enabledProviders } from "@/lib/auth-settings";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "ログイン", robots: { index: false } };

const ERRORS: Record<string, string> = {
  link_invalid: "リンクの有効期限が切れているか、すでに使われています。もう一度お試しください。",
  otp_expired: "リンクの有効期限が切れています。もう一度お試しください。",
  provider_disabled: "このログイン方法は現在利用できません。",
  validation_failed: "このログイン方法は現在利用できません。",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard title="ログイン" lead="お気に入りと見積の履歴を、どこからでも。">
      <Suspense fallback={<div className="h-72" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const { google } = await enabledProviders();
  const err = one("error");
  return <LoginForm next={safeNext(one("next"))} google={google} error={err ? (ERRORS[err] ?? ERRORS.link_invalid) : undefined} />;
}
