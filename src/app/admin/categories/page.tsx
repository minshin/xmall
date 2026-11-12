import type { Metadata } from "next";
import { Suspense } from "react";
import { Trash2 } from "lucide-react";
import { Icon, ICON_NAMES } from "@/components/icons";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { hasRole } from "@/lib/repo-accounts";
import * as cat from "@/lib/repo-catalog";
import * as admin from "@/lib/repo-admin";
import type { SpecAttribute } from "@/lib/types";
import { deleteAttributeAction, deleteCategoryAction, saveAttributeAction, saveCategoryAction } from "../catalog-actions";
import { NoDb } from "../NoDb";
import { ActionForm, ConfirmButton, input } from "../ui";

export const metadata: Metadata = { title: "品目・スペック" };

const TYPE_LABEL = { text: "文字", number: "数値", boolean: "あり／なし", enum: "選択肢" } as const;

export default function CategoriesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body />
    </Suspense>
  );
}

function IconSelect({ name, value }: { name: string; value: string | null }) {
  return (
    <select name={name} defaultValue={value ?? ""} className={input}>
      <option value="">（なし）</option>
      {ICON_NAMES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function AttributeForm({ categoryId, a, canDelete, usage }: { categoryId: string; a?: SpecAttribute; canDelete: boolean; usage: number }) {
  return (
    <div className="flex gap-2 items-start">
      <ActionForm action={saveAttributeAction} submit={a ? "保存" : "追加"} className="flex-1 grid gap-2 grid-cols-2 md:grid-cols-4 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] items-end">
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="attrId" value={a?.id ?? ""} />
        <label className="flex flex-col gap-1 text-[11px] text-mute">
          key
          <input name="key" defaultValue={a?.key} readOnly={!!a} placeholder="例：refresh_hz" className={`${input} ${a ? "bg-ground text-mute" : ""}`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-mute">
          表示名
          <input name="label" defaultValue={a?.label} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-mute">
          単位
          <input name="unit" defaultValue={a?.unit ?? ""} placeholder="GB, kg…" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-mute">
          型
          <select name="type" defaultValue={a?.type ?? "text"} className={input}>
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-mute">
          単位ごと
          <select name="scope" defaultValue={a?.scope ?? "product"} className={input}>
            <option value="product">機種で1つ</option>
            <option value="variant">構成ごと</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-mute col-span-2">
          選択肢（「選択肢」型のとき。カンマ区切り）
          <input name="options" defaultValue={a?.options.join(", ")} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-mute">
          アイコン
          <IconSelect name="icon" value={a?.icon ?? null} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-mute">
          並び順
          <input name="sort" type="number" defaultValue={a?.sort ?? 100} className={input} />
        </label>
        <div className="flex gap-3 text-xs col-span-2 pb-2">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" name="filterable" defaultChecked={a?.filterable} className="accent-[#0071e3]" /> 絞り込み
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" name="highlight" defaultChecked={a?.highlight} className="accent-[#0071e3]" /> 一覧に表示
          </label>
        </div>
      </ActionForm>
      {a && canDelete && (
        <form action={deleteAttributeAction} className="pt-5">
          <input type="hidden" name="attrId" value={a.id} />
          <ConfirmButton
            message={`「${a.label}」を削除します。${usage ? `${usage} 件の製品の値も消えます。` : ""}`}
            className="p-2 rounded-md text-faint hover:text-[#d70015] hover:bg-ground cursor-pointer"
          >
            <Trash2 size={16} aria-label="削除" />
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}

async function Body() {
  const me = await requireRole("editor", "/admin/categories");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const [categories, usage] = await Promise.all([cat.loadCategories(sql), admin.attributeUsage(sql)]);
  const isAdmin = hasRole(me, "admin");

  return (
    <>
      <div>
        <h1 className="m-0 text-[32px] font-semibold">品目・スペック</h1>
        <p className="m-0 mt-1 text-sm text-mute">品目ごとに、製品ページのスペック表・一覧の絞り込み・カードに出す項目を決めます。</p>
      </div>
      {categories.map((c) => (
        <details key={c.id} className="card group" open={c.id === categories[0]?.id}>
          <summary className="flex items-center gap-3 p-5">
            <Icon name={c.icon} size={24} strokeWidth={1.4} className="text-mute" />
            <span className="text-[19px] font-semibold">{c.name}</span>
            <span className="text-sm text-faint">
              {c.id}・{c.attributes.length} 項目
            </span>
          </summary>
          <div className="px-5 pb-5 flex flex-col gap-5">
            <div className="flex gap-2 items-start">
              <ActionForm action={saveCategoryAction} className="flex-1 grid gap-2 grid-cols-2 md:grid-cols-[1fr_1fr_120px_auto] items-end">
                <input type="hidden" name="id" value={c.id} />
                <label className="flex flex-col gap-1 text-[11px] text-mute">
                  名前
                  <input name="name" defaultValue={c.name} className={input} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-mute">
                  アイコン
                  <IconSelect name="icon" value={c.icon} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-mute">
                  並び順
                  <input name="sort" type="number" defaultValue={c.sort} className={input} />
                </label>
              </ActionForm>
              {isAdmin && (
                <form action={deleteCategoryAction} className="pt-5">
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton message={`品目「${c.name}」を削除します（製品がある品目は削除できません）`} className="p-2 rounded-md text-faint hover:text-[#d70015] hover:bg-ground cursor-pointer">
                    <Trash2 size={16} aria-label="品目を削除" />
                  </ConfirmButton>
                </form>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <p className="m-0 text-sm font-medium">スペック項目</p>
              {c.attributes.map((a) => (
                <div key={a.id} className="bg-ground rounded-[14px] p-3">
                  <AttributeForm categoryId={c.id} a={a} canDelete={isAdmin} usage={usage[a.id] ?? 0} />
                </div>
              ))}
              <div className="border-2 border-dashed border-line rounded-[14px] p-3">
                <p className="m-0 mb-2 text-xs text-mute">項目を追加</p>
                <AttributeForm categoryId={c.id} canDelete={false} usage={0} />
              </div>
            </div>
          </div>
        </details>
      ))}
      <section className="card p-5 flex flex-col gap-3">
        <h2 className="m-0 text-[17px] font-semibold">品目を追加</h2>
        <ActionForm action={saveCategoryAction} submit="追加" className="grid gap-2 grid-cols-2 md:grid-cols-[1fr_1fr_1fr_100px_auto] items-end">
          <label className="flex flex-col gap-1 text-[11px] text-mute">
            id（英小文字）
            <input name="id" placeholder="例：desktop" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-mute">
            名前
            <input name="name" placeholder="例：デスクトップPC" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-mute">
            アイコン
            <IconSelect name="icon" value={null} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-mute">
            並び順
            <input name="sort" type="number" defaultValue={10} className={input} />
          </label>
        </ActionForm>
      </section>
    </>
  );
}
