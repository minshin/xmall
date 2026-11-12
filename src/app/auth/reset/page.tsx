import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { ResetForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "パスワードの再設定", robots: { index: false } };

export default function ResetPage() {
  return (
    <AuthCard title="パスワードの再設定" lead="登録したメールアドレスに、再設定用のリンクを送ります。">
      <ResetForm />
    </AuthCard>
  );
}
