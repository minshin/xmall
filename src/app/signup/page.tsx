import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/AuthCard";
import { SignupForm } from "@/components/AuthForms";
import { enabledProviders } from "@/lib/auth-settings";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "アカウント作成", robots: { index: false } };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthCard title="アカウント作成" lead="無料。会社情報はあとから登録できます。">
      <Suspense fallback={<div className="h-80" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const { google } = await enabledProviders();
  return <SignupForm next={safeNext(next)} google={google} />;
}
