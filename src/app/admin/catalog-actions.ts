"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/catalog-server";
import { requireSql } from "@/lib/db";
import * as cat from "@/lib/repo-catalog";
import * as admin from "@/lib/repo-admin";
import * as accounts from "@/lib/repo-accounts";
import { rematchListings } from "@/lib/rental-match";
import { deleteMedia, mimeOf, uploadMedia } from "@/lib/storage";
import type { SpecValue } from "@/lib/types";
import {
  attributeSchema, categorySchema, contentSchema, newProductSchema, productBaseSchema, siteSchema, UUID, variantsSchema,
} from "@/lib/validation-admin";

export type AdminState = { ok: boolean; error?: string; message?: string; at?: number };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const firstIssue = (e: { issues: { path: PropertyKey[]; message: string }[] }) => {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "入力"}：${i.message}` : "入力を確認してください";
};
const dbError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/duplicate key/.test(m)) return "同じ ID（slug・コード）が既に使われています";
  if (/foreign key/.test(m)) return "参照しているデータがあるため処理できません";
  return `保存できませんでした：${m.slice(0, 120)}`;
};
const saved = (message = "保存しました"): AdminState => ({ ok: true, message, at: Date.now() });

/** カタログを書き換えたら公開側のキャッシュを捨てる */
function refreshCatalog(path?: string) {
  updateTag(CATALOG_TAG);
  if (path) revalidatePath(path);
}

// ───────── 機種 ─────────

export async function createProductAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  const p = newProductSchema.safeParse({ name: str(fd, "name"), slug: str(fd, "slug"), categoryId: str(fd, "categoryId"), brandId: str(fd, "brandId") });
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  let id: string;
  try {
    id = await admin.createProduct(requireSql(), p.data, me.id);
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog();
  redirect(`/admin/products/${id}`);
}

export async function saveProductBaseAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  const id = str(fd, "id");
  if (!UUID.test(id)) return { ok: false, error: "不正な ID" };
  const p = productBaseSchema.safeParse({
    name: str(fd, "name"),
    slug: str(fd, "slug"),
    categoryId: str(fd, "categoryId"),
    brandId: str(fd, "brandId"),
    subtitle: str(fd, "subtitle"),
    releaseDate: str(fd, "releaseDate"),
    status: str(fd, "status"),
    verified: fd.get("verified") === "on",
    bodyColor: str(fd, "bodyColor"),
    uses: fd.getAll("uses").map(String),
    listingMatch: str(fd, "listingMatch"),
  });
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  try {
    const sql = requireSql();
    await admin.updateProductBase(sql, id, p.data, me.id);
    // slug・対応づけの正規表現が変わったかもしれないので、掲載商品を付け直す
    await rematchListings(sql);
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog(`/admin/products/${id}`);
  return saved();
}

export async function saveSpecsAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  const id = str(fd, "id");
  if (!UUID.test(id)) return { ok: false, error: "不正な ID" };
  const sql = requireSql();
  const [product] = await cat.loadProducts(sql, { id, statuses: ["draft", "published", "archived"] });
  if (!product) return { ok: false, error: "機種が見つかりません" };
  const attrs = (await cat.loadCategories(sql)).find((c) => c.id === product.categoryId)?.attributes.filter((a) => a.scope === "product") ?? [];
  const specs: admin.SpecInput[] = [];
  for (const a of attrs) {
    const raw = str(fd, `v:${a.id}`).trim();
    let value: SpecValue | null = raw === "" ? null : raw;
    if (a.type === "number" && value !== null) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `${a.label}：数値を入力してください` };
      value = n;
    }
    if (a.type === "boolean") value = fd.get(`v:${a.id}`) === "on" ? true : fd.get(`b:${a.id}`) === "1" ? false : null;
    if (a.type === "enum" && value !== null && a.options.length && !a.options.includes(String(value)))
      return { ok: false, error: `${a.label}：選択肢にない値です` };
    const display = str(fd, `d:${a.id}`).trim().slice(0, 500) || null;
    const plain = str(fd, `p:${a.id}`).trim().slice(0, 2000) || null;
    // 値が空の項目は削除される。説明だけ書いて値を忘れたときに黙って消さない
    if (value === null && (display || plain)) return { ok: false, error: `${a.label}：値を入力してください（値が空の項目は保存されません）` };
    specs.push({ attributeId: a.id, value, display, plain });
  }
  try {
    await admin.saveSpecs(sql, id, specs, me.id);
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog(`/admin/products/${id}`);
  return saved();
}

export async function saveVariantsAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  const id = str(fd, "id");
  if (!UUID.test(id)) return { ok: false, error: "不正な ID" };
  const v = variantsSchema.safeParse(str(fd, "variants"));
  if (!v.success) return { ok: false, error: firstIssue(v.error) };
  try {
    const sql = requireSql();
    await admin.saveVariants(sql, id, v.data, me.id);
    await rematchListings(sql);
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog(`/admin/products/${id}`);
  return saved();
}

export async function saveContentAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  const id = str(fd, "id");
  if (!UUID.test(id)) return { ok: false, error: "不正な ID" };
  const c = contentSchema.safeParse(Object.fromEntries(["summary", "goodFor", "notFor", "scenes", "choose", "faqs", "related", "sources"].map((k) => [k, str(fd, k)])));
  if (!c.success) return { ok: false, error: firstIssue(c.error) };
  const { sources, ...content } = c.data;
  const empty = !content.summary && !content.goodFor.length && !content.notFor.length && !content.scenes.length && !content.faqs.length;
  try {
    await admin.updateProductContent(requireSql(), id, empty ? null : content, sources, me.id);
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog(`/admin/products/${id}`);
  return saved();
}

export async function deleteProductAction(fd: FormData): Promise<void> {
  await requireRole("admin");
  const id = str(fd, "id");
  if (!UUID.test(id) || str(fd, "confirm") !== "delete") return;
  await admin.deleteProduct(requireSql(), id);
  refreshCatalog("/admin/products");
  redirect("/admin/products");
}

// ───────── 画像 ─────────

async function uploadFiles(fd: FormData, kind: "product" | "favicon" | "other", userId: string) {
  const sql = requireSql();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new Error("ファイルを選んでください");
  const credit = str(fd, "credit").trim().slice(0, 200) || null;
  const out = [];
  for (const f of files) {
    const mime = mimeOf(f.name, f.type);
    if (!mime) throw new Error(`${f.name}：対応していない形式です（PNG・JPEG・WebP・GIF・SVG・ICO）`);
    out.push(await uploadMedia(sql, { data: new Uint8Array(await f.arrayBuffer()), mime, kind, alt: str(fd, "alt").trim().slice(0, 200), credit, createdBy: userId }));
  }
  return out;
}

export async function uploadProductImagesAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  const id = str(fd, "id");
  if (!UUID.test(id)) return { ok: false, error: "不正な ID" };
  try {
    const media = await uploadFiles(fd, "product", me.id);
    for (const m of media) await admin.attachProductMedia(requireSql(), id, m.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "アップロードできませんでした" };
  }
  refreshCatalog(`/admin/products/${id}`);
  return saved("アップロードしました");
}

export async function productImageAction(fd: FormData): Promise<void> {
  await requireRole("editor");
  const id = str(fd, "id");
  const mediaId = str(fd, "mediaId");
  if (!UUID.test(id) || !UUID.test(mediaId)) return;
  const sql = requireSql();
  const op = str(fd, "op");
  if (op === "up" || op === "down") await admin.moveProductMedia(sql, id, mediaId, op === "up" ? -1 : 1);
  else if (op === "detach") await admin.detachProductMedia(sql, id, mediaId);
  else if (op === "meta") await admin.updateMediaMeta(sql, mediaId, str(fd, "alt").trim().slice(0, 200), str(fd, "credit").trim().slice(0, 200) || null);
  refreshCatalog(`/admin/products/${id}`);
}

export async function uploadMediaAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  try {
    const media = await uploadFiles(fd, "other", me.id);
    revalidatePath("/admin/media");
    return saved(`${media.length} 件アップロードしました`);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "アップロードできませんでした" };
  }
}

export async function mediaAction(fd: FormData): Promise<void> {
  await requireRole("editor");
  const id = str(fd, "mediaId");
  if (!UUID.test(id)) return;
  const sql = requireSql();
  if (str(fd, "op") === "delete") await deleteMedia(sql, id);
  else await admin.updateMediaMeta(sql, id, str(fd, "alt").trim().slice(0, 200), str(fd, "credit").trim().slice(0, 200) || null);
  refreshCatalog("/admin/media");
}

// ───────── 品目・スペック項目 ─────────

export async function saveCategoryAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await requireRole("editor");
  const c = categorySchema.safeParse({ id: str(fd, "id"), name: str(fd, "name"), icon: str(fd, "icon"), sort: str(fd, "sort") || "0" });
  if (!c.success) return { ok: false, error: firstIssue(c.error) };
  await admin.upsertCategory(requireSql(), c.data);
  refreshCatalog("/admin/categories");
  return saved();
}

export async function deleteCategoryAction(fd: FormData): Promise<void> {
  await requireRole("admin");
  await admin.deleteCategory(requireSql(), str(fd, "id"));
  refreshCatalog("/admin/categories");
}

export async function saveAttributeAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await requireRole("editor");
  const id = str(fd, "attrId");
  const a = attributeSchema.safeParse({
    key: str(fd, "key"),
    label: str(fd, "label"),
    unit: str(fd, "unit"),
    type: str(fd, "type"),
    scope: str(fd, "scope"),
    options: str(fd, "options"),
    icon: str(fd, "icon"),
    filterable: fd.get("filterable") === "on",
    highlight: fd.get("highlight") === "on",
    sort: str(fd, "sort") || "0",
  });
  if (!a.success) return { ok: false, error: firstIssue(a.error) };
  try {
    await admin.upsertAttribute(requireSql(), UUID.test(id) ? id : null, { ...a.data, categoryId: str(fd, "categoryId") });
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog("/admin/categories");
  return saved();
}

export async function deleteAttributeAction(fd: FormData): Promise<void> {
  await requireRole("admin");
  const id = str(fd, "attrId");
  if (!UUID.test(id)) return;
  await admin.deleteAttribute(requireSql(), id);
  refreshCatalog("/admin/categories");
}

// ───────── サイト（favicon） ─────────

export async function saveSiteAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireRole("editor");
  const s = siteSchema.safeParse({ id: str(fd, "id"), name: str(fd, "name"), kind: str(fd, "kind"), url: str(fd, "url"), sort: str(fd, "sort") || "0" });
  if (!s.success) return { ok: false, error: firstIssue(s.error) };
  const sql = requireSql();
  try {
    await admin.upsertSite(sql, s.data);
    const file = fd.get("favicon");
    if (file instanceof File && file.size > 0) {
      const mime = mimeOf(file.name, file.type);
      if (!mime) return { ok: false, error: "favicon は PNG・ICO・SVG などの画像にしてください" };
      const m = await uploadMedia(sql, { data: new Uint8Array(await file.arrayBuffer()), mime, kind: "favicon", alt: s.data.name, createdBy: me.id });
      await admin.setSiteFavicon(sql, s.data.id, m.id);
    }
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog("/admin/sites");
  return saved();
}

export async function deleteSiteAction(fd: FormData): Promise<void> {
  await requireRole("admin");
  await admin.deleteSite(requireSql(), str(fd, "id"));
  refreshCatalog("/admin/sites");
}

// ───────── 会員 ─────────

export async function setRoleAction(fd: FormData): Promise<void> {
  const me = await requireRole("admin");
  const id = str(fd, "userId");
  const role = str(fd, "role");
  if (!UUID.test(id) || !accounts.ROLES.includes(role as accounts.Role)) return;
  if (id === me.id) return; // 自分の権限は変えられない（最後の管理者がいなくなるのを防ぐ）
  await accounts.setRole(requireSql(), id, role as accounts.Role);
  revalidatePath(`/admin/users/${id}`);
}

// ───────── レンタル会社の掲載商品 ─────────

export async function rematchListingsAction(): Promise<AdminState> {
  await requireRole("editor");
  try {
    const r = await rematchListings(requireSql());
    refreshCatalog("/admin/rentals");
    return saved(`対応づけ ${r.matched} 件（変更 ${r.changed} 件${r.ambiguous.length ? `・複数の機種に当てはまる ${r.ambiguous.length} 件` : ""}）`);
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
}

export async function setListingMatchAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await requireRole("editor");
  const id = str(fd, "id");
  if (!UUID.test(id)) return { ok: false, error: "不正な ID" };
  const op = str(fd, "op");
  const sql = requireSql();
  try {
    if (op === "auto") {
      await admin.setListingMatch(sql, id, { deviceSlug: null, configId: null, manual: false });
      await rematchListings(sql);
    } else {
      const [slug, config] = str(fd, "target").split("|");
      const products = await cat.loadProducts(sql, { statuses: ["draft", "published"] });
      const p = slug ? products.find((x) => x.slug === slug) : undefined;
      if (slug && !p) return { ok: false, error: "機種が見つかりません" };
      if (config && !p?.configs.some((c) => c.id === config)) return { ok: false, error: "構成が見つかりません" };
      await admin.setListingMatch(sql, id, { deviceSlug: p?.slug ?? null, configId: config || null, manual: true });
    }
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
  refreshCatalog("/admin/rentals");
  return saved();
}
