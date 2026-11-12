import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { currentProfile } from "@/lib/auth";

/** ヘッダー右端：未ログインは「ログイン」、ログイン中は頭文字の丸（アカウントへ）。Cookie を読むので Suspense の中で使う */
export async function UserMenu() {
  const p = await currentProfile();
  if (!p)
    return (
      <Link href="/login" className="inline-flex items-center gap-1.5 text-[12px] text-sub hover:text-ink hover:no-underline">
        <CircleUserRound size={18} strokeWidth={1.6} aria-hidden="true" />
        ログイン
      </Link>
    );
  const initial = (p.companyName ?? p.fullName ?? p.email).trim().slice(0, 1).toUpperCase();
  return (
    <Link href="/account" aria-label="アカウント" title={p.email} className="size-7 rounded-full bg-ink text-white text-[12px] font-semibold flex items-center justify-center hover:no-underline hover:opacity-80 transition-opacity">
      {initial}
    </Link>
  );
}

export function UserMenuPlaceholder() {
  return <CircleUserRound size={18} strokeWidth={1.6} className="text-faint" aria-hidden="true" />;
}
