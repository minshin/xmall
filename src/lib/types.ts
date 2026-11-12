// xmall の領域モデル。docs/data-model.md と同期すること。

export type GradeCode = "S" | "A" | "B" | "C";
export type TemplateCode = "OFFICE" | "DESIGN" | "DEV" | "NONE";
export type Term = 12 | 24 | 36;
export type Os = "macOS" | "Windows";
export type Use = "office" | "design" | "dev" | "sales" | "cad";

export interface Grade {
  code: GradeCode;
  label: string;
  appearance: string;
  batteryMin: string;
  warranty: string;
  priceFactor: number;
}

export interface Template {
  code: TemplateCode;
  label: string;
  monthlyFee: number;
  items: string[];
}

// ───────── 商品（DB: products ほか。docs/data-model.md） ─────────

export type SpecValue = string | number | boolean;

/** スペック項目の定義（品目ごと。DB: spec_attributes） */
export interface SpecAttribute {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  unit: string | null;
  type: "text" | "number" | "boolean" | "enum";
  scope: "product" | "variant";
  options: string[];
  icon: string | null;
  filterable: boolean;
  highlight: boolean;
  sort: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort: number;
  attributes: SpecAttribute[];
}

/** 機種のスペック値（項目定義を展開済み） */
export interface DeviceSpec {
  key: string;
  label: string;
  unit: string | null;
  icon: string | null;
  highlight: boolean;
  filterable: boolean;
  value: SpecValue;
  /** 表示用の文（例：Apple M5（10コアCPU／10コアGPU）） */
  display: string;
  /** 「つまりどういうこと？」 */
  plain: string | null;
}

export interface DeviceConfig {
  /** 構成コード（例：16-512）。URL・問い合わせに使う */
  id: string;
  label: string;
  /** variant スコープのスペック値（例：{ memory_gb: 16, storage_gb: 512 }） */
  attrs: Record<string, SpecValue>;
  /** メーカー直販価格（税込）。未確認なら undefined */
  officialPrice?: number;
  /** 24か月・グレードA・係数1.0の基準月額 */
  rentBase: number;
  note?: string;
}

export interface Scene {
  title: string;
  body: string;
  recommend: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Source {
  title: string;
  url: string;
  accessed: string;
}

/** 解説コンテンツ（DB: products.content） */
export interface DeviceContent {
  summary: string;
  goodFor: string[];
  notFor: string[];
  scenes: Scene[];
  choose: { title: string; body: string }[];
  faqs: Faq[];
  related: { slug: string; who: string; diff: string }[];
}

export interface DeviceImage {
  /** 表示用 URL（Storage の公開 URL か public/ のパス） */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** 権利表記・出典。公開前に利用許諾を確認すること */
  credit: string;
  mediaId?: string;
}

export type ProductStatus = "draft" | "published" | "archived";

export interface Device {
  id: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  brandId: string;
  brand: string;
  name: string;
  /** 名前の下に出す型・世代（例：M5） */
  subtitle: string;
  releaseDate?: string;
  status: ProductStatus;
  uses: Use[];
  configs: DeviceConfig[];
  /** 見積を出すレンタル会社 id（src/data/master.ts の SUPPLIERS） */
  suppliers: string[];
  /** 事実確認済みか。false の機種はページに「確認中」を表示する */
  verified: boolean;
  specs: DeviceSpec[];
  content?: DeviceContent;
  sources: Source[];
  bodyColor: string;
  images: DeviceImage[];
}

// ───────── 初期データ（src/data/devices.ts）の形。ノートPC 専用の旧モデル ─────────

export interface SpecRow {
  key: string;
  value: string;
  plain: string;
}

export interface SeedDevice {
  slug: string;
  brand: string;
  name: string;
  chip: string;
  cpuFamily: "Apple M" | "Intel Core Ultra" | "Intel Core i" | "AMD Ryzen";
  category: "laptop";
  os: Os;
  screenInch: number;
  weightKg: number;
  releaseDate?: string;
  uses: Use[];
  configs: { id: string; label: string; memoryGb: number; storageGb: number; officialPrice?: number; rentBase: number; note?: string }[];
  suppliers: string[];
  verified: boolean;
  content?: DeviceContent & { specs: SpecRow[] };
  sources: Source[];
  bodyColor: string;
}

export interface Supplier {
  id: string;
  name: string;
  certified: boolean;
  rating: number;
  leadDays: number;
  swap: string;
  setupFee: number;
  priceFactor: number;
  grades: GradeCode[];
  sample: boolean;
}

export interface Shop {
  id: string;
  name: string;
  kind: "official" | "affiliate";
  /** 公式価格に対する販売価格の比率（サンプル） */
  priceRatio: number;
  pointRate: number;
  shipping: string;
  note?: string;
  sample: boolean;
}

export type ReviewStatus = "pending" | "approved" | "rejected";

/** 口コミ（DB: public.reviews） */
export interface Review {
  id: string;
  deviceSlug: string;
  rating: number;
  author: string;
  use: Use;
  acquisition: "rent" | "buy";
  via: string | null;
  body: string;
  helpful: number;
  createdAt: string;
  sample: boolean;
}

/** 機種ごとの集計（DB: public.device_stats） */
export interface DeviceStats {
  likes: number;
  reviewCount: number;
  rating: number | null;
  /** 閲覧者数（訪問者 ID ごとに 1 回） */
  views: number;
}

export interface RentalOffer {
  supplierId: string;
  supplierName: string;
  monthly: number;
  setupFee: number;
  leadDays: number;
  swap: string;
  rating: number;
  certified: boolean;
}

export interface ShopOffer {
  shopId: string;
  shopName: string;
  kind: Shop["kind"];
  price: number;
  points: number;
  effective: number;
  shipping: string;
  note?: string;
}

// ───────── 実在レンタル会社の掲載価格（DB: rental_companies / rental_listings / rental_prices） ─────────
// scripts/rentals で各社の公開ページから取得し、supabase/data/rental-listings.json を経由して DB に入れる。
// 提携先ではないため、問い合わせフォームではなく各社ページへのリンクで案内する。

export interface RentalCompanyData {
  id: string;
  /** サービス名（例：e-TAMAYA） */
  name: string;
  /** 運営会社（ページに記載があるもの） */
  operator: string | null;
  url: string;
  /** 法人専用か、個人・法人兼用か */
  audience: "business" | "mixed";
  note: string | null;
}

export interface RentalPriceData {
  termUnit: "day" | "month";
  termValue: number;
  priceYen: number;
  /** total: 期間合計（短期）／ per_month: その契約期間での月額 */
  basis: "total" | "per_month";
  /** ページ上の表記（例：「~3ヶ月」「1年」） */
  label: string;
}

export interface RentalListingData {
  companyId: string;
  /** 会社側の商品コードまたは URL の識別子 */
  externalId: string;
  url: string;
  title: string;
  maker: string | null;
  model: string | null;
  cpu: string | null;
  memoryGb: number | null;
  storageGb: number | null;
  os: string | null;
  /** new / used / selectable（新品・中古を選べる）。記載なしは null */
  condition: "new" | "used" | "selectable" | null;
  officeIncluded: boolean | null;
  inStock: boolean | null;
  priceTax: "incl" | "excl" | "unknown";
  /** 最低利用期間・解約料などの条件（ページの記載を要約） */
  terms: string | null;
  /** カタログ機種との対応（対応しなければ null） */
  deviceSlug: string | null;
  configId: string | null;
  prices: RentalPriceData[];
  fetchedAt: string;
}

/** 画面用：会社名つきの掲載商品 */
export interface RentalListing extends RentalListingData {
  companyName: string;
  companyOperator: string | null;
}
