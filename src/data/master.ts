import type { Grade, Template, Supplier, Shop, Term, GradeCode, TemplateCode } from "../lib/types";

export const GRADES: Record<GradeCode, Grade> = {
  S: { code: "S", label: "新品同様", appearance: "傷なし", batteryMin: "95%以上", warranty: "契約期間中", priceFactor: 1.18 },
  A: { code: "A", label: "良好", appearance: "30cm離れて目立つ傷なし", batteryMin: "85%以上", warranty: "契約期間中", priceFactor: 1.0 },
  B: { code: "B", label: "使用感あり", appearance: "小傷・擦れあり", batteryMin: "80%以上", warranty: "契約期間中", priceFactor: 0.86 },
  C: { code: "C", label: "外観難あり", appearance: "目立つ傷・凹みあり（動作は正常）", batteryMin: "75%以上", warranty: "12か月", priceFactor: 0.74 },
};

export const GRADE_CODES: GradeCode[] = ["S", "A", "B", "C"];

export const TEMPLATES: Record<TemplateCode, Template> = {
  OFFICE: { code: "OFFICE", label: "一般事務", monthlyFee: 0, items: ["Microsoft 365", "Chrome", "Slack", "Zoom", "MDM登録", "ディスク暗号化"] },
  DESIGN: { code: "DESIGN", label: "デザイン", monthlyFee: 300, items: ["Adobe Creative Cloud", "Figma", "フォント管理", "カラープロファイル", "MDM登録", "ディスク暗号化"] },
  DEV: { code: "DEV", label: "開発", monthlyFee: 300, items: ["開発ツール一式", "Docker", "VS Code", "パッケージマネージャー", "SSH鍵設定", "MDM登録"] },
  NONE: { code: "NONE", label: "設定なし", monthlyFee: -200, items: ["初期化状態で出荷"] },
};

export const TEMPLATE_CODES: TemplateCode[] = ["OFFICE", "DESIGN", "DEV", "NONE"];

export const TERMS: Term[] = [12, 24, 36];
/** 契約期間による月額係数（サンプル仮定） */
export const TERM_FACTOR: Record<Term, number> = { 12: 1.22, 24: 1.0, 36: 0.88 };
/** 購入後に売却する場合の残価率（サンプル仮定） */
export const RESALE_RATE: Record<Term, number> = { 12: 0.6, 24: 0.45, 36: 0.32 };

/** レンタル会社（すべて架空のサンプル。提携後に実データへ置き換える） */
export const SUPPLIERS: Supplier[] = [
  { id: "bayside", name: "ベイサイドレンタル", certified: true, rating: 4.7, leadDays: 2, swap: "翌営業日交換", setupFee: 0, priceFactor: 0.97, grades: ["S", "A", "B"], sample: true },
  { id: "techlease", name: "テックリース東京", certified: true, rating: 4.5, leadDays: 3, swap: "翌営業日交換", setupFee: 3000, priceFactor: 1.0, grades: ["S", "A", "B", "C"], sample: true },
  { id: "greenpc", name: "グリーンPCサービス", certified: true, rating: 4.2, leadDays: 7, swap: "3営業日", setupFee: 5000, priceFactor: 0.91, grades: ["A", "B", "C"], sample: true },
  { id: "secondlab", name: "セカンドラボ", certified: false, rating: 3.9, leadDays: 10, swap: "修理返送", setupFee: 0, priceFactor: 0.88, grades: ["B", "C"], sample: true },
  { id: "northit", name: "ノースITサービス", certified: true, rating: 4.8, leadDays: 1, swap: "当日交換（都内）", setupFee: 0, priceFactor: 1.05, grades: ["S", "A"], sample: true },
];

/** 購入先。Apple公式以外の価格・ポイントはサンプル */
export const SHOPS: Shop[] = [
  { id: "official", name: "メーカー公式ストア", kind: "official", priceRatio: 1.0, pointRate: 0, shipping: "最短翌日・送料無料", sample: false },
  { id: "amazon", name: "Amazon", kind: "affiliate", priceRatio: 0.965, pointRate: 0.01, shipping: "最短翌日", sample: true },
  { id: "rakuten", name: "楽天市場", kind: "affiliate", priceRatio: 0.985, pointRate: 0.05, shipping: "2〜4日", note: "ポイントは条件により変動", sample: true },
  { id: "yodobashi", name: "ヨドバシ.com", kind: "affiliate", priceRatio: 1.0, pointRate: 0.1, shipping: "最短当日", sample: true },
  { id: "biccamera", name: "ビックカメラ.com", kind: "affiliate", priceRatio: 1.0, pointRate: 0.1, shipping: "1〜3日", sample: true },
];
