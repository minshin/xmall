import assert from "node:assert/strict";
import { test } from "node:test";
import { getDevice, searchDevices, summarize } from "../src/lib/catalog";
import { quote, rentalOffers, rentOrBuy, shopOffers } from "../src/lib/pricing";

const mbp = getDevice("macbook-pro-14-m5")!;

test("MacBook Pro 14 M5 の公式価格は出典どおり", () => {
  assert.deepEqual(
    mbp.configs.map((c) => c.officialPrice),
    [248800, 278800, 308800],
  );
  assert.equal(mbp.verified, true);
  assert.ok(mbp.sources.length >= 2);
});

test("レンタル見積は安い順で、グレード非対応の会社を除外する", () => {
  const s = rentalOffers(mbp, "16-512", "S", 24, "OFFICE");
  assert.ok(s.every((o) => !["greenpc", "secondlab"].includes(o.supplierId)));
  const a = rentalOffers(mbp, "16-512", "A", 24, "OFFICE");
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].monthly <= a[i].monthly);
  assert.ok(a.every((o) => o.monthly % 10 === 0));
});

test("契約期間が長いほど月額は下がる", () => {
  const m = (t: 12 | 24 | 36) => rentalOffers(mbp, "16-512", "A", t, "OFFICE")[0].monthly;
  assert.ok(m(12) > m(24) && m(24) > m(36));
});

test("購入価格はポイント差引後の実質価格で並ぶ", () => {
  const shops = shopOffers(mbp, "16-512");
  assert.equal(shops.length, 5);
  shops.forEach((s) => assert.equal(s.effective, s.price - s.points));
  for (let i = 1; i < shops.length; i++) assert.ok(shops[i - 1].effective <= shops[i].effective);
});

test("公式価格が未確認の機種は購入価格を出さない", () => {
  const air = getDevice("macbook-air-13")!;
  assert.deepEqual(shopOffers(air), []);
  assert.equal(summarize(air).buyFrom, undefined);
  assert.equal(rentOrBuy(air, undefined, 24), undefined);
});

test("買う vs 借りる の計算", () => {
  const r = rentOrBuy(mbp, "16-512", 24)!;
  assert.equal(r.buyNet, r.buyEffective - r.resale);
  assert.equal(r.rentTotal, r.rentMonthly * 24);
  assert.equal(r.difference, Math.abs(r.buyNet - r.rentTotal));
});

test("見積総額 = 月額×台数×期間 + 初期費用×台数", () => {
  const q = quote(mbp, { configId: "24-1t", grade: "A", term: 24, template: "DEV", quantity: 5, supplierId: "techlease" })!;
  assert.equal(q.monthlyTotal, q.monthlyPerUnit * 5);
  assert.equal(q.contractTotal, q.monthlyPerUnit * 5 * 24 + 3000 * 5);
});

test("検索：OS・月額上限で絞り込める", () => {
  const mac = searchDevices({ os: "macOS" });
  assert.ok(mac.length >= 2 && mac.every((d) => d.os === "macOS"));
  const cheap = searchDevices({ maxMonthlyRent: 4000 });
  assert.ok(cheap.every((d) => (d.rentFrom ?? Infinity) <= 4000));
});
