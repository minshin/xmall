import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import * as cat from "@/lib/repo-catalog";
import { createProductAction } from "../../catalog-actions";
import { NoDb } from "../../NoDb";
import { ActionForm, input } from "../../ui";

export const metadata: Metadata = { title: "新しい製品" };

export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  await requireRole("editor", "/admin/products/new");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const [categories, sites] = await Promise.all([cat.loadCategories(sql), cat.loadSites(sql)]);
  return (
    <>
      <h1 className="m-0 text-[32px] font-semibold">新しい製品</h1>
      <div className="card p-6 max-w-[560px]">
        <ActionForm action={createProductAction} submit="作成して編集へ">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mute">品目</span>
            <select name="categoryId" className={input} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mute">メーカー（サイト・favicon で追加できます）</span>
            <select name="brandId" className={input} required>
              {sites
                .filter((s) => s.kind === "maker")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mute">名前</span>
            <input name="name" placeholder="例：MacBook Air 13インチ" className={input} required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mute">slug（URL：/pc/〇〇。英小文字・数字・ハイフン）</span>
            <input name="slug" placeholder="例：macbook-air-13-m4" className={input} required pattern="[a-z0-9-]+" />
          </label>
        </ActionForm>
      </div>
    </>
  );
}
