import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { PasswordForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "パスワードの変更", robots: { index: false } };

export default function PasswordPage() {
  return (
    <AuthCard title="パスワードの変更">
      <PasswordForm />
    </AuthCard>
  );
}
