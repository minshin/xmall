// xmall の領域モデル。docs/data-model.md と同期すること。

export type Os = "macOS" | "Windows";
export type Use = "office" | "design" | "dev" | "sales" | "cad";

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
  /** レンタル会社の掲載（実データ。rental_listings のうちこの機種に対応づいたもの） */
  rentals: RentalOffer[];
  /** 掲載商品との対応づけに使う正規表現（管理用） */
  listingMatch: string | null;
  /** 事実確認済みか。false の機種はページに「確認中」を表示する */
  verified: boolean;
  specs: DeviceSpec[];
  content?: DeviceContent;
  sources: Source[];
  bodyColor: string;
  images: DeviceImage[];
  /** 最終更新（機種の編集日と掲載価格の取得日の新しい方。ISO 日付） */
  updatedAt: string;
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
  configs: { id: string; label: string; memoryGb: number; storageGb: number; officialPrice?: number; note?: string }[];
  /** 掲載商品との対応づけ（products.listing_match） */
  listingMatch?: string;
  verified: boolean;
  content?: DeviceContent & { specs: SpecRow[] };
  sources: Source[];
  bodyColor: string;
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
}

/** 機種ごとの集計（DB: public.device_stats） */
export interface DeviceStats {
  likes: number;
  reviewCount: number;
  rating: number | null;
  /** 閲覧者数（訪問者 ID ごとに 1 回） */
  views: number;
}

/** 機種ページ・比較で使うレンタルの掲載 1 件（rental_listings ＋ rental_prices から作る） */
export interface RentalOffer {
  /** companyId:externalId */
  key: string;
  companyId: string;
  companyName: string;
  url: string;
  title: string;
  /** 対応する構成（読み取れなければ null＝構成の記載なし） */
  configId: string | null;
  cpu: string | null;
  memoryGb: number | null;
  storageGb: number | null;
  condition: RentalListingData["condition"];
  officeIncluded: boolean | null;
  inStock: boolean | null;
  priceTax: RentalListingData["priceTax"];
  /** 月額の最安（ページの表記どおりの金額） */
  monthly: number;
  /** その月額になる契約期間（か月） */
  monthlyTerm: number;
  /** 比較用：税抜表示を税込に換算した月額（税区分の記載が無いものは表示額のまま） */
  monthlyCompare: number;
  /** 契約期間ごとの月額（ページの表記どおり） */
  plans: { months: number; monthly: number; label: string }[];
  /** 最短の利用期間（日・か月の表記。例：3日〜、1か月〜） */
  minTerm: string | null;
  terms: string | null;
  fetchedAt: string;
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
