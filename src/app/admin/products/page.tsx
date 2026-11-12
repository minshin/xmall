import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, ImageOff, Plus, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import * as cat from "@/lib/repo-catalog";
import * as admin from "@/lib/repo-admin";
import { STATUS_LABEL, STATUS_TONE } from "../labels";
import { NoDb } from "../NoDb";

export const metadata: Metadata = { title: "製品" };


export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/products">["searchParams"] }) {
  await requireRole("editor", "/admin/products");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const status = (["draft", "published", "archived"] as const).find((s) => s === one("status"));
  const [products, categories] = await Promise.all([
    admin.listProducts(sql, { q: one("q"), category: one("category") || undefined, status }),
    cat.loadCategories(sql),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[32px] font-semibold">製品</h1>
        <Link href="/admin/products/new" className="btn btn-primary !text-sm">
          <Plus size={16} aria-hidden="true" /> 新しい製品
        </Link>
      </div>
      <form className="flex flex-wrap gap-2 items-center">
        <span className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input name="q" defaultValue={one("q")} placeholder="名前・slug・メーカー" className="pl-9 pr-3 py-2 rounded-full bg-white border border-line text-sm w-60" />
        </span>
        <select name="category" defaultValue={one("category")} className="px-3 py-2 rounded-full bg-white border border-line text-sm">
          <option value="">すべての品目</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={one("status")} className="px-3 py-2 rounded-full bg-white border border-line text-sm">
          <option value="">すべての状態</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn bg-ink text-white !py-2 !text-sm">絞り込む</button>
      </form>
      <div className="card overflow-hidden">
        {products.length === 0 && <p className="m-0 p-6 text-sm text-mute">該当する製品はありません</p>}
        <ul className="m-0 p-0 list-none divide-y divide-hair">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 px-4 py-3 text-ink hover:bg-ground hover:no-underline transition-colors">
                <span className="relative w-20 aspect-[16/10] rounded-[8px] overflow-hidden bg-ground shrink-0 flex items-center justify-center">
                  {p.thumb ? <Image src={p.thumb} alt="" fill sizes="80px" className="object-cover" /> : <ImageOff size={18} className="text-faint" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 font-medium truncate">
                    {p.name}
                    {p.subtitle && <span className="text-mute font-normal">{p.subtitle}</span>}
                    {p.verified && <BadgeCheck size={15} className="text-brand shrink-0" aria-label="確認済み" />}
                  </span>
                  <span className="block text-xs text-faint truncate">
                    {p.categoryName}・{p.brandName}・/{p.slug}・構成 {p.variants}・画像 {p.images}
                  </span>
                </span>
                <span className={`text-[11px] rounded-full px-2 py-0.5 shrink-0 ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
