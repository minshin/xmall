import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Trash2, Unlink } from "lucide-react";
import { Icon } from "@/components/icons";
import { SUPPLIERS } from "@/data/master";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { USE_LABEL } from "@/lib/labels";
import { hasRole } from "@/lib/repo-accounts";
import * as cat from "@/lib/repo-catalog";
import * as admin from "@/lib/repo-admin";
import { UUID } from "@/lib/validation-admin";
import {
  deleteProductAction, productImageAction, saveContentAction, saveProductBaseAction, saveSpecsAction, saveVariantsAction, uploadProductImagesAction,
} from "../../catalog-actions";
import { STATUS_LABEL, STATUS_TONE } from "../../labels";
import { NoDb } from "../../NoDb";
import { ActionForm, ConfirmButton, ImageUpload, input, RowsEditor, VariantsEditor } from "../../ui";

export const metadata: Metadata = { title: "製品の編集" };

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body params={params} />
    </Suspense>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="card p-5 sm:p-6 flex flex-col gap-4 scroll-mt-20">
      <div>
        <h2 id={`${id}-h`} className="m-0 text-[19px] font-semibold">
          {title}
        </h2>
        {lead && <p className="m-0 mt-0.5 text-[13px] text-mute">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

const Label = ({ text, children, className = "" }: { text: string; children: React.ReactNode; className?: string }) => (
  <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
    <span className="text-[13px] text-mute">{text}</span>
    {children}
  </label>
);

async function Body({ params }: { params: PageProps<"/admin/products/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireRole("editor", `/admin/products/${id}`);
  if (!UUID.test(id)) notFound();
  const sql = getSql();
  if (!sql) return <NoDb />;
  const [[p], categories, sites, images, specRows] = await Promise.all([
    cat.loadProducts(sql, { id, statuses: ["draft", "published", "archived"] }),
    cat.loadCategories(sql),
    cat.loadSites(sql),
    admin.listMedia(sql, { productId: id }),
    sql<{ attribute_id: string; value: unknown; display: string | null; plain: string | null }[]>`
      select attribute_id, value, display, plain from public.product_specs where product_id = ${id}`,
  ]);
  if (!p) notFound();
  const category = categories.find((c) => c.id === p.categoryId)!;
  const productAttrs = category.attributes.filter((a) => a.scope === "product");
  const variantAttrs = category.attributes.filter((a) => a.scope === "variant");
  const specOf = new Map(specRows.map((r) => [r.attribute_id, r]));
  const c = p.content;
  const sections = [
    ["base", "基本情報"],
    ["images", `画像（${images.length}）`],
    ["specs", "スペック"],
    ["variants", `構成（${p.configs.length}）`],
    ["content", "解説"],
  ];

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-mute">
          <ArrowLeft size={15} aria-hidden="true" /> 製品
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-[28px] font-semibold">{p.name}</h1>
          <span className={`text-xs rounded-full px-2.5 py-0.5 ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
          {p.status === "published" && (
            <a href={`/pc/${p.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm ml-auto">
              サイトで見る <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
        <nav className="flex flex-wrap gap-1.5 text-[13px]">
          {sections.map(([k, l]) => (
            <a key={k} href={`#${k}`} className="bg-white rounded-full px-3 py-1 text-sub hover:no-underline hover:text-ink">
              {l}
            </a>
          ))}
        </nav>
      </div>

      <Section id="base" title="基本情報">
        <ActionForm action={saveProductBaseAction}>
          <input type="hidden" name="id" value={p.id} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Label text="名前">
              <input name="name" defaultValue={p.name} className={input} required />
            </Label>
            <Label text="型・世代（名前の下に表示。例：M5）">
              <input name="subtitle" defaultValue={p.subtitle} className={input} />
            </Label>
            <Label text="slug（URL）">
              <input name="slug" defaultValue={p.slug} className={input} pattern="[a-z0-9-]+" required />
            </Label>
            <Label text="品目（変えるとスペック項目が入れ替わります）">
              <select name="categoryId" defaultValue={p.categoryId} className={input}>
                {categories.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="メーカー">
              <select name="brandId" defaultValue={p.brandId} className={input}>
                {sites
                  .filter((s) => s.kind === "maker")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Label>
            <Label text="発売日">
              <input name="releaseDate" type="date" defaultValue={p.releaseDate ?? ""} className={input} />
            </Label>
            <Label text="状態">
              <select name="status" defaultValue={p.status} className={input}>
                {Object.entries(STATUS_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="本体色（画像がないときのイラスト）">
              <input name="bodyColor" type="color" defaultValue={p.bodyColor} className="h-10 w-20 rounded-[10px] border border-line bg-white cursor-pointer" />
            </Label>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" name="verified" defaultChecked={p.verified} className="size-4 accent-[#0071e3]" />
              仕様・価格を出典で確認済み
            </label>
          </div>
          <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
            <legend className="text-[13px] text-mute mb-1.5">用途</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(USE_LABEL).map(([k, l]) => (
                <label key={k} className="inline-flex items-center gap-1.5 text-sm bg-ground rounded-full px-3 py-1.5 cursor-pointer has-[:checked]:bg-brand-soft has-[:checked]:text-brand">
                  <input type="checkbox" name="uses" value={k} defaultChecked={p.uses.includes(k as never)} className="sr-only" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
            <legend className="text-[13px] text-mute mb-1.5">見積を出すレンタル会社（サンプル）</legend>
            <div className="flex flex-wrap gap-2">
              {SUPPLIERS.map((s) => (
                <label key={s.id} className="inline-flex items-center gap-1.5 text-sm bg-ground rounded-full px-3 py-1.5 cursor-pointer has-[:checked]:bg-brand-soft has-[:checked]:text-brand">
                  <input type="checkbox" name="suppliers" value={s.id} defaultChecked={p.suppliers.includes(s.id)} className="sr-only" />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </Section>

      <Section id="images" title="画像" lead="1 枚目が一覧・検索結果の代表画像になります。横長（16:10 前後）・1600px 以上推奨。">
        {images.length > 0 && (
          <ul className="m-0 p-0 list-none grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((m, i) => (
              <li key={m.id} className="bg-ground rounded-[14px] overflow-hidden flex flex-col">
                <div className="relative aspect-[16/10] bg-white">
                  <Image src={m.url} alt={m.alt} fill sizes="360px" className="object-cover" />
                  {i === 0 && <span className="absolute top-2 left-2 text-[11px] bg-ink/80 text-white rounded-full px-2 py-0.5">代表</span>}
                </div>
                <div className="p-3 flex flex-col gap-2">
                  <form action={productImageAction} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="mediaId" value={m.id} />
                    <input type="hidden" name="op" value="meta" />
                    <input name="alt" defaultValue={m.alt} placeholder="代替テキスト" className={input} />
                    <input name="credit" defaultValue={m.credit ?? ""} placeholder="出典・権利表記" className={input} />
                    <button className="self-start text-xs text-link cursor-pointer">説明を保存</button>
                  </form>
                  <div className="flex items-center gap-1 text-xs text-faint">
                    <span className="flex-1">
                      {m.width && m.height ? `${m.width}×${m.height}` : ""}・{Math.round(m.bytes / 1024)}KB
                    </span>
                    {(
                      [
                        ["up", ArrowUp, "前へ", i === 0],
                        ["down", ArrowDown, "後ろへ", i === images.length - 1],
                        ["detach", Unlink, "この製品から外す", false],
                      ] as const
                    ).map(([op, I, label, disabled]) => (
                      <form key={op} action={productImageAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="mediaId" value={m.id} />
                        <input type="hidden" name="op" value={op} />
                        <button aria-label={label} title={label} disabled={disabled} className="p-1.5 rounded-md hover:bg-white hover:text-ink disabled:opacity-30 cursor-pointer">
                          <I size={15} />
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={uploadProductImagesAction} submit="アップロード">
          <input type="hidden" name="id" value={p.id} />
          <ImageUpload />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="alt" placeholder={`代替テキスト（空なら「${p.name}」）`} className={input} />
            <input name="credit" placeholder="出典・権利表記（例：© Apple Inc.）" className={input} />
          </div>
        </ActionForm>
      </Section>

      <Section id="specs" title="スペック" lead={`品目「${category.name}」の項目。項目そのものは「品目・スペック」で増やせます。空欄の項目は表示されません。`}>
        <ActionForm action={saveSpecsAction}>
          <input type="hidden" name="id" value={p.id} />
          <div className="flex flex-col divide-y divide-hair">
            {productAttrs.map((a) => {
              const cur = specOf.get(a.id);
              const v = cur?.value;
              return (
                <div key={a.id} className="py-3 grid gap-2 lg:grid-cols-[180px_1fr_1fr] items-start">
                  <p className="m-0 text-sm font-medium inline-flex items-center gap-2 pt-2">
                    <Icon name={a.icon} size={17} className="text-faint" />
                    {a.label}
                    {a.unit && <span className="text-xs text-faint">（{a.unit}）</span>}
                  </p>
                  <div className="flex flex-col gap-2">
                    {a.type === "boolean" ? (
                      <label className="inline-flex items-center gap-2 text-sm pt-2">
                        <input type="hidden" name={`b:${a.id}`} value="1" />
                        <input type="checkbox" name={`v:${a.id}`} defaultChecked={v === true} className="size-4 accent-[#0071e3]" />
                        あり
                      </label>
                    ) : a.type === "enum" ? (
                      <select name={`v:${a.id}`} defaultValue={v == null ? "" : String(v)} className={input}>
                        <option value="">—</option>
                        {a.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={`v:${a.id}`}
                        type={a.type === "number" ? "number" : "text"}
                        step="any"
                        defaultValue={v == null ? "" : String(v)}
                        placeholder={a.type === "number" ? "数値" : "値"}
                        className={input}
                      />
                    )}
                    <input name={`d:${a.id}`} defaultValue={cur?.display ?? ""} placeholder="表示用の文（空なら値と単位）" className={input} />
                  </div>
                  <textarea name={`p:${a.id}`} defaultValue={cur?.plain ?? ""} rows={3} placeholder="やさしい説明（つまりどういうこと？）" className={input} />
                </div>
              );
            })}
          </div>
        </ActionForm>
      </Section>

      <Section id="variants" title="構成" lead="メモリ・ストレージなど、構成ごとに変わる項目と価格。コードは URL・問い合わせに使います。">
        <ActionForm action={saveVariantsAction}>
          <input type="hidden" name="id" value={p.id} />
          <VariantsEditor
            attrs={variantAttrs.map(({ key, label, unit, type, options }) => ({ key, label, unit, type, options }))}
            initial={p.configs.map((v) => ({ code: v.id, label: v.label, attrs: v.attrs, officialPrice: v.officialPrice ?? null, rentBase: v.rentBase, note: v.note ?? null }))}
          />
        </ActionForm>
      </Section>

      <Section id="content" title="解説" lead="ひとことで言うと・向いている人・使い方の例・選び方・FAQ・比較・出典。">
        <ActionForm action={saveContentAction}>
          <input type="hidden" name="id" value={p.id} />
          <Label text="ひとことで言うと（3〜4文）">
            <textarea name="summary" defaultValue={c?.summary ?? ""} rows={4} className={input} />
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="向いている人（1行に1つ）">
              <textarea name="goodFor" defaultValue={c?.goodFor.join("\n") ?? ""} rows={5} className={input} />
            </Label>
            <Label text="向いていない人（1行に1つ）">
              <textarea name="notFor" defaultValue={c?.notFor.join("\n") ?? ""} rows={5} className={input} />
            </Label>
          </div>
          <Block title="使い方の例">
            <RowsEditor
              name="scenes"
              initial={c?.scenes ?? []}
              columns={[
                { key: "title", label: "場面" },
                { key: "recommend", label: "おすすめ構成", wide: true },
                { key: "body", label: "説明", type: "textarea" },
              ]}
            />
          </Block>
          <Block title="構成の選び方">
            <RowsEditor name="choose" initial={c?.choose ?? []} columns={[{ key: "title", label: "見出し" }, { key: "body", label: "本文", type: "textarea" }]} />
          </Block>
          <Block title="よくある質問">
            <RowsEditor name="faqs" initial={c?.faqs ?? []} addLabel="質問を追加" columns={[{ key: "q", label: "質問", wide: true }, { key: "a", label: "回答", type: "textarea" }]} />
          </Block>
          <Block title="よく比較される製品">
            <RowsEditor
              name="related"
              initial={c?.related ?? []}
              columns={[
                { key: "slug", label: "slug" },
                { key: "who", label: "向いている人" },
                { key: "diff", label: "この製品との違い", wide: true },
              ]}
            />
          </Block>
          <Block title="出典（仕様・価格の根拠）">
            <RowsEditor
              name="sources"
              initial={p.sources}
              columns={[
                { key: "title", label: "タイトル", wide: true },
                { key: "url", label: "URL", type: "url", wide: true },
                { key: "accessed", label: "確認日", type: "date" },
              ]}
            />
          </Block>
        </ActionForm>
      </Section>

      {hasRole(me, "admin") && (
        <section className="card p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3 border border-[#ffd6d3]">
          <div>
            <h2 className="m-0 text-[17px] font-semibold text-[#d70015]">製品を削除</h2>
            <p className="m-0 text-[13px] text-mute">スペック・構成・画像の紐づけも消えます（画像ファイル自体は「画像」に残ります）。公開をやめるだけなら状態を「非公開」に。</p>
          </div>
          <form action={deleteProductAction}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="confirm" value="delete" />
            <ConfirmButton message={`「${p.name}」を削除します。元に戻せません。`} className="btn bg-[#d70015] text-white !text-sm">
              <Trash2 size={15} aria-hidden="true" /> 削除
            </ConfirmButton>
          </form>
        </section>
      )}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] text-mute">{title}</p>
      {children}
    </div>
  );
}
