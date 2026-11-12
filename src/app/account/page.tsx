import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Clock, Heart, KeyRound, LogOut, Settings2 } from "lucide-react";
import { signOutAction } from "@/app/auth-actions";
import { ProfileForm } from "@/components/AuthForms";
import { DeviceThumb } from "@/components/ui";
import { currentProfile, hasRole } from "@/lib/auth";
import { getDevices } from "@/lib/catalog-server";
import { getSql } from "@/lib/db";
import * as accounts from "@/lib/repo-accounts";
import type { Device } from "@/lib/types";

export const metadata: Metadata = { title: "アカウント", robots: { index: false } };

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-[1080px] px-4 sm:px-6 py-10 flex flex-col gap-8">
      <Suspense fallback={<div className="h-96" />}>
        <Body />
      </Suspense>
    </main>
  );
}

async function Body() {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/account");
  const sql = getSql();
  const [activity, devices] = await Promise.all([sql ? accounts.userActivity(sql, profile.id) : null, getDevices()]);
  if (sql) await accounts.touchLastSeen(sql, profile.id);
  const bySlug = new Map(devices.map((d) => [d.slug, d]));
  const liked = (activity?.likes ?? []).flatMap((l) => (bySlug.get(l.deviceSlug) ? [bySlug.get(l.deviceSlug)!] : []));
  const viewed = (activity?.views ?? []).flatMap((v) => (bySlug.get(v.deviceSlug) ? [bySlug.get(v.deviceSlug)!] : [])).slice(0, 8);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[40px] font-semibold leading-tight">{profile.companyName ?? "アカウント"}</h1>
          <p className="m-0 mt-1 text-[17px] text-mute">{profile.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasRole(profile, "editor") && (
            <Link href="/admin" className="btn bg-ink text-white hover:text-white !text-sm">
              <Settings2 size={15} aria-hidden="true" /> 管理画面
            </Link>
          )}
          <Link href="/account/password" className="btn bg-white text-ink !text-sm">
            <KeyRound size={15} aria-hidden="true" /> パスワード
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="btn bg-white text-ink !text-sm">
              <LogOut size={15} aria-hidden="true" /> ログアウト
            </button>
          </form>
        </div>
      </div>

      <DeviceStrip title="お気に入り" icon={<Heart size={18} className="text-heart" fill="currentColor" />} devices={liked} empty="機種ページの ♡ で追加できます" />
      <DeviceStrip title="最近見た製品" icon={<Clock size={18} className="text-mute" />} devices={viewed} empty="まだありません" />

      <section aria-labelledby="profile-h" className="card p-6 sm:p-8 flex flex-col gap-5">
        <div>
          <h2 id="profile-h" className="m-0 text-[24px] font-semibold">
            会社情報
          </h2>
          <p className="m-0 mt-1 text-sm text-mute">見積の問い合わせに自動で入ります。</p>
        </div>
        <ProfileForm profile={profile} />
      </section>
    </>
  );
}

function DeviceStrip({ title, icon, devices, empty }: { title: string; icon: React.ReactNode; devices: Device[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[21px] font-semibold inline-flex items-center gap-2">
        {icon}
        {title}
        {devices.length > 0 && <span className="text-sm font-normal text-faint">{devices.length}</span>}
      </h2>
      {devices.length ? (
        <div className="flex gap-3 overflow-x-auto snap-x-strip pb-1">
          {devices.map((d) => (
            <Link key={d.slug} href={`/pc/${d.slug}`} className="card lift shrink-0 w-56 overflow-hidden text-ink hover:no-underline">
              <div className="aspect-[16/10] bg-white overflow-hidden">
                <DeviceThumb device={d} sizes="224px" />
              </div>
              <p className="m-0 px-4 py-3 text-sm font-medium truncate">{d.name}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm text-faint">{empty}</p>
      )}
    </section>
  );
}
