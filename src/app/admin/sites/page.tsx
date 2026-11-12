import type { Metadata } from "next";
import { Suspense } from "react";
import { Trash2 } from "lucide-react";
import { SiteIcon } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { hasRole } from "@/lib/repo-accounts";
import * as cat from "@/lib/repo-catalog";
import type { Site } from "@/lib/repo-catalog";
import { deleteSiteAction, saveSiteAction } from "../catalog-actions";
import { SITE_KIND_LABEL } from "../labels";
import { NoDb } from "../NoDb";
import { ActionForm, ConfirmButton, input } from "../ui";

export const metadata: Metadata = { title: "サイト・favicon" };

export default function SitesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body />
    </Suspense>
  );
}

function SiteForm({ s, isNew }: { s?: Site; isNew?: boolean }) {
  return (
    <ActionForm action={saveSiteAction} submit={isNew ? "追加" : "保存"} className="flex-1 grid gap-2 grid-cols-2 md:grid-cols-[48px_120px_1fr_120px_1.4fr_70px] lg:grid-cols-[48px_120px_1fr_120px_1.4fr_70px_1fr_auto] items-end">
      <span className="pb-1.5">
        <SiteIcon src={s?.faviconUrl} name={s?.name ?? "+"} size={32} />
      </span>
      <label className="flex flex-col gap-1 text-[11px] text-mute">
        id
        <input name="id" defaultValue={s?.id} readOnly={!isNew} placeholder="例：yamada" className={`${input} ${isNew ? "" : "bg-ground text-mute"}`} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-mute">
        名前
        <input name="name" defaultValue={s?.name} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-mute">
        種類
        <select name="kind" defaultValue={s?.kind ?? "shop"} className={input}>
          {Object.entries(SITE_KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-mute">
        URL
        <input name="url" type="url" defaultValue={s?.url ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-mute">
        順
        <input name="sort" type="number" defaultValue={s?.sort ?? 0} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-mute col-span-2 md:col-span-3 lg:col-span-1">
        favicon を差し替え
        <input name="favicon" type="file" accept="image/png,image/x-icon,image/svg+xml,image/webp,image/jpeg,.ico" className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-ground file:px-3 file:py-1.5 file:text-xs" />
      </label>
    </ActionForm>
  );
}

async function Body() {
  const me = await requireRole("editor", "/admin/sites");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const sites = await cat.loadSites(sql);
  const isAdmin = hasRole(me, "admin");
  const groups = (Object.keys(SITE_KIND_LABEL) as Site["kind"][]).map((k) => [k, sites.filter((s) => s.kind === k)] as const);

  return (
    <>
      <div>
        <h1 className="m-0 text-[32px] font-semibold">サイト・favicon</h1>
        <p className="m-0 mt-1 text-sm text-mute">メーカー・購入先・レンタル会社。価格欄のアイコンに使います。id は購入先の shopId・レンタル会社の id と同じにしてください。</p>
      </div>
      {groups.map(([k, list]) =>
        list.length ? (
          <section key={k} className="card p-5 flex flex-col gap-3">
            <h2 className="m-0 text-[17px] font-semibold">
              {SITE_KIND_LABEL[k]} <span className="text-sm font-normal text-faint">{list.length}</span>
            </h2>
            {list.map((s) => (
              <div key={s.id} className="flex gap-2 items-start bg-ground rounded-[14px] p-3">
                <SiteForm s={s} />
                {isAdmin && (
                  <form action={deleteSiteAction} className="pt-5">
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message={`「${s.name}」を削除します（製品のメーカーとして使われている場合は削除できません）`} className="p-2 rounded-md text-faint hover:text-[#d70015] hover:bg-white cursor-pointer">
                      <Trash2 size={16} aria-label="削除" />
                    </ConfirmButton>
                  </form>
                )}
              </div>
            ))}
          </section>
        ) : null,
      )}
      <section className="card p-5 flex flex-col gap-3">
        <h2 className="m-0 text-[17px] font-semibold">サイトを追加</h2>
        <div className="border-2 border-dashed border-line rounded-[14px] p-3">
          <SiteForm isNew />
        </div>
      </section>
    </>
  );
}
