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

export interface DeviceConfig {
  id: string;
  label: string;
  memoryGb: number;
  storageGb: number;
  /** メーカー直販価格（税込）。未確認なら undefined */
  officialPrice?: number;
  /** 24か月・グレードA・係数1.0の基準月額 */
  rentBase: number;
  note?: string;
}

export interface SpecRow {
  key: string;
  value: string;
  /** 「つまりどういうこと？」やさしい説明 */
  plain: string;
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

export interface DeviceContent {
  summary: string;
  goodFor: string[];
  notFor: string[];
  specs: SpecRow[];
  scenes: Scene[];
  choose: { title: string; body: string }[];
  faqs: Faq[];
  related: { slug: string; who: string; diff: string }[];
}

export interface Device {
  slug: string;
  brand: string;
  name: string;
  /** 例: "M5", "Core Ultra 7" */
  chip: string;
  cpuFamily: "Apple M" | "Intel Core Ultra" | "Intel Core i" | "AMD Ryzen";
  category: "laptop";
  os: Os;
  screenInch: number;
  weightKg: number;
  releaseDate?: string;
  uses: Use[];
  configs: DeviceConfig[];
  /** 掲載している供給会社 id（グレードは供給会社側の対応グレードと掛け合わせる） */
  suppliers: string[];
  /** 事実確認済みか。false の機種はページに「確認中」を表示する */
  verified: boolean;
  content?: DeviceContent;
  sources: Source[];
  social: { likes: number; rating: number; reviewCount: number; topTag: string };
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

export interface Review {
  id: string;
  deviceSlug: string;
  rating: 1 | 2 | 3 | 4 | 5;
  author: string;
  use: Use;
  acquisition: "rent" | "buy";
  via: string;
  body: string;
  helpful: number;
  replies: number;
  sample: boolean;
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
