import { z } from "zod";

/** フォーム入力の検証（サーバー側で必ず通す） */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label}を入力してください` : `${label}は${min}文字以上で入力してください`)
    .max(max, `${label}は${max}文字以内で入力してください`);

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}は${max}文字以内で入力してください`)
    .transform((v) => (v === "" ? null : v));

/** 機種 slug の形式だけ見る（存在確認は DB を読む呼び出し側で行う） */
const slug = z.string().regex(/^[a-z0-9-]{1,80}$/, "機種が見つかりません");

export const reviewSchema = z.object({
  deviceSlug: slug,
  rating: z.coerce.number().int().min(1, "評価を選んでください").max(5),
  author: trimmed(2, 40, "肩書き"),
  use: z.enum(["office", "design", "dev", "sales", "cad"], { message: "用途を選んでください" }),
  acquisition: z.enum(["rent", "buy"], { message: "レンタルか購入かを選んでください" }),
  via: optional(60, "利用したサービス"),
  body: trimmed(30, 2000, "本文"),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

const blankToNull = (v: unknown) => (v === "" || v === undefined || v === null ? null : v);

/** 相談の条件（機種ページのリンク・フォームから来る）。金額は持たない */
export const consultSchema = z.object({
  deviceSlug: slug,
  configId: z.preprocess(blankToNull, z.string().regex(/^[a-z0-9-]{1,40}$/).nullable()),
  months: z.preprocess(blankToNull, z.coerce.number().int().min(1, "利用期間を選んでください").max(60).nullable()),
  quantity: z.coerce.number({ message: "台数を入力してください" }).int("台数は整数で入力してください").min(1, "台数は1台以上で入力してください").max(1000, "1000台を超える場合はご要望欄にご記入ください"),
});
export type ConsultInput = z.infer<typeof consultSchema>;

/** 相談フォームで選べる利用期間（か月） */
export const CONSULT_MONTHS = [1, 3, 6, 12, 24, 36];

export const contactSchema = z.object({
  company: trimmed(1, 100, "会社名"),
  contactName: trimmed(1, 50, "お名前"),
  email: z.string().trim().email("メールアドレスの形式が正しくありません").max(254),
  phone: optional(30, "電話番号").refine((v) => v === null || /^[0-9+\-() ]{8,}$/.test(v), "電話番号の形式が正しくありません"),
  prefecture: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (PREFECTURES as readonly string[]).includes(v), "都道府県を選んでください"),
  startMonth: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^\d{4}-\d{2}$/.test(v), "利用開始月の形式が正しくありません"),
  message: optional(2000, "ご要望"),
  agree: z.literal("on", { message: "個人情報の取り扱いに同意してください" }),
});
export type ContactInput = z.infer<typeof contactSchema>;

/** z.flattenError の fieldErrors を「最初の1件だけ」の形にする */
export function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** スパム対策のハニーポット（人には見えない欄に入力があれば bot とみなす） */
export const HONEYPOT = "website";

// ───────── 会員 ─────────

export const emailSchema = z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません").max(254);
export const passwordSchema = z.string().min(8, "パスワードは8文字以上にしてください").max(72, "パスワードは72文字以内にしてください");

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "パスワードを入力してください") });
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  agree: z.literal("on", { message: "利用規約と個人情報の取り扱いへの同意が必要です" }),
});

export const profileSchema = z.object({
  fullName: optional(50, "お名前"),
  companyName: optional(100, "会社名"),
  department: optional(50, "部署"),
  phone: optional(30, "電話番号").refine((v) => v === null || /^[0-9+\-() ]{8,}$/.test(v), "電話番号の形式が正しくありません"),
  companySize: z
    .enum(["", "1-9", "10-49", "50-299", "300-999", "1000+"])
    .transform((v) => (v === "" ? null : v)),
});

/** ログイン後の戻り先（サイト内の相対パスだけ許可） */
export const safeNext = (v: unknown, fallback = "/account") =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
