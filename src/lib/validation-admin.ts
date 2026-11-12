import { z } from "zod";
import { checkPattern } from "./rental-match";
import { RESERVED_SLUGS } from "./urls";

/** 管理画面の入力検証（Server Action で必ず通す） */

const s = (max: number) => z.string().trim().max(max);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const slugLike = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,80}$/, "英小文字・数字・ハイフンのみ");
const keyLike = z.string().trim().regex(/^[a-z][a-z0-9_]{0,40}$/, "英小文字で始まる英小文字・数字・_ のみ");

export const STATUSES = ["draft", "published", "archived"] as const;
export const USES = ["office", "design", "dev", "sales", "cad"] as const;

export const newProductSchema = z.object({
  name: s(120).min(1, "名前を入力してください"),
  slug: slugLike,
  categoryId: slugLike,
  brandId: slugLike,
});

/** 機種の slug（一覧ページの URL と重ならないもの） */
const productSlug = slugLike.refine((v) => !RESERVED_SLUGS.includes(v), "brand / price / use は URL で使うため機種の slug にできません");

export const productBaseSchema = z.object({
  name: s(120).min(1, "名前を入力してください"),
  slug: productSlug,
  categoryId: slugLike,
  brandId: slugLike,
  subtitle: opt(60),
  releaseDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "日付の形式が正しくありません")
    .transform((v) => (v === "" ? null : v)),
  status: z.enum(STATUSES),
  verified: z.boolean(),
  bodyColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB 形式で入力してください"),
  uses: z.array(z.enum(USES)),
  listingMatch: z
    .string()
    .trim()
    .max(300)
    .superRefine((v, ctx) => {
      const err = v ? checkPattern(v) : null;
      if (err) ctx.addIssue({ code: "custom", message: `掲載商品の対応づけ：${err}` });
    })
    .transform((v) => (v === "" ? null : v)),
});

const jsonArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v || "[]");
      } catch {
        ctx.addIssue({ code: "custom", message: "形式が正しくありません" });
        return z.NEVER;
      }
    })
    .pipe(z.array(item));

export const contentSchema = z.object({
  summary: s(2000),
  goodFor: z.string().transform((v) => v.split("\n").map((x) => x.trim()).filter(Boolean)),
  notFor: z.string().transform((v) => v.split("\n").map((x) => x.trim()).filter(Boolean)),
  scenes: jsonArray(z.object({ title: s(60).min(1), body: s(500), recommend: s(120) })),
  choose: jsonArray(z.object({ title: s(60).min(1), body: s(1000) })),
  faqs: jsonArray(z.object({ q: s(200).min(1), a: s(2000).min(1) })),
  related: jsonArray(z.object({ slug: slugLike, who: s(60), diff: s(200) })),
  sources: jsonArray(z.object({ title: s(200).min(1), url: z.string().trim().url("URL の形式が正しくありません"), accessed: s(10) })),
});

export const variantsSchema = jsonArray(
  z.object({
    code: slugLike,
    label: s(60).min(1, "表示名を入力してください"),
    attrs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    officialPrice: z.number().int().positive().nullable(),
    note: z.string().trim().max(60).nullable(),
  }),
).refine((vs) => new Set(vs.map((v) => v.code)).size === vs.length, "構成コードが重複しています");

export const categorySchema = z.object({
  id: slugLike,
  name: s(40).min(1),
  icon: opt(40),
  sort: z.coerce.number().int(),
});

export const attributeSchema = z.object({
  key: keyLike,
  label: s(40).min(1, "表示名を入力してください"),
  unit: opt(10),
  type: z.enum(["text", "number", "boolean", "enum"]),
  scope: z.enum(["product", "variant"]),
  options: z.string().transform((v) => v.split(/[,、\n]/).map((x) => x.trim()).filter(Boolean)),
  icon: opt(40),
  filterable: z.boolean(),
  highlight: z.boolean(),
  sort: z.coerce.number().int(),
});

export const siteSchema = z.object({
  id: slugLike,
  name: s(60).min(1),
  kind: z.enum(["maker", "shop", "rental", "other"]),
  url: opt(300).refine((v) => v === null || /^https?:\/\//.test(v), "URL の形式が正しくありません"),
  sort: z.coerce.number().int(),
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
