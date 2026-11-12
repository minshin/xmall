import assert from "node:assert/strict";
import { test } from "node:test";
import { displaySpecs, searchDevices, specValue, summarize } from "../src/lib/catalog";
import { filterDevices, landingFacets, landingLead, landingStats, PRICE_BANDS } from "../src/lib/landing";
import { cheapestPerCompany, lowestMonthly, monthlyFor, offerSpec, rentalOffers, rentOrBuy } from "../src/lib/pricing";
import { dedupeOffers, toRentalOffer, type RentalRow } from "../src/lib/repo-catalog";
import { SEED_CATALOG } from "../src/lib/seed";
import type { Device } from "../src/lib/types";
import { productPath } from "../src/lib/urls";

const getDevice = (slug: string) => SEED_CATALOG.find((d) => d.slug === slug)!;
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** 掲載商品の行（テスト用）。prices は [期間（か月）, 月額] */
function row(company: string, id: string, prices: [number, number][], extra: Partial<RentalRow> = {}): RentalRow {
  return {
    company_id: company,
    company_name: company.toUpperCase(),
    external_id: id,
    url: `https://example.com/${company}/${id}`,
    title: `${company} ${id}`,
    config_id: null,
    cpu: null,
    memory_gb: 16,
    storage_gb: 512,
    condition: null,
    office_included: null,
    in_stock: null,
    price_tax: "incl",
    terms: null,
    fetched_at: "2026-11-12",
    prices: prices.map(([m, y]) => ({ termUnit: "month", termValue: m, priceYen: y, basis: "per_month", label: `${m}か月` })),
    ...extra,
  };
}
const offers = (...rows: RentalRow[]) => rows.map((r) => toRentalOffer(r)!);
const withRentals = (d: Device, rows: RentalRow[]): Device => ({ ...d, rentals: offers(...rows) });

test("MacBook Pro 14 M5 の公式価格は出典どおり", () => {
  const mbp = getDevice("macbook-pro-14-m5");
  assert.deepEqual(mbp.configs.map((c) => c.officialPrice), [248800, 278800, 308800]);
  assert.equal(mbp.verified, true);
  assert.ok(mbp.sources.length >= 2);
});

test("掲載 → 比較用：最安の月額と期間、最短期間、税抜は税込に換算して比べる", () => {
  const o = toRentalOffer(row("a", "1", [[3, 5000], [12, 4000], [24, 3800]]))!;
  assert.equal(o.monthly, 3800);
  assert.equal(o.monthlyTerm, 24);
  assert.equal(o.minTerm, "3か月〜");
  const ex = toRentalOffer(row("b", "1", [[12, 4000]], { price_tax: "excl" }))!;
  assert.equal(ex.monthly, 4000, "表示はページの表記どおり");
  assert.equal(ex.monthlyCompare, 4400, "比較は税込換算");
});

test("短期の合計額しかない掲載は比較に使わない。1か月の合計は 1 か月分の月額として扱う", () => {
  const onlyDays = row("a", "1", []);
  onlyDays.prices = [{ termUnit: "day", termValue: 7, priceYen: 9000, basis: "total", label: "7日間" }];
  assert.equal(toRentalOffer(onlyDays), null);
  const oneMonth = row("a", "2", [[3, 4000]]);
  oneMonth.prices.push({ termUnit: "month", termValue: 1, priceYen: 6000, basis: "total", label: "1か月" });
  oneMonth.prices.push({ termUnit: "day", termValue: 3, priceYen: 3000, basis: "total", label: "3日間" });
  const o = toRentalOffer(oneMonth)!;
  assert.deepEqual(o.plans.map((p) => [p.months, p.monthly]), [[1, 6000], [3, 4000]]);
  assert.equal(o.minTerm, "3日〜");
});

test("同じ会社の同じ仕様・同じ月額（色違いなど）は 1 件にまとめる", () => {
  const list = dedupeOffers(offers(row("a", "silver", [[12, 9000]]), row("a", "gray", [[12, 9000]]), row("a", "1tb", [[12, 9000]], { storage_gb: 1024 })));
  assert.equal(list.length, 2);
});

test("期間ごとの月額：その期間以下で最も長い契約の月額を使う（無ければ undefined）", () => {
  const o = toRentalOffer(row("a", "1", [[3, 5000], [12, 4000]]))!;
  assert.equal(monthlyFor(o, 1), undefined);
  assert.equal(monthlyFor(o, 6), 5000);
  assert.equal(monthlyFor(o, 24), 4000);
});

test("構成で絞ると、その構成と「構成の記載なし」の掲載が残る。会社ごとの最安は 1 件", () => {
  const d = withRentals(getDevice("macbook-pro-14-m5"), [
    row("a", "1", [[12, 9000]], { config_id: "16-512" }),
    row("a", "2", [[12, 8000]], { config_id: "16-1t" }),
    row("b", "1", [[12, 9500]]),
  ]);
  assert.deepEqual(rentalOffers(d, "16-512").map((o) => o.key), ["a:1", "b:1"]);
  assert.deepEqual(cheapestPerCompany(d.rentals).map((o) => o.key), ["a:2", "b:1"]);
  assert.equal(lowestMonthly(d), 8000);
  assert.equal(summarize(d).companyCount, 2);
});

test("借りる vs 買う：掲載の最安月額×期間 と 直販価格の単純比較", () => {
  const d = withRentals(getDevice("macbook-pro-14-m5"), [row("a", "1", [[12, 9000], [24, 8000]], { config_id: "16-512" })]);
  const r = rentOrBuy(d, "16-512", 24)!;
  assert.equal(r.rentMonthly, 8000);
  assert.equal(r.rentTotal, 8000 * 24);
  assert.equal(r.buyPrice, 248800);
  assert.equal(r.cheaper, "rent");
  assert.equal(r.difference, 248800 - 192000);
  assert.equal(rentOrBuy(getDevice("macbook-air-13"), undefined, 24), undefined, "直販価格・掲載が無ければ比較しない");
});

test("掲載の仕様の表記はページにある値だけ", () => {
  const o = toRentalOffer(row("a", "1", [[12, 1]], { cpu: "インテル Core i5-1135G7", memory_gb: 8, storage_gb: 1024, condition: "selectable", office_included: true }))!;
  assert.equal(offerSpec(o), "Core i5-1135G7・メモリ8GB・1TB・新品・中古を選択・Office付き");
});

test("一覧ページ：価格帯・メーカーの絞り込みと集計、少なすぎるページは作らない", () => {
  const a = withRentals(getDevice("thinkpad-e14"), [row("x", "1", [[12, 2800]]), row("y", "1", [[12, 3200]])]);
  const b = withRentals(getDevice("thinkpad-x1-carbon"), [row("x", "2", [[12, 9000]])]);
  const c = getDevice("latitude-5450"); // 掲載なし
  const all = [a, b, c];
  const under3000 = PRICE_BANDS.find((p) => p.id === "under-3000")!;
  assert.deepEqual(filterDevices(all, "laptop", { kind: "price", band: under3000 }).map((d) => d.slug), ["thinkpad-e14"]);
  const s = landingStats(all);
  assert.deepEqual([s.products, s.withRentals, s.listings, s.companies, s.minMonthly, s.maxMonthly, s.medianMonthly], [3, 2, 3, 2, 2800, 9000, 5900]);
  const f = landingFacets(all, "laptop");
  assert.deepEqual(f.brands.map((x) => x.id), ["lenovo"], "Dell は 1 機種なのでページを作らない");
  assert.deepEqual(f.prices.map((p) => p.band.id), ["under-10000"]);
  assert.match(landingLead("ノートPC", s, yen), /2社のレンタル会社の掲載価格（3件）.*¥2,800〜¥9,000.*中央値は¥5,900/);
});

test("URL は /品目/機種", () => {
  assert.equal(productPath(getDevice("macbook-pro-14-m5")), "/laptop/macbook-pro-14-m5");
  assert.equal(summarize(getDevice("macbook-pro-14-m5")).url, "/laptop/macbook-pro-14-m5");
});

test("検索：OS・月額上限で絞り込める", () => {
  const mac = searchDevices(SEED_CATALOG, { os: "macOS" });
  assert.ok(mac.length >= 2 && mac.every((d) => specValue(getDevice(d.slug), "os") === "macOS"));
  const cheap = searchDevices(SEED_CATALOG, { maxMonthlyRent: 4000 });
  assert.ok(cheap.every((d) => (d.rentFrom ?? Infinity) <= 4000));
});

test("表示用スペック：他の項目に含まれる重複を消し、（詳細）を外す", () => {
  const shown = displaySpecs(getDevice("macbook-pro-14-m5").specs);
  const keys = shown.map((s) => s.key);
  assert.ok(!keys.includes("weight_kg"), "重さは「大きさ・重さ」に含まれる");
  assert.ok(!keys.includes("cpu_family"), "CPU（Apple M）はチップに含まれる");
  assert.ok(!keys.includes("os"), "OS（macOS）は OS の詳細に含まれる");
  assert.ok(keys.includes("chip") && keys.includes("dimensions") && keys.includes("os_note"));
  assert.ok(shown.every((s) => !s.label.includes("（詳細）")));
});
