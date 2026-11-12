/**
 * 初期データ（src/data/devices.ts の SeedDevice）→ Device への変換。
 * DB への投入（scripts/catalog-seed.ts）と、DB を使わないテストの固定データに使う。
 * ノートPC のスペック項目は migration 20261113000000 の spec_attributes と同じ key。
 */
import { DEVICES } from "../data/devices";
import type { Device, DeviceSpec, SeedDevice, SpecAttribute, SpecValue } from "./types";

type AttrDef = Pick<SpecAttribute, "key" | "label" | "unit" | "icon" | "highlight" | "filterable" | "scope" | "sort">;

/** ノートPC のスペック項目（migration と同じ。テスト・初期投入の照合用） */
export const LAPTOP_ATTRS: AttrDef[] = [
  { key: "chip", label: "チップ", unit: null, icon: "cpu", highlight: false, filterable: false, scope: "product", sort: 10 },
  { key: "cpu_family", label: "CPU", unit: null, icon: "cpu", highlight: false, filterable: true, scope: "product", sort: 11 },
  { key: "memory_gb", label: "メモリ", unit: "GB", icon: "memory-stick", highlight: true, filterable: true, scope: "variant", sort: 20 },
  { key: "storage_gb", label: "ストレージ", unit: "GB", icon: "hard-drive", highlight: false, filterable: false, scope: "variant", sort: 21 },
  { key: "memory_note", label: "メモリ（詳細）", unit: null, icon: "memory-stick", highlight: false, filterable: false, scope: "product", sort: 22 },
  { key: "storage_note", label: "ストレージ（詳細）", unit: null, icon: "hard-drive", highlight: false, filterable: false, scope: "product", sort: 23 },
  { key: "screen_inch", label: "画面サイズ", unit: "インチ", icon: "monitor", highlight: true, filterable: false, scope: "product", sort: 30 },
  { key: "display", label: "画面", unit: null, icon: "monitor", highlight: false, filterable: false, scope: "product", sort: 31 },
  { key: "battery", label: "バッテリー", unit: null, icon: "battery-full", highlight: false, filterable: false, scope: "product", sort: 40 },
  { key: "ports", label: "端子", unit: null, icon: "usb", highlight: false, filterable: false, scope: "product", sort: 50 },
  { key: "wireless", label: "無線", unit: null, icon: "wifi", highlight: false, filterable: false, scope: "product", sort: 51 },
  { key: "dimensions", label: "大きさ・重さ", unit: null, icon: "ruler", highlight: false, filterable: false, scope: "product", sort: 60 },
  { key: "weight_kg", label: "重さ", unit: "kg", icon: "weight", highlight: true, filterable: false, scope: "product", sort: 61 },
  { key: "os", label: "OS", unit: null, icon: "app-window", highlight: false, filterable: true, scope: "product", sort: 70 },
  { key: "os_note", label: "OS（詳細）", unit: null, icon: "app-window", highlight: false, filterable: false, scope: "product", sort: 71 },
  { key: "launch", label: "発売・メーカー価格", unit: null, icon: "calendar", highlight: false, filterable: false, scope: "product", sort: 80 },
];

/** 旧データの「スペックをやさしく解説」の行名 → スペック項目 key */
export const SPEC_ROW_KEY: Record<string, string> = {
  チップ: "chip",
  メモリ: "memory_note",
  ストレージ: "storage_note",
  画面: "display",
  バッテリー: "battery",
  端子: "ports",
  無線: "wireless",
  "大きさ・重さ": "dimensions",
  OS: "os_note",
  "発売・メーカー価格": "launch",
};

export const BRAND_ID: Record<string, string> = { Apple: "apple", Lenovo: "lenovo", Dell: "dell", Panasonic: "panasonic" };

/** 機種単位のスペック値（key → { value, display?, plain? }） */
export function seedSpecValues(d: SeedDevice): Map<string, { value: SpecValue; display?: string; plain?: string }> {
  const m = new Map<string, { value: SpecValue; display?: string; plain?: string }>();
  m.set("chip", { value: d.chip });
  m.set("cpu_family", { value: d.cpuFamily });
  m.set("os", { value: d.os });
  m.set("screen_inch", { value: d.screenInch });
  m.set("weight_kg", { value: d.weightKg });
  for (const row of d.content?.specs ?? []) {
    const key = SPEC_ROW_KEY[row.key];
    if (!key) continue;
    m.set(key, { value: m.get(key)?.value ?? row.value, display: row.value, plain: row.plain });
  }
  return m;
}

export function formatSpec(value: SpecValue, unit: string | null): string {
  if (typeof value === "boolean") return value ? "あり" : "なし";
  return unit ? `${value}${unit === "インチ" ? "インチ" : unit}` : String(value);
}

/** DB を使わずに Device を作る（テスト・初期投入の確認用） */
export function seedToDevice(d: SeedDevice): Device {
  const values = seedSpecValues(d);
  const specs: DeviceSpec[] = LAPTOP_ATTRS.filter((a) => a.scope === "product" && values.has(a.key)).map((a) => {
    const v = values.get(a.key)!;
    return {
      key: a.key,
      label: a.label,
      unit: a.unit,
      icon: a.icon,
      highlight: a.highlight,
      filterable: a.filterable,
      value: v.value,
      display: v.display ?? formatSpec(v.value, a.unit),
      plain: v.plain ?? null,
    };
  });
  const { specs: _omit, ...content } = d.content ?? ({} as NonNullable<SeedDevice["content"]>);
  void _omit;
  return {
    id: d.slug,
    slug: d.slug,
    categoryId: d.category,
    categoryName: "ノートPC",
    brandId: BRAND_ID[d.brand] ?? d.brand.toLowerCase(),
    brand: d.brand,
    name: d.name,
    subtitle: d.chip,
    releaseDate: d.releaseDate,
    status: "published",
    uses: d.uses,
    configs: d.configs.map((c) => ({
      id: c.id,
      label: c.label,
      attrs: { memory_gb: c.memoryGb, storage_gb: c.storageGb },
      officialPrice: c.officialPrice,
      rentBase: c.rentBase,
      note: c.note,
    })),
    suppliers: d.suppliers,
    verified: d.verified,
    specs,
    content: d.content ? content : undefined,
    sources: d.sources,
    bodyColor: d.bodyColor,
    images: [],
  };
}

/** テスト用：初期データ全体を Device にしたもの */
export const SEED_CATALOG: Device[] = DEVICES.map(seedToDevice);
